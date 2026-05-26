#!/usr/bin/env node
'use strict';

const fs = require('fs');
const http = require('http');
const path = require('path');

function parseArgs(argv) {
  const out = { target: process.cwd(), cdpPort: '', json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--target') {
      out.target = argv[++i];
    } else if (arg === '--cdp-port') {
      out.cdpPort = argv[++i];
    } else if (arg === '--json') {
      out.json = true;
    } else if (arg === '-h' || arg === '--help') {
      console.log('Usage: extension-readiness.js --target <metamask-extension> [--cdp-port <port>] [--json]');
      process.exit(0);
    } else {
      throw new Error(`Unknown arg: ${arg}`);
    }
  }
  return out;
}

function readManifest(target) {
  const manifestPath = path.join(target, 'dist/chrome/manifest.json');
  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  return { manifestPath, manifest };
}

function manifestExpectedFiles(manifest) {
  const entries = new Set(['home.html']);
  if (manifest.background?.service_worker) entries.add(manifest.background.service_worker);
  for (const script of manifest.background?.scripts || []) entries.add(script);
  const popup =
    manifest.action?.default_popup ||
    manifest.browser_action?.default_popup ||
    manifest.page_action?.default_popup;
  if (popup) entries.add(popup);
  if (manifest.side_panel?.default_path) entries.add(manifest.side_panel.default_path);
  return [...entries];
}

function extensionIdPath(target) {
  return path.join(target, 'temp/runtime/extension.id');
}

function readExpectedExtensionId(target) {
  const idPath = path.join(target, 'temp/runtime/extension.id');
  if (!fs.existsSync(idPath)) return '';
  const id = fs.readFileSync(idPath, 'utf8').trim();
  return /^[a-z]{32}$/.test(id) ? id : '';
}

function writeExtensionId(target, extensionId) {
  if (!/^[a-z]{32}$/.test(extensionId)) return false;
  const idPath = extensionIdPath(target);
  fs.mkdirSync(path.dirname(idPath), { recursive: true });
  const existing = fs.existsSync(idPath) ? fs.readFileSync(idPath, 'utf8').trim() : '';
  if (existing === extensionId) return false;
  fs.writeFileSync(idPath, `${extensionId}\n`);
  return true;
}

function httpJson(url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`invalid JSON from ${url}: ${err.message}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout from ${url}`));
    });
    req.on('error', reject);
  });
}

function resolveWebSocket(target) {
  try {
    return require(require.resolve('ws', { paths: [target, process.cwd()] }));
  } catch {
    return typeof WebSocket === 'function' ? WebSocket : null;
  }
}

async function cdpEvaluate(target, webSocketDebuggerUrl, expression, timeoutMs = 5000) {
  const WebSocketImpl = resolveWebSocket(target);
  if (!WebSocketImpl) return { skipped: true, reason: 'WebSocket unavailable in this Node runtime' };
  return new Promise((resolve, reject) => {
    const ws = new WebSocketImpl(webSocketDebuggerUrl);
    const timer = setTimeout(() => {
      try {
        ws.close();
      } catch {
        // Best effort timeout cleanup.
      }
      reject(new Error('timeout evaluating extension page via CDP'));
    }, timeoutMs);
    const onOpen = () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: { expression, awaitPromise: true, returnByValue: true },
      }));
    };
    const onMessage = (event) => {
      const raw = event?.data ?? event;
      const msg = JSON.parse(Buffer.isBuffer(raw) ? raw.toString('utf8') : String(raw));
      if (msg.id !== 1) return;
      clearTimeout(timer);
      ws.close();
      if (msg.error) {
        reject(new Error(msg.error.message || JSON.stringify(msg.error)));
        return;
      }
      resolve(msg.result?.result?.value ?? null);
    };
    const onError = (err) => {
      clearTimeout(timer);
      reject(new Error(`CDP websocket error while inspecting extension page: ${err?.message || err || 'unknown'}`));
    };
    if (typeof ws.on === 'function') {
      ws.on('open', onOpen);
      ws.on('message', onMessage);
      ws.on('error', onError);
    } else {
      ws.addEventListener('open', onOpen);
      ws.addEventListener('message', onMessage);
      ws.addEventListener('error', onError);
    }
  });
}

