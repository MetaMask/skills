import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';

const root = fileURLToPath(new URL('..', import.meta.url));
const skill = path.join(root, 'domains/assets/skills/asset-selector-cleanup');
const scripts = path.join(skill, 'scripts');
const rgAvailable = spawnSync('rg', ['--version']).status === 0;

function buildFixture(prefix = 'metamask-mobile-', remote = 'git@github.com:MetaMask/metamask-mobile.git') {
  const repo = mkdtempSync(path.join(tmpdir(), prefix));
  const git = (...args) =>
    execFileSync('git', ['-C', repo, '-c', 'commit.gpgsign=false', ...args], {
      stdio: 'pipe',
    });
  git('init', '--quiet');
  git('remote', 'add', 'origin', remote);
  mkdirSync(path.join(repo, 'app/selectors/assets'), { recursive: true });
  mkdirSync(path.join(repo, 'app/pages'), { recursive: true });
  writeFileSync(
    path.join(repo, 'app/selectors/assets/assets-migration.ts'),
    'export const selectTokens = () => null;\nexport const selectBalance = () => null;\n',
  );
  writeFileSync(
    path.join(repo, 'app/selectors/wallet.ts'),
    "import { selectBalance } from './assets/assets-migration';\n\nexport const walletBalance = selectBalance;\n",
  );
  writeFileSync(
    path.join(repo, 'app/pages/activity.tsx'),
    "import { selectTokens } from '../selectors/assets/assets-migration';\n\nexport const useActivity = () => selectTokens;\n",
  );
  writeFileSync(
    path.join(repo, 'app/pages/home.tsx'),
    "import { walletBalance } from '../selectors/wallet';\n\nexport const useHome = () => walletBalance;\n",
  );
  git('add', '.');
  git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'fixture');
  return repo;
}

function runScript(name, args, cwd) {
  return spawnSync(process.execPath, [path.join(scripts, name), ...args], {
    cwd,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });
}

function runBaseline(repo, outDir) {
  const baseline = path.join(outDir, 'baseline.json');
  const result = runScript('baseline.mjs', ['--save', baseline, '--out-dir', outDir], repo);
  assert.equal(result.status, 0, result.stderr);
  return { result, baseline };
}

test(
  'vendored trace tooling self-test passes from the skill bundle',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const result = spawnSync(process.execPath, ['--test', path.join(scripts, 'tooling.test.js')], {
      encoding: 'utf8',
      maxBuffer: 32 * 1024 * 1024,
    });
    assert.equal(result.status, 0, result.stdout + result.stderr);
  },
);

