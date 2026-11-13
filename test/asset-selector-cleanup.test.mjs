import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs';
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
    path.join(repo, 'app/selectors/portfolio.ts'),
    "import { walletBalance } from './wallet';\n\nexport const portfolioBalance = walletBalance;\n",
  );
  writeFileSync(
    path.join(repo, 'app/pages/activity.tsx'),
    "import { selectTokens } from '../selectors/assets/assets-migration';\n\nexport const useActivity = () => selectTokens;\n",
  );
  writeFileSync(
    path.join(repo, 'app/pages/home.tsx'),
    "import { walletBalance } from '../selectors/wallet';\n\nexport const useHome = () => walletBalance;\n",
  );
  writeFileSync(
    path.join(repo, 'app/pages/portfolio.tsx'),
    "import { portfolioBalance } from '../selectors/portfolio';\n\nexport const usePortfolio = () => portfolioBalance;\n",
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

test('ripgrep is available wherever the behavioral suite runs', () => {
  if (process.env.CI && !rgAvailable) {
    throw new Error('ripgrep (rg) is missing in CI; the behavioral tests silently skipped');
  }
});

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
      try {
        const { result, baseline } = runBaseline(repo, outsideDir);
        assert.match(result.stdout, /repo: metamask-mobile @ [0-9a-f]{7,}/);
        assert.match(result.stdout, /root: app\/selectors\/assets\/assets-migration\.ts/);
        assert.match(result.stdout, /remaining: 5 files \(terminal 3, non-terminal 2,/);
        assert.ok(result.stdout.includes(`baseline: ${baseline}`), result.stdout);
        const summary = JSON.parse(readFileSync(baseline, 'utf8'));
        assert.equal(summary.schemaVersion, 3);
        assert.equal(summary.status, 'ok');
        assert.equal(summary.remaining.files, 5);
        assert.deepEqual(
          summary.files.map((file) => file.path).sort(),
          [
            'app/pages/activity.tsx',
            'app/pages/home.tsx',
            'app/pages/portfolio.tsx',
            'app/selectors/portfolio.ts',
            'app/selectors/wallet.ts',
          ],
        );
        const portfolioPage = summary.files.find(
          (file) => file.path === 'app/pages/portfolio.tsx',
        );
        assert.equal(portfolioPage.layer, 4);
        assert.deepEqual(portfolioPage.migrationSelectors, ['selectBalance']);
        const sidecar = JSON.parse(readFileSync(`${baseline}.meta.json`, 'utf8'));
        assert.equal(sidecar.repoId, 'mobile');
        assert.equal(sidecar.repoRoot, realpathSync(repo));
        assert.match(sidecar.head, /^[0-9a-f]{40}$/);
        assert.equal(
          spawnSync('git', ['-C', repo, 'status', '--porcelain'], { encoding: 'utf8' }).stdout,
          '',
          'the trace must not dirty the working tree',
        );
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
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
      try {
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
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify resolves relative --expect-file and --baseline values against the current directory',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      try {
        const { baseline } = runBaseline(repo, outsideDir);
        writeFileSync(path.join(repo, 'app/pages/local.ts'), 'export const selectTokens = () => null;\n');
        writeFileSync(
          path.join(repo, 'app/pages/activity.tsx'),
          "import { selectTokens } from './local';\n\nexport const useActivity = () => selectTokens;\n",
        );
        const pages = path.join(repo, 'app/pages');
        const result = runScript(
          'verify.mjs',
          ['--baseline', path.relative(pages, baseline), '--expect-file', path.join(repo, 'app/pages/activity.tsx'), '--out-dir', outsideDir],
          pages,
        );
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /verdict: PASS/);
        assert.match(result.stdout, /app\/pages\/activity\.tsx \(expected\)/);
        assert.match(result.stdout, /warnings: none/);
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
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
      try {
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
        rmSync(outsideDir, { recursive: true, force: true });
      }
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
      try {
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
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify rejects an --expect-selector the baseline never carried',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      try {
        const { baseline } = runBaseline(repo, outsideDir);
        writeFileSync(path.join(repo, 'app/pages/local.ts'), 'export const selectTokens = () => null;\n');
        writeFileSync(
          path.join(repo, 'app/pages/activity.tsx'),
          "import { selectTokens } from './local';\n\nexport const useActivity = () => selectTokens;\n",
        );
        const result = runScript(
          'verify.mjs',
          ['--baseline', baseline, '--expect-selector', 'app/pages/activity.tsx:selectBalanse', '--out-dir', outsideDir],
          repo,
        );
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout, /verdict: FAIL/);
        assert.match(result.stdout, /app\/pages\/activity\.tsx did not carry migration selector selectBalanse in the baseline/);
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify fails on a new broad import and on a new legacy flow',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      try {
        const { baseline } = runBaseline(repo, outsideDir);
        writeFileSync(
          path.join(repo, 'app/pages/activity.tsx'),
          "import { selectBalance, selectTokens } from '../selectors/assets/assets-migration';\nimport * as legacy from '../selectors/assets/assets-migration';\n\nexport const useActivity = () => selectTokens + selectBalance + String(legacy);\n",
        );
        const result = runScript('verify.mjs', ['--baseline', baseline, '--out-dir', outsideDir], repo);
        assert.equal(result.status, 1, result.stdout + result.stderr);
        assert.match(result.stdout, /verdict: FAIL/);
        assert.match(result.stdout, /new legacy flow: app\/pages\/activity\.tsx now also carries selectBalance/);
        assert.match(result.stdout, /new broad import: app\/pages\/activity\.tsx now imports the module via "\(default or \*\)"|new broad import: app\/pages\/activity\.tsx now imports the module via "\* as legacy"/);
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'verify rejects a malformed --expect-selector and warns when the tree moved past the baseline',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture();
    try {
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      try {
        const { baseline } = runBaseline(repo, outsideDir);
        const malformed = runScript('verify.mjs', ['--baseline', baseline, '--expect-selector', 'app/pages/activity.tsx', '--out-dir', outsideDir], repo);
        assert.equal(malformed.status, 2);
        assert.match(malformed.stderr, /--expect-selector must be <path>:<migration-selector>/);

        writeFileSync(path.join(repo, 'app/pages/local.ts'), 'export const selectTokens = () => null;\n');
        writeFileSync(
          path.join(repo, 'app/pages/activity.tsx'),
          "import { selectTokens } from './local';\n\nexport const useActivity = () => selectTokens;\n",
        );
        const git = (...args) =>
          execFileSync('git', ['-C', repo, '-c', 'commit.gpgsign=false', ...args], { stdio: 'pipe' });
        git('add', '-A');
        git('-c', 'user.name=Test', '-c', 'user.email=test@example.invalid', 'commit', '--quiet', '-m', 'migrate activity');
        const result = runScript(
          'verify.mjs',
          ['--baseline', baseline, '--expect-file', 'app/pages/activity.tsx', '--out-dir', outsideDir],
          repo,
        );
        assert.equal(result.status, 0, result.stdout + result.stderr);
        assert.match(result.stdout, /warnings \(1\):\s*\n\s*baseline HEAD [0-9a-f]+ differs from current HEAD/);
        assert.match(result.stdout, /verdict: PASS/);
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'documents the same-layer lazy-seed gap pinned in references/tooling.md',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture('metamask-mobile-seeds-');
    try {
      writeFileSync(
        path.join(repo, 'app/selectors/a.ts'),
        "import { selectTokens } from './assets/assets-migration';\nimport { zBalance } from './z';\n\nexport const aTokens = selectTokens;\nexport const aBalance = zBalance;\n",
      );
      writeFileSync(
        path.join(repo, 'app/selectors/z.ts'),
        "import { selectBalance } from './assets/assets-migration';\n\nexport const zBalance = selectBalance;\n",
      );
      writeFileSync(
        path.join(repo, 'app/pages/a-page.tsx'),
        "import { aBalance } from '../selectors/a';\n\nexport const useAPage = () => aBalance;\n",
      );
      writeFileSync(
        path.join(repo, 'app/pages/z-page.tsx'),
        "import { zBalance } from '../selectors/z';\n\nexport const useZPage = () => zBalance;\n",
      );
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      try {
        const { baseline } = runBaseline(repo, outsideDir);
        const summary = JSON.parse(readFileSync(baseline, 'utf8'));
        const paths = summary.files.map((file) => file.path);
        assert.ok(paths.includes('app/selectors/a.ts'), 'a.ts should be traced');
        assert.ok(paths.includes('app/selectors/z.ts'), 'z.ts should be traced');
        assert.ok(paths.includes('app/pages/z-page.tsx'), 'z-page should be traced');
        assert.ok(
          !paths.includes('app/pages/a-page.tsx'),
          'a-page.tsx is a known discovery miss (references/tooling.md, lazy seed index); if upstream fixed it, update the doc',
        );
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test(
  'documents the index-module importer gap pinned in references/tooling.md',
  { skip: !rgAvailable && 'ripgrep not installed' },
  () => {
    const repo = buildFixture('metamask-mobile-index-');
    try {
      mkdirSync(path.join(repo, 'app/selectors/bridge'), { recursive: true });
      writeFileSync(
        path.join(repo, 'app/selectors/bridge/index.ts'),
        "import { selectBalance } from '../assets/assets-migration';\n\nexport const selectIsBridgeEnabled = selectBalance;\n",
      );
      writeFileSync(
        path.join(repo, 'app/pages/bridge-badge.tsx'),
        "import { selectIsBridgeEnabled } from '../selectors/bridge';\n\nexport const useBridgeBadge = () => selectIsBridgeEnabled;\n",
      );
      writeFileSync(
        path.join(repo, 'app/selectors/bridge-badge.ts'),
        "import { selectIsBridgeEnabled } from './bridge';\n\nexport const useBridgeBadgeSameTree = () => selectIsBridgeEnabled;\n",
      );
      const outsideDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
      try {
        const { baseline } = runBaseline(repo, outsideDir);
        const summary = JSON.parse(readFileSync(baseline, 'utf8'));
        const paths = summary.files.map((file) => file.path);
        assert.ok(paths.includes('app/selectors/bridge/index.ts'), 'bridge/index.ts should be traced');
        for (const missed of ['app/pages/bridge-badge.tsx', 'app/selectors/bridge-badge.ts']) {
          assert.ok(
            !paths.includes(missed),
            `${missed} is a known discovery miss (references/tooling.md, /index importers); if upstream fixed it, update the doc`,
          );
        }
      } finally {
        rmSync(outsideDir, { recursive: true, force: true });
      }
    } finally {
      rmSync(repo, { recursive: true, force: true });
    }
  },
);

test('repo detection errors are explicit, with and without an override', () => {
  const repo = buildFixture('plain-project-', 'git@github.com:acme/widget.git');
  try {
    const outDir = mkdtempSync(path.join(tmpdir(), 'asset-selector-out-'));
    try {
      const result = runScript('baseline.mjs', ['--out-dir', outDir], repo);
      assert.equal(result.status, 2);
      assert.match(result.stderr, /Could not tell whether/);
      const forced = runScript('baseline.mjs', ['--repo', 'extension', '--out-dir', outDir], repo);
      assert.equal(forced.status, 2);
      assert.match(forced.stderr, /Root file shared\/lib\/selectors\/assets-migration\.ts not found/);
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
});

test('vendored scripts stay byte-identical to the recorded checksums', () => {
  const recorded = JSON.parse(
    readFileSync(path.join(skill, 'references/vendored-checksums.json'), 'utf8'),
  );
  const names = Object.keys(recorded);
  assert.deepEqual(names, [
    'classify-file.js',
    'discover-assets-controllers-roots.js',
    'find-importers.js',
    'list-exports.js',
    'migration-seeds.js',
    'package.json',
    'selector-deps.js',
    'summary.js',
    'tooling.test.js',
    'trace-usage.js',
  ]);
  for (const name of names) {
    const actual = createHash('sha256')
      .update(readFileSync(path.join(scripts, name)))
      .digest('hex');
    assert.equal(
      actual,
      recorded[name],
      `${name} drifted from the vendored copy; re-vendor it and update references/vendored-checksums.json`,
    );
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
      assert.ok(existsSync(path.join(installed, 'scripts/baseline.mjs')));
      assert.ok(existsSync(path.join(installed, 'scripts/trace-usage.js')));
      assert.ok(existsSync(path.join(installed, `scripts/config.${repo}.json`)));
      assert.ok(existsSync(path.join(installed, 'references/tooling.md')));
      assert.ok(existsSync(path.join(installed, 'references/vendored-checksums.json')));
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
