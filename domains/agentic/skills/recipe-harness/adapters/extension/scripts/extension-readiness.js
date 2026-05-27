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

function manifestDefaultPage(manifest) {
  return (
    manifest.action?.default_popup ||
    manifest.browser_action?.default_popup ||
    manifest.page_action?.default_popup ||
    manifest.side_panel?.default_path ||
    'home.html'
  );
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

function httpJsonRequest(method, url, timeoutMs = 3000) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (err) {
          reject(new Error(`invalid JSON from ${method} ${url}: ${err.message}`));
        }
      });
    });
    req.setTimeout(timeoutMs, () => {
      req.destroy(new Error(`timeout from ${method} ${url}`));
    });
    req.on('error', reject);
    req.end();
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

function extensionIdFromTarget(target) {
  const url = String(target.url || '');
  const match = url.match(/^chrome-extension:\/\/([a-z]{32})\//u);
  return match ? match[1] : '';
}

function chooseExtensionId(targets, expectedExtensionId, expectedServiceWorker) {
  const byId = new Map();
  for (const target of targets) {
    const id = extensionIdFromTarget(target);
    if (!id) continue;
    const entries = byId.get(id) || [];
    entries.push(target);
    byId.set(id, entries);
  }
  const ids = [...byId.keys()];
  if (ids.length === 0) return { extensionIds: [], selectedExtensionId: '' };

  const hasExpectedWorker = (id) => byId.get(id).some((target) => {
    const url = String(target.url || '');
    return target.type === 'service_worker' && expectedServiceWorker && url.endsWith(`/${expectedServiceWorker}`);
  });
  const hasAnyWorker = (id) => byId.get(id).some((target) => target.type === 'service_worker');

  const selectedExtensionId =
    ids.find((id) => id === expectedExtensionId && hasExpectedWorker(id)) ||
    ids.find((id) => hasExpectedWorker(id)) ||
    ids.find((id) => id === expectedExtensionId && hasAnyWorker(id)) ||
    ids.find((id) => hasAnyWorker(id)) ||
    (expectedExtensionId && ids.includes(expectedExtensionId) ? expectedExtensionId : ids[0]);

  return { extensionIds: ids, selectedExtensionId };
}

async function openExtensionPage(cdpPort, extensionId, pagePath) {
  const normalizedPath = String(pagePath || 'home.html').replace(/^\/+/u, '');
  const url = `chrome-extension://${extensionId}/${normalizedPath}`;
  try {
    await httpJsonRequest('PUT', `http://127.0.0.1:${cdpPort}/json/new?${encodeURIComponent(url)}`, 3000);
    return true;
  } catch (err) {
    // Some CDP implementations disable /json/new. Readiness can still pass
    // when the caller already opened an extension page, so report this as a
    // best-effort page-open miss instead of hiding a required check failure.
    return false;
  }
}

function findPageTarget(targets, selectedExtensionId, preferredPagePath = '') {
  const extensionPages = targets.filter((target) => {
    const url = String(target.url || '');
    return (
      target.type === 'page' &&
      url.startsWith(`chrome-extension://${selectedExtensionId}/`) &&
      typeof target.webSocketDebuggerUrl === 'string'
    );
  });
  const normalizedPreferred = String(preferredPagePath || '').replace(/^\/+/u, '');
  return (
    extensionPages.find((target) => normalizedPreferred && String(target.url || '').endsWith(`/${normalizedPreferred}`)) ||
    extensionPages.find((target) => !String(target.url || '').includes('/popup-init.html')) ||
    extensionPages[0]
  );
}

async function inspectCdp(target, cdpPort, expectedExtensionId, expectedServiceWorker, extensionPagePath) {
  const version = await httpJson(`http://127.0.0.1:${cdpPort}/json/version`);
  let targets = await httpJson(`http://127.0.0.1:${cdpPort}/json/list`);
  if (!Array.isArray(targets)) throw new Error('/json/list did not return an array');
  let { extensionIds, selectedExtensionId } = chooseExtensionId(targets, expectedExtensionId, expectedServiceWorker);
  if (!selectedExtensionId) {
    throw new Error('CDP is reachable but no chrome-extension:// targets are present');
  }
  let pageTarget = findPageTarget(targets, selectedExtensionId, extensionPagePath);
  let openedPage = false;
  if (!pageTarget) {
    openedPage = await openExtensionPage(cdpPort, selectedExtensionId, extensionPagePath);
    await new Promise((resolve) => setTimeout(resolve, 500));
    targets = await httpJson(`http://127.0.0.1:${cdpPort}/json/list`);
    ({ extensionIds, selectedExtensionId } = chooseExtensionId(targets, expectedExtensionId, expectedServiceWorker));
    pageTarget = findPageTarget(targets, selectedExtensionId, extensionPagePath);
  }
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
    if (ui && !ui.skipped && String(ui.url || '').startsWith('chrome-error://')) {
      throw Object.assign(new Error('MetaMask extension page loaded Chrome error UI'), {
        report: { cdp: { browser: version.Browser || 'unknown', selectedExtensionId, ui } },
      });
    }
  }
  return {
    browser: version.Browser || 'unknown',
    extensionIds,
    selectedExtensionId,
    markerMatched: Boolean(expectedExtensionId && selectedExtensionId === expectedExtensionId),
    targetCount: targets.length,
    openedPage,
    openedPagePath: extensionPagePath,
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

  const defaultPage = fs.existsSync(path.join(target, 'dist/chrome/home.html'))
    ? 'home.html'
    : manifestDefaultPage(manifest);
  const report = {
    target,
    manifestPath,
    manifestVersion: manifest.manifest_version || null,
    defaultPage,
    expectedFiles,
    checks,
  };

  if (args.cdpPort) {
    const expectedExtensionId = readExpectedExtensionId(target);
    report.cdp = await inspectCdp(
      target,
      args.cdpPort,
      expectedExtensionId,
      manifest.background?.service_worker || '',
      report.defaultPage,
    );
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
