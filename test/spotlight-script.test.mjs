import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import http from 'node:http';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { after, afterEach, describe, test } from 'node:test';

const SCRIPT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
  'domains',
  'observability',
  'skills',
  'spotlight',
  'scripts',
  'spotlight.sh',
);

function hasCommand(name) {
  return spawnSync('sh', ['-c', `command -v ${name}`]).status === 0;
}

const MISSING = ['bash', 'curl', 'git', 'lsof', 'python3'].filter((c) => !hasCommand(c));
const SKIP =
  process.platform === 'win32'
    ? 'spotlight.sh is POSIX only'
    : MISSING.length > 0
      ? `missing: ${MISSING.join(', ')}`
      : false;

const cleanups = [];
afterEach(async () => {
  while (cleanups.length > 0) {
    await cleanups.pop()();
  }
});
after(() => {
  while (cleanups.length > 0) {
    // Synchronous best effort if a test aborted before afterEach ran.
    const fn = cleanups.pop();
    try {
      fn();
    } catch {
      // ignore
    }
  }
});

function tmpDir() {
  const dir = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'spotlight-test-')));
  cleanups.push(() => rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function freePort() {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.listen(0, '127.0.0.1', () => {
      const { port } = srv.address();
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

function sse(text) {
  const payload = { jsonrpc: '2.0', id: 1, result: { content: [{ type: 'text', text }] } };
  return `event: message\ndata: ${JSON.stringify(payload)}\n\n`;
}

/** A fake Spotlight sidecar: /health is always 200, /mcp is whatever `mcp` returns. */
async function fakeSidecar(mcp) {
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200).end('ok');
      return;
    }
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      const call = JSON.parse(body || '{}').params ?? {};
      const out = mcp(call.name, call.arguments ?? {});
      res.writeHead(out.status ?? 200, { 'Content-Type': 'text/event-stream' });
      res.end(out.body ?? '');
    });
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  cleanups.push(() => new Promise((resolve) => server.close(resolve)));
  return server.address().port;
}

function run(args, { cwd, env = {} } = {}) {
  return new Promise((resolve) => {
    const child = spawn('bash', [SCRIPT, ...args], {
      cwd,
      env: { ...process.env, ...env },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d));
    child.stderr.on('data', (d) => (stderr += d));
    child.on('close', (status) => resolve({ status, stdout, stderr, all: stdout + stderr }));
  });
}

/** A long-lived child process that listens on `port` and answers every GET. */
function listener(file, port, { cwd } = {}) {
  writeFileSync(
    file,
    `require('node:http').createServer((q, r) => r.end('packager-status:running')).listen(Number(process.argv[2]), '127.0.0.1');\n`,
  );
  const child = spawn(process.execPath, [file, String(port)], { cwd, stdio: 'ignore', detached: true });
  cleanups.push(() => {
    try {
      process.kill(-child.pid, 'SIGKILL');
    } catch {
      // already gone
    }
  });
  return child;
}

async function waitFor(fn, ms = 10000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    if (await fn()) return true;
    await new Promise((r) => setTimeout(r, 100));
  }
  return false;
}

function listening(port) {
  const out = spawnSync('lsof', ['-nP', `-tiTCP:${port}`, '-sTCP:LISTEN'], { encoding: 'utf8' });
  return out.stdout.trim().split('\n').filter(Boolean).map(Number);
}

function alive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** A throwaway git repo that stands in for the metamask-mobile checkout. */
function fakeRepo({ example, env } = {}) {
  const root = tmpDir();
  spawnSync('git', ['init', '-q', root]);
  if (example !== undefined) writeFileSync(path.join(root, '.js.env.example'), example);
  if (env !== undefined) writeFileSync(path.join(root, '.js.env'), env);
  return root;
}

describe('spotlight.sh usage', { skip: SKIP }, () => {
  test('--help prints the header comment and exits 0', async () => {
    const r = await run(['--help']);
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Bring up Sentry Spotlight/);
    assert.match(r.stdout, /--restart-metro/);
    assert.doesNotMatch(r.stdout, /set -euo pipefail/);
  });

  test('rejects unknown commands, unknown on flags and contradictory flags', async () => {
    assert.equal((await run(['bogus'])).status, 64);
    const typo = await run(['on', '--no-opn']);
    assert.equal(typo.status, 64);
    assert.match(typo.all, /unknown flag: --no-opn/);
    const both = await run(['on', '--restart-metro', '--no-metro']);
    assert.equal(both.status, 64);
    assert.match(both.all, /contradict/);
  });

  test('mcp rejects an invalid tool name before touching the network', async () => {
    const r = await run(['mcp', 'bad"name'], { env: { SPOTLIGHT_PORT: '1' } });
    assert.equal(r.status, 64);
    assert.match(r.all, /invalid MCP tool name/);
  });
});

