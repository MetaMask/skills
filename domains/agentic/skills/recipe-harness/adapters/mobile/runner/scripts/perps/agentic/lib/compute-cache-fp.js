#!/usr/bin/env node
// compute-cache-fp.js — agentic-local native-build fingerprint for the
// shared build cache.
//
// Relation to the project fingerprint:
// The repo-wide `scripts/generate-fingerprint.js` is consumed by EAS Build,
// EAS Update, and the OTA fingerprint guard in
// `docs/nightly-ota-updates.md`. Its `fingerprint.config.js` deliberately
// errs on the side of hashing too much — every local build artifact that
// could conceivably influence the produced binary participates in the key
// so a hash collision can never reuse a build whose inputs we cannot
// vouch for.
//
// `@expo/fingerprint`'s `createFingerprintAsync(projectRoot, options)`
// loads `fingerprint.config.js` and applies caller options with these
// semantics (per `@expo/fingerprint` 0.15.x):
// - `extraSources`: caller OVERRIDES the config's list when set.
// - `ignorePaths`: caller is MERGED with the config's list.
// To stay in sync with future edits to `fingerprint.config.js`, we
// `require()` it directly and spread its lists into our options. Our
// added ignorePaths cover per-worktree dev/build artifacts that don't
// affect binary semantics (compile outputs, IDE state, NDK cache,
// per-machine `.xcode.env.local`).
// Binary-affecting inputs stay hashed for the platform they can affect.
// Platform-specific native dirs are separated so an Android-only generated
// file (for example android/app/google-services.json) does not invalidate
// an iOS simulator build cache, and iOS-only generated state does not
// invalidate Android. Shared native inputs (package/yarn lock, config
// plugins, autolinked native modules, build/setup scripts) still converge
// only when they match.

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const fp = require('@expo/fingerprint');

function parsePlatform(argv) {
  const index = argv.indexOf('--platform');
  const value = index >= 0 ? argv[index + 1] : process.env.RECIPE_HARNESS_PLATFORM;
  if (!value) return null;
  if (value !== 'ios' && value !== 'android') {
    throw new Error(`unknown --platform '${value}' (expected ios|android)`);
  }
  return value;
}

const platform = parsePlatform(process.argv.slice(2));

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function normalizedPackageHash(projectRoot) {
  const file = path.join(projectRoot, 'package.json');
  const pkg = JSON.parse(fs.readFileSync(file, 'utf8'));
  // Yarn scripts are developer ergonomics and do not affect the native binary.
  // In particular, installing/upgrading the harness changes a:* scripts; that
  // must not invalidate a native cache shared by otherwise-identical worktrees.
  delete pkg.scripts;
  const stable = stableStringify(pkg);
  return crypto.createHash('sha1').update(stable).digest('hex');
}

function recomputeHash(sources, projectRoot) {
  const hasher = crypto.createHash('sha1');
  const normalizedPkgHash = normalizedPackageHash(projectRoot);
  const normalizedSources = sources
    .map((source) => ({ ...source }))
    .sort((a, b) => {
      const left = a.type === 'contents' ? a.id : a.filePath;
      const right = b.type === 'contents' ? b.id : b.filePath;
      const leftKey = String(left);
      const rightKey = String(right);
      return leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0;
    });
  for (const source of normalizedSources) {
    if (source.id === 'packageJson:scripts') {
      continue;
    }
    if (source.filePath === 'package.json') {
      source.hash = normalizedPkgHash;
      source.reasons = [...(source.reasons || []), 'normalized package.json without scripts'];
    }
    if (source.hash != null) {
      hasher.update(source.type === 'contents' ? source.id : source.filePath);
      hasher.update(source.hash);
    }
  }
  return hasher.digest('hex');
}
// Import the project's config so future additions to its extraSources
// automatically flow into the agentic fingerprint. Using require here
// (vs. literally copying the list) means a new entry in
// `fingerprint.config.js` cannot silently leave the agentic cache
// behind.
const projectConfig = require('../../../../fingerprint.config.js');

const options = {
  // Inherit the project's extraSources and append the runtime JS bridge
  // source. The bridge is copied into android/ios assets at build time
  // and embedded in the .jsbundle, so its content affects binary output.
  extraSources: [
    ...(projectConfig.extraSources || []),
    {
      type: 'file',
      filePath: 'app/core/InpageBridgeWeb3.js',
      reasons: ['Bundled into the runtime JS — affects binary behaviour.'],
    },
  ],
  // Per-worktree dev/build state that does not influence the produced
  // binary. All are gitignored and regenerated locally; ignoring them
  // lets two slots on the same commit with the same source env share a
  // cached `.app`/`.apk`.
  ignorePaths: [
    'ios/build/**',
    'ios/.xcode.env.local',
    'ios/MetaMask.xcworkspace/xcshareddata/swiftpm/**',
    'ios/**/xcuserdata/**',
    'android/.gradle/**',
    'android/app/.cxx/**',
    'android/app/build/**',
    // Mirror of app/core/InpageBridgeWeb3.js — already tracked via the
    // extraSources entry above; ignore the generated copy so we don't
    // double-count it on rebuild.
    'android/app/src/main/assets/InpageBridgeWeb3.js',
    // Debug preflight runs against Metro. App JS, recipes, and harness scripts
    // are served/read live from the worktree, so changing them must not force a
    // native rebuild. Native-affecting inputs remain covered by Expo's default
    // fingerprint plus projectConfig.extraSources (package/yarn lock, ios/, android/,
    // app config, patches, react-native config, build/setup scripts, etc.).
    'app/**',
    'scripts/perps/agentic/**',
    'tsconfig.json',
    // Podfile.lock can be rewritten by the pod-install step during the build.
    // Key off the source inputs instead (yarn.lock + ios/Podfile) so a freshly
    // built app does not invalidate itself on the next preflight.
    'ios/Podfile.lock',
    'ios/Pods/**',
    // Agent/local state never affects native binaries.
    '.agent/**',
    '.agents/**',
    '.claude/**',
    '.cursor/**',
    'temp/**',
  ],
};

if (platform === 'ios') {
  // iOS simulator builds must not miss cache because Android-only generated
  // files differ between worktrees (for example android/app/google-services.json).
  options.ignorePaths.push('android/**');
}
if (platform === 'android') {
  // Android builds must not miss cache because iOS-only generated Pods,
  // workspaces, or entitlements differ between worktrees.
  options.ignorePaths.push('ios/**');
}

fp.createFingerprintAsync(process.cwd(), options)
  .then((fingerprint) => {
    process.stdout.write(recomputeHash(fingerprint.sources, process.cwd()));
  })
  .catch((err) => {
    process.stderr.write(`compute-cache-fp: ${err.message}\n`);
    process.exit(1);
  });