test(
  'baseline detects the repo, writes outside it, and reports the remaining importers',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      const { result, baseline } = runBaseline(repo, outsideDir);
      assert.match(result.stdout, /repo: metamask-mobile @ [0-9a-f]{7,}/);
      assert.match(result.stdout, /root: app\/selectors\/assets\/assets-migration\.ts/);
      assert.match(result.stdout, /remaining: 3 files \(terminal 2, non-terminal 1,/);
      assert.ok(result.stdout.includes(`baseline: ${baseline}`), result.stdout);
      const summary = JSON.parse(readFileSync(baseline, 'utf8'));
      assert.equal(summary.schemaVersion, 3);
      assert.equal(summary.status, 'ok');
      assert.equal(summary.remaining.files, 3);
      assert.deepEqual(
        summary.files.map((file) => file.path).sort(),
        ['app/pages/activity.tsx', 'app/pages/home.tsx', 'app/selectors/wallet.ts'],
      );
      assert.equal(
        spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' }).stdout,
        '',
        'the trace must not dirty the working tree',
      );
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify passes when the expected file drops out and nothing else regressed',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      const { baseline } = runBaseline(repo, outsideDir);
      writeFileSync(path.join(repo, 'app/pages/local.ts'), 'export const selectTokens = () => null;\n');
      writeFileSync(
        path.join(repo, 'app/pages/activity.tsx'),
        "import { selectTokens } from './local';\n\nexport const useActivity = () => selectTokens;\n",
      );
      const result = runScript('verify.mjs', ['--baseline', baseline, '--expect-file', 'app/pages/activity.tsx', '--out-dir', outsideDir], repo);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /verdict: PASS/);
      assert.match(result.stdout, /removed \(1\):\s*\n\s*app\/pages\/activity\.tsx \(expected\)/);
      assert.match(result.stdout, /violations: none/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify fails on a still-remaining expected file and on a new dependent',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      const { baseline } = runBaseline(repo, outsideDir);
      writeFileSync(
        path.join(repo, 'app/pages/evil.tsx'),
        "import { selectBalance } from '../selectors/assets/assets-migration';\n\nexport const useEvil = () => selectBalance;\n",
      );
      const result = runScript('verify.mjs', ['--baseline', baseline, '--expect-file', 'app/pages/home.tsx', '--out-dir', outsideDir], repo);
      assert.equal(result.status, 1, result.stdout + result.stderr);
      assert.match(result.stdout, /verdict: FAIL/);
      assert.match(result.stdout, /app\/pages\/home\.tsx is still remaining/);
      assert.match(result.stdout, /new dependent: app\/pages\/evil\.tsx/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify supports partial removal through --expect-selector while the file stays',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      writeFileSync(
        path.join(repo, 'app/pages/activity.tsx'),
        "import { selectBalance, selectTokens } from '../selectors/assets/assets-migration';\n\nexport const useActivity = () => selectTokens + selectBalance;\n",
      );
      const { baseline } = runBaseline(repo, outsideDir);
      writeFileSync(
        path.join(repo, 'app/pages/activity.tsx'),
        "import { selectTokens } from '../selectors/assets/assets-migration';\n\nexport const useActivity = () => selectTokens;\n",
      );
      const result = runScript('verify.mjs', ['--baseline', baseline, '--expect-selector', 'app/pages/activity.tsx:selectBalance', '--out-dir', outsideDir], repo);
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.match(result.stdout, /verdict: PASS/);
      assert.match(result.stdout, /app\/pages\/activity\.tsx \(-selectBalance\)/);
      assert.match(result.stdout, /removed: none/);
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test('repo detection errors are explicit, with and without an override', () => {
  const repo = buildFixture('plain-project-', 'git@github.com:acme/widget.git');
  try {
    const outDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
    const result = runScript('baseline.mjs', ['--out-dir', outDir], repo);
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Could not tell whether/);
    const forced = runScript('baseline.mjs', ['--repo', 'extension', '--out-dir', outDir], repo);
    assert.equal(forced.status, 2);
    assert.match(forced.stderr, /Root file shared\/lib\/selectors\/assets-migration\.ts not found/);
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('installs into both repos with the matching overlay and scripts', () => {
  for (const repo of ['metamask-extension', 'metamask-mobile']) {
    const target = mkdtempSync(path.join(tmpdir(), `skills-target-${repo}-`));
    try {
      execFileSync(
        'bash',
        [
          path.join(root, 'tools/install'),
          '--source',
          root,
          '--target',
          target,
          '--repo',
          repo,
          '--domain',
          'none',
          '--include',
          'asset-selector-cleanup',
        ],
        { stdio: 'pipe' },
      );
      const installed = path.join(target, '.agents/skills/mms-asset-selector-cleanup');
      const body = readFileSync(path.join(installed, 'SKILL.md'), 'utf8');
      assert.ok(existsSync(path.join(installed, 'scripts/verify.mjs')));
      assert.ok(existsSync(path.join(installed, 'scripts/trace-usage.js')));
      assert.ok(existsSync(path.join(installed, `scripts/config.${repo}.json`)));
      assert.ok(existsSync(path.join(installed, 'references/tooling.md')));
      if (repo === 'metamask-extension') {
        assert.ok(body.includes('Root selector module: `shared/lib/selectors/assets-migration.ts` (config: `scripts/config.metamask-extension.json`)'), 'extension overlay merged');
        assert.match(body, /yarn lint:changed:fix/);
        assert.doesNotMatch(body, /yarn lint:fix\b/);
      } else {
        assert.ok(body.includes('Root selector module: `app/selectors/assets/assets-migration.ts` (config: `scripts/config.metamask-mobile.json`)'), 'mobile overlay merged');
        assert.match(body, /yarn lint:fix\b/);
        assert.doesNotMatch(body, /yarn lint:changed:fix/);
      }
    } finally {
      rmSync(target, { recursive: true, force: true });
    }
  }
});