describe('spotlight.sh status', { skip: SKIP }, () => {
  test('reports when no sidecar is running', async () => {
    const port = await freePort();
    const r = await run(['status'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 1);
    assert.match(r.all, /NOT running/);
  });

  test('reports the error instead of exiting silently when the MCP endpoint fails', async () => {
    const port = await fakeSidecar(() => ({ status: 500, body: 'boom' }));
    const r = await run(['status'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 3);
    assert.match(r.all, /querying it failed/);
    assert.match(r.all, /HTTP 500/);
  });

  test('reports an MCP-level error', async () => {
    const port = await fakeSidecar(() => ({
      body: `data: ${JSON.stringify({ jsonrpc: '2.0', id: 1, error: { code: -32602, message: 'nope' } })}\n\n`,
    }));
    const r = await run(['status'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 3);
    assert.match(r.all, /MCP error/);
  });

  test('says connected only when traces arrived in the recent window', async () => {
    const port = await fakeSidecar((name) =>
      name === 'search_traces'
        ? { body: sse('# Local Traces (2 found)') }
        : { body: sse('**No errors detected in Spotlight**') },
    );
    const r = await run(['status'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 0);
    assert.match(r.stdout, /Connected: the app is sending events/);
  });

  test('distinguishes "never connected" from "went quiet"', async () => {
    const none = await fakeSidecar(() => ({ body: sse('No traces found in the specified time period.') }));
    const never = await run(['status'], { env: { SPOTLIGHT_PORT: String(none) } });
    assert.match(never.stdout, /No traces yet/);

    const quiet = await fakeSidecar((name, args) => {
      if (name === 'search_traces' && args.filters.timeWindow >= 3600) {
        return { body: sse('# Local Traces (1 found)') };
      }
      return { body: sse('No traces found in the specified time period.') };
    });
    const gone = await run(['status'], { env: { SPOTLIGHT_PORT: String(quiet) } });
    assert.match(gone.stdout, /earlier ones exist/);
    assert.doesNotMatch(gone.stdout, /Connected:/);
  });
});

describe('spotlight.sh on: .js.env handling', { skip: SKIP }, () => {
  const sidecar = () => fakeSidecar(() => ({ body: sse('No traces found') }));

  test('creates .js.env from the example, sets the flag and a throwaway DSN', async () => {
    const port = await sidecar();
    const root = fakeRepo({ example: 'export MM_SENTRY_DSN=""\nexport OTHER="1"\n' });
    const r = await run(['on', '--no-open', '--no-metro'], {
      cwd: root,
      env: { SPOTLIGHT_PORT: String(port) },
    });
    assert.equal(r.status, 0, r.all);
    const env = readFileSync(path.join(root, '.js.env'), 'utf8');
    assert.match(env, /^export SENTRY_SPOTLIGHT="true"$/m);
    assert.match(env, /^export MM_SENTRY_DSN="https:\/\/spotlight@localhost\/1"$/m);
    assert.match(env, /^export OTHER="1"$/m);
    assert.match(r.stdout, /Restart Metro with a clean cache \(skipped by --no-metro\)/);
  });

  test('is idempotent and leaves a real DSN alone', async () => {
    const port = await sidecar();
    const root = fakeRepo({
      env: 'export MM_SENTRY_DSN="https://key@o1.ingest.sentry.io/1"\nexport SENTRY_SPOTLIGHT="true"\n',
    });
    const before = readFileSync(path.join(root, '.js.env'), 'utf8');
    const r = await run(['on', '--no-open'], { cwd: root, env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 0, r.all);
    assert.equal(readFileSync(path.join(root, '.js.env'), 'utf8'), before);
    assert.match(r.stdout, /SENTRY_SPOTLIGHT=true already set/);
    assert.doesNotMatch(r.stdout, /key@/, 'must never print the DSN key');
    assert.doesNotMatch(r.stdout, /metro:/, 'unchanged env must not touch Metro');
  });

  test('rewrites an inline-commented, export-less flag without duplicating it', async () => {
    const port = await sidecar();
    const root = fakeRepo({
      env: 'MM_SENTRY_DSN=https://key@o1.ingest.sentry.io/1\nSENTRY_SPOTLIGHT=false # keep me\n',
    });
    const r = await run(['on', '--no-open', '--no-metro'], {
      cwd: root,
      env: { SPOTLIGHT_PORT: String(port) },
    });
    assert.equal(r.status, 0, r.all);
    const env = readFileSync(path.join(root, '.js.env'), 'utf8');
    assert.equal((env.match(/SENTRY_SPOTLIGHT=/g) ?? []).length, 1);
    assert.match(env, /^export SENTRY_SPOTLIGHT="true" # keep me$/m);
    assert.match(env, /^MM_SENTRY_DSN=https:\/\/key@o1\.ingest\.sentry\.io\/1$/m);
  });

  test('treats an export-less true with a trailing comment as already set', async () => {
    const port = await sidecar();
    const root = fakeRepo({
      env: 'MM_SENTRY_DSN="https://key@o1.ingest.sentry.io/1"\nSENTRY_SPOTLIGHT=true # on\n',
    });
    const before = readFileSync(path.join(root, '.js.env'), 'utf8');
    const r = await run(['on', '--no-open'], { cwd: root, env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 0, r.all);
    assert.equal(readFileSync(path.join(root, '.js.env'), 'utf8'), before);
  });

  test('fails instead of printing next steps when there is no .js.env and no example', async () => {
    const port = await sidecar();
    const root = fakeRepo();
    const r = await run(['on', '--no-open'], { cwd: root, env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 1);
    assert.match(r.all, /no \.js\.env and no \.js\.env\.example/);
    assert.doesNotMatch(r.stdout, /Still needed/);
  });
});

describe('spotlight.sh on: Metro reset', { skip: SKIP }, () => {
  function setup(metroPort, { withYarn = true } = {}) {
    const root = fakeRepo({
      example: `export MM_SENTRY_DSN="https://key@o1.ingest.sentry.io/1"\nexport WATCHER_PORT=${metroPort}\n`,
    });
    const cli = path.join(root, 'node_modules', 'expo', 'bin', 'cli');
    mkdirSync(path.dirname(cli), { recursive: true });
    const bin = tmpDir();
    const calls = path.join(bin, 'yarn.calls');
    if (withYarn) {
      // Stands in for `yarn watch:clean`: logs the call, then serves as the new Metro.
      writeFileSync(
        path.join(bin, 'yarn'),
        `#!/usr/bin/env bash\necho "cwd=$(pwd) args=$*" >> "${calls}"\n` +
          `[ "$1" = "watch:clean" ] || exit 1\n` +
          `port=$(sed -n 's/^export WATCHER_PORT=//p' .js.env | tail -n 1)\n` +
          `mkdir -p node_modules/expo/bin\n` +
          `exec "${process.execPath}" "$PWD/node_modules/expo/bin/cli" start --port "$port"\n`,
      );
      chmodSync(path.join(bin, 'yarn'), 0o755);
      writeFileSync(
        cli,
        `require('node:http').createServer((q, r) => r.end('packager-status:running')).listen(Number(process.argv[4]), '127.0.0.1');\n`,
      );
    }
    return { root, cli, bin, calls };
  }

  const sidecar = () => fakeSidecar(() => ({ body: sse('No traces found') }));

  test('resets this checkout\'s Metro when .js.env changes', async () => {
    const sidecarPort = await sidecar();
    const metroPort = await freePort();
    const { root, cli, bin, calls } = setup(metroPort);

    // An old Metro for this checkout, holding the port.
    const old = spawn(process.execPath, [cli, 'start', '--port', String(metroPort)], {
      cwd: root,
      stdio: 'ignore',
      detached: true,
    });
    cleanups.push(() => {
      for (const pid of [old.pid, ...listening(metroPort)]) {
        try {
          process.kill(pid, 'SIGKILL');
        } catch {
          // gone
        }
      }
    });
    assert.ok(await waitFor(() => listening(metroPort).includes(old.pid)), 'old Metro never listened');

    const r = await run(['on', '--no-open'], {
      cwd: root,
      env: { SPOTLIGHT_PORT: String(sidecarPort), PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(r.status, 0, r.all);
    assert.match(r.stdout, new RegExp(`metro: stopping pid ${old.pid}`));
    assert.match(r.stdout, /metro: up at/);
    assert.match(r.stdout, /Fully relaunch the app/);
    assert.ok(!alive(old.pid), 'old Metro should be stopped');
    assert.match(readFileSync(calls, 'utf8'), new RegExp(`cwd=${root} args=watch:clean`));
    const now = listening(metroPort);
    assert.equal(now.length, 1);
    assert.notEqual(now[0], old.pid);
  });

  test('refuses to kill a listener that is not this checkout\'s Metro', async () => {
    const sidecarPort = await sidecar();
    const metroPort = await freePort();
    const { root, bin, calls } = setup(metroPort);
    // Looks like a Metro but belongs to another checkout: path lacks this repo root.
    const other = tmpDir();
    const foreign = path.join(other, 'node_modules', 'expo', 'bin', 'cli');
    mkdirSync(path.dirname(foreign), { recursive: true });
    const child = listener(foreign, metroPort, { cwd: other });
    assert.ok(await waitFor(() => listening(metroPort).includes(child.pid)));

    const r = await run(['on', '--no-open', '--restart-metro'], {
      cwd: root,
      env: { SPOTLIGHT_PORT: String(sidecarPort), PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(r.status, 5, r.all);
    assert.match(r.all, /not this checkout's Metro/);
    assert.ok(alive(child.pid), 'the foreign process must not be killed');
    assert.ok(!existsSync(calls), 'yarn must not run when the port is not freed');
  });

  test('--no-metro never touches Metro even when .js.env changed', async () => {
    const sidecarPort = await sidecar();
    const metroPort = await freePort();
    const { root, bin, calls } = setup(metroPort);
    const r = await run(['on', '--no-open', '--no-metro'], {
      cwd: root,
      env: { SPOTLIGHT_PORT: String(sidecarPort), PATH: `${bin}:${process.env.PATH}` },
    });
    assert.equal(r.status, 0, r.all);
    assert.ok(!existsSync(calls));
    assert.match(r.stdout, new RegExp(`Stop any Metro already on :${metroPort}`));
  });
});

/** Where the real sidecar's process lives after `yarn dlx`: under node_modules/@spotlightjs. */
function sidecarFile(dir) {
  const file = path.join(dir, 'node_modules', '@spotlightjs', 'spotlight', 'cli.js');
  mkdirSync(path.dirname(file), { recursive: true });
  return file;
}

describe('spotlight.sh off', { skip: SKIP }, () => {
  test('stops a Spotlight sidecar and verifies the port is free', async () => {
    const dir = tmpDir();
    const port = await freePort();
    const child = listener(sidecarFile(dir), port);
    assert.ok(await waitFor(() => listening(port).includes(child.pid)));
    const r = await run(['off'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 0, r.all);
    assert.match(r.stdout, new RegExp(`sidecar: stopped \\(pid ${child.pid}\\)`));
    assert.deepEqual(listening(port), []);
  });

  test('refuses to kill a process that is not a Spotlight sidecar', async () => {
    const dir = tmpDir();
    const port = await freePort();
    // The path contains the word "spotlight" on purpose: only the package may match.
    const child = listener(path.join(dir, 'my-spotlight-notes-server.js'), port);
    assert.ok(await waitFor(() => listening(port).includes(child.pid)));
    const r = await run(['off'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 2);
    assert.match(r.all, /is not a Spotlight sidecar/);
    assert.ok(alive(child.pid));
  });

  test('fails loudly when a supervisor restarts the sidecar', async () => {
    const dir = tmpDir();
    const port = await freePort();
    const server = sidecarFile(dir);
    writeFileSync(
      server,
      `require('node:http').createServer((q, r) => r.end('ok')).listen(Number(process.argv[2]), '127.0.0.1');\n`,
    );
    // A supervisor loop standing in for a launchd KeepAlive job.
    const sup = spawn(
      'bash',
      ['-c', `while true; do "${process.execPath}" "${server}" ${port}; sleep 0.2; done`],
      { stdio: 'ignore', detached: true },
    );
    cleanups.push(() => {
      try {
        process.kill(-sup.pid, 'SIGKILL');
      } catch {
        // gone
      }
    });
    assert.ok(await waitFor(() => listening(port).length === 1));
    const r = await run(['off'], { env: { SPOTLIGHT_PORT: String(port) } });
    assert.equal(r.status, 7, r.all);
    assert.match(r.all, /listening again as pid/);
    assert.doesNotMatch(r.stdout, /sidecar: stopped/);
  });
});