async function inspectCdp(target, cdpPort, expectedExtensionId) {
  const version = await httpJson(`http://127.0.0.1:${cdpPort}/json/version`);
  const targets = await httpJson(`http://127.0.0.1:${cdpPort}/json/list`);
  if (!Array.isArray(targets)) throw new Error('/json/list did not return an array');
  const ids = new Set();
  for (const target of targets) {
    const url = String(target.url || '');
    const match = url.match(/^chrome-extension:\/\/([a-z]{32})\//u);
    if (match) ids.add(match[1]);
  }
  if (ids.size === 0) {
    throw new Error('CDP is reachable but no chrome-extension:// targets are present');
  }
  const extensionIds = [...ids];
  const selectedExtensionId =
    expectedExtensionId && ids.has(expectedExtensionId) ? expectedExtensionId : extensionIds[0];
  const pageTarget = targets.find((target) => {
    const url = String(target.url || '');
    return (
      target.type === 'page' &&
      url.startsWith(`chrome-extension://${selectedExtensionId}/`) &&
      typeof target.webSocketDebuggerUrl === 'string'
    );
  });
  let ui = null;
  if (pageTarget) {
    ui = await cdpEvaluate(
      target,
      pageTarget.webSocketDebuggerUrl,
      `(() => {
        const text = document.body?.innerText || '';
        return {
          title: document.title,
          url: location.href,
          textSample: text.slice(0, 500),
          hasStartupError: /MetaMask had trouble starting|Background connection unresponsive|Unknown Infura network/i.test(text),
        };
      })()`,
    );
    if (ui && !ui.skipped && ui.hasStartupError) {
      throw Object.assign(new Error('MetaMask extension page loaded startup error UI'), {
        report: { cdp: { browser: version.Browser || 'unknown', selectedExtensionId, ui } },
      });
    }
  }
  return {
    browser: version.Browser || 'unknown',
    extensionIds,
    selectedExtensionId,
    markerMatched: Boolean(expectedExtensionId && ids.has(expectedExtensionId)),
    targetCount: targets.length,
    ui,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const target = path.resolve(args.target);
  const checks = [];
  const { manifestPath, manifest } = readManifest(target);
  const expectedFiles = manifestExpectedFiles(manifest);
  const missingFiles = [];
  for (const rel of expectedFiles) {
    const exists = fs.existsSync(path.join(target, 'dist/chrome', rel));
    checks.push({ name: `dist/chrome/${rel}`, status: exists ? 'pass' : 'fail' });
    if (!exists) missingFiles.push(rel);
  }
  if (missingFiles.length > 0) {
    throw Object.assign(
      new Error(`extension build incomplete; missing ${missingFiles.join(', ')}`),
      { report: { target, manifestPath, expectedFiles, checks } },
    );
  }

  const report = {
    target,
    manifestPath,
    manifestVersion: manifest.manifest_version || null,
    expectedFiles,
    checks,
  };

  if (args.cdpPort) {
    const expectedExtensionId = readExpectedExtensionId(target);
    report.cdp = await inspectCdp(target, args.cdpPort, expectedExtensionId);
    report.cdp.markerRepaired = writeExtensionId(target, report.cdp.selectedExtensionId);
    checks.push({ name: `CDP ${args.cdpPort} extension targets`, status: 'pass' });
  }

  if (args.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    console.log(`Extension readiness OK: ${expectedFiles.join(', ')}`);
    if (report.cdp) {
      console.log(`CDP OK: ${report.cdp.browser}; extensions=${report.cdp.extensionIds.join(',')}`);
    }
  }
}

main().catch((err) => {
  const report = err && err.report ? err.report : null;
  if (process.argv.includes('--json')) {
    console.log(JSON.stringify({ status: 'fail', error: err.message, ...(report || {}) }, null, 2));
  } else {
    console.error(`Extension readiness failed: ${err.message}`);
  }
  process.exit(1);
});
