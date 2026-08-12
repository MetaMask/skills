#!/usr/bin/env node
//
// analyze-cpuprofile.js — aggregate self/total JS time from a Hermes /
// React Native Release Profiler CPU capture, scoped to the swaps/bridge
// screen tree (app/components/UI/Bridge/** in metamask-mobile).
//
// Read-only: it only reads the profile (and prints/writes a report). It
// never touches a device, Metro, or the repository.
//
// Input (auto-detected):
//   1. Preferred — the Chrome-trace JSON produced by:
//        yarn react-native-release-profiler --local <profile.cpuprofile> \
//          --sourcemap-path <sourcemaps-dir-or-file>
//      i.e. a JSON ARRAY of Begin/End duration events (the "*-converted.json"
//      file). With sourcemaps applied, `args.url`/`args.line`/`args.column`
//      point at ORIGINAL app source, which is what makes swaps-tree scoping
//      possible. Without `--sourcemap-path`, the array still parses, but
//      names/paths stay at the minified-bundle level and almost nothing will
//      match `--scope`.
//   2. Fallback — a raw Hermes `.cpuprofile` (an OBJECT with `samples` and
//      `stackFrames`), i.e. the file before conversion. No sourcemap
//      resolution is attempted in this mode; only usable when the recorded
//      build already preserved readable names/paths (dev-ish bundles).
//
// Usage:
//   node analyze-cpuprofile.js --profile <path> \
//     [--scope <substring>] [--top <n>] [--out <path>] [--json]
//
// Exit code is always 0 on a successful parse (there is nothing to "fail" —
// an empty in-scope result is a valid, reportable finding). Exit 1 on a
// missing/unparseable file.

'use strict';

const fs = require('fs');
const path = require('path');

// Everything owned by the swaps/bridge team in metamask-mobile, mirroring the
// breadth of a CODEOWNERS-style boundary (e.g. `**/bridge/**`,
// `**/bridge-status/**`, `ui/pages/swaps`, `app/scripts/controllers/swaps` in
// metamask-extension's `.github/CODEOWNERS`) rather than just the
// `app/components/UI/Bridge/**` screen tree. Re-verify with
// `find app -type d \( -iname '*bridge*' -o -iname '*swap*' \)` if the tree
// has been restructured since this was written.
const DEFAULT_SCOPE_ROOTS = [
  'components/UI/Bridge',
  'core/redux/slices/bridge',
  'reducers/swaps',
  'selectors/bridgeController',
  'selectors/bridgeStatusController',
  'selectors/featureFlagController/swapsChainValueOrderOverride',
  'core/Engine/controllers/bridge-controller',
  'core/Engine/controllers/bridge-status-controller',
  'core/Engine/messengers/bridge-controller-messenger',
  'core/Engine/messengers/bridge-status-controller-messenger',
  'util/bridge',
  'util/notifications/notification-states/swap-completed',
  'components/UI/MultichainBridgeTransactionListItem',
  'components/UI/HardwareWallet/Swaps',
  'components/Views/confirmations/components/rows/bridge-fee-row',
  'components/Views/confirmations/components/rows/bridge-time-row',
  'components/Views/confirmations/components/activity/transaction-details-bridge-fee-row',
];

function parseArgs(argv) {
  const args = { scope: DEFAULT_SCOPE_ROOTS.join(','), top: 40, json: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--profile') args.profile = argv[++i];
    else if (a === '--scope') args.scope = argv[++i];
    else if (a === '--top') args.top = Number(argv[++i]);
    else if (a === '--out') args.out = argv[++i];
    else if (a === '--json') args.json = true;
    else if (a === '--help' || a === '-h') args.help = true;
  }
  return args;
}

function printHelp() {
  const lines = [];
  for (const line of fs.readFileSync(__filename, 'utf8').split('\n')) {
    if (line.startsWith('#!')) continue; // shebang
    if (!line.startsWith('//')) break; // leading header comment block only
    lines.push(line.replace(/^\/\/ ?/, ''));
  }
  process.stderr.write(lines.join('\n') + '\n');
}

// Ordered, most-specific first. Matched as a substring of the resolved
// source path. Mirrors app/components/UI/Bridge/** in metamask-mobile —
// re-verify against `find app/components/UI/Bridge -maxdepth 2 -type d` if
// that tree has been restructured since this was written.
const AREA_MAP = [
  ['Views/BridgeView', 'Swaps/Bridge screen (BridgeView)'],
  ['components/BridgeTokenSelector', 'Asset picker (token selector modal)'],
  ['components/QuoteSelectorView', 'Quote select screen'],
  ['components/QuoteDetailsRecipientKeyValueRow', 'Quote details card'],
  ['components/QuoteDetailsCard', 'Quote details card'],
  ['components/QuoteCountdownTimer', 'Quote countdown timer'],
  ['components/PostTradeBottomSheet', 'Post-trade modal'],
  ['components/TransactionDetails', 'Post-trade modal'],
  ['Views/BatchSellReview', 'Batch sell \u2014 review'],
  ['Views/BatchSellTokenSelect', 'Batch sell \u2014 token select'],
  ['components/BatchSellDestinationTokenSelectorModal', 'Batch sell \u2014 destination token selector'],
  ['components/BatchSellFinalReviewModal', 'Batch sell \u2014 final review modal'],
  ['components/BatchSellMinimumReceivedInfoModal', 'Batch sell \u2014 info modal'],
  ['components/BatchSellNetworkFeeInfoModal', 'Batch sell \u2014 info modal'],
  ['components/BatchSellPriceImpactInfoModal', 'Batch sell \u2014 info modal'],
  ['components/BatchSellQuoteDetailsModal', 'Batch sell \u2014 quote details modal'],
  ['components/TokenInputArea', 'Token input area'],
  ['components/SwapsKeypad', 'Keypad'],
  ['components/SlippageModal', 'Slippage modal'],
  ['components/FlipQuoteButton', 'Flip quote button'],
  ['components/BlockaidModal', 'Security alert modal'],
  ['components/HighRateAlertModal', 'Security alert modal'],
  ['components/PriceImpactModal', 'Price impact modal'],
  ['components/MissingPriceModal', 'Missing price modal'],
  ['components/TokenWarningModal', 'Token warning modal'],
  ['components/MarketClosedBottomSheets', 'Market closed modal'],
  ['components/RecipientSelectorModal', 'Recipient selector modal'],
  ['components/GaslessQuickPickOptions', 'Gasless quick-pick options'],
  ['components/SwapDiscoveryFeed', 'Swap discovery feed'],
  ['components/BridgeTrendingTokensSection', 'Trending tokens section'],
  ['components/RobinhoodSwapsBanner', 'Robinhood banner'],
  ['components/SwapsConfirmButton', 'Confirm button'],
  ['components/InputStepper', 'Input stepper'],
  ['components/CollapsibleBottomSheet', 'Collapsible bottom sheet'],
  // Swaps/bridge-owned code outside the `components/UI/Bridge` screen tree
  // (redux state, selectors, controller wiring, app-level utils,
  // confirmations rows, notifications). See DEFAULT_SCOPE_ROOTS above.
  ['core/redux/slices/bridge', 'Bridge redux state'],
  ['reducers/swaps', 'Swaps redux state (legacy)'],
  ['selectors/bridgeStatusController', 'Bridge status selectors'],
  ['selectors/bridgeController', 'Bridge controller selectors'],
  ['selectors/featureFlagController/swapsChainValueOrderOverride', 'Swaps feature-flag selectors'],
  ['core/Engine/controllers/bridge-status-controller', 'BridgeStatusController wiring'],
  ['core/Engine/controllers/bridge-controller', 'BridgeController wiring'],
  ['core/Engine/messengers/bridge-status-controller-messenger', 'BridgeStatusController messenger'],
  ['core/Engine/messengers/bridge-controller-messenger', 'BridgeController messenger'],
  ['util/notifications/notification-states/swap-completed', 'Swap-completed notification'],
  ['util/bridge', 'Bridge utils (app-level)'],
  ['components/UI/MultichainBridgeTransactionListItem', 'Multichain bridge tx history item'],
  ['components/UI/HardwareWallet/Swaps', 'Hardware wallet swaps'],
  ['components/Views/confirmations/components/rows/bridge-fee-row', 'Confirmations \u2014 bridge fee row'],
  ['components/Views/confirmations/components/rows/bridge-time-row', 'Confirmations \u2014 bridge time row'],
  [
    'components/Views/confirmations/components/activity/transaction-details-bridge-fee-row',
    'Confirmations \u2014 bridge fee row (tx details)',
  ],
  ['hooks/', 'Bridge hooks'],
  ['utils/', 'Bridge utils'],
];

function areaFor(sourcePath, scopeRoots) {
  if (!sourcePath) return null;
  if (!scopeRoots.some((root) => sourcePath.includes(root))) return null;
  for (let i = 0; i < AREA_MAP.length; i += 1) {
    if (sourcePath.includes(AREA_MAP[i][0])) return AREA_MAP[i][1];
  }
  return 'Bridge (other / unmapped subfolder)';
}

// Best-effort recovery of `(path:line:col)` out of a Hermes-style function
// name when no source map was available to resolve `args.url` properly.
function extractPathFromName(name) {
  if (!name) return null;
  const m = /\(([^()]+):(\d+):(\d+)\)\s*$/.exec(name);
  if (!m) return null;
  return { url: m[1], line: Number(m[2]), column: Number(m[3]) };
}

function newFrame(key, name, url, line, category) {
  return { key, name, url: url || null, line: line || null, category: category || 'unknown', selfMicros: 0, totalMicros: 0, calls: 0 };
}

// --- Path 1: converted Chrome-trace JSON (array of B/E duration events) ---
//
// Produced by `hermes-profile-transformer` via the `react-native-release-profiler`
// CLI. Events are emitted in a strictly nested (LIFO) B/E stream in ts order,
// so a single-pass stack replay recovers both self time (whichever frame is
// on top of the stack between two consecutive events owns that time slice)
// and total/inclusive time (span from a frame's B to its matching E).
function analyzeConverted(events) {
  const frames = new Map();
  const stack = [];
  let lastTs = events.length > 0 ? Number(events[0].ts) : 0;
  const firstTs = lastTs;
  let maxTs = lastTs;

  const keyFor = (ev) => {
    const args = ev.args || {};
    const url = args.url || (extractPathFromName(ev.name) || {}).url || null;
    const line = args.line != null ? Number(args.line) : (extractPathFromName(ev.name) || {}).line || null;
    const name = args.params || ev.name || args.allocatedName || 'anonymous';
    const category = args.node_module || args.allocatedCategory || ev.cat || 'unknown';
    return { key: `${name}::${url || category}::${line || ''}`, name, url, line, category };
  };

  for (const ev of events) {
    const ts = Number(ev.ts);
    const dt = ts - lastTs;
    if (stack.length > 0 && dt > 0) {
      const top = stack[stack.length - 1];
      top.frame.selfMicros += dt;
    }
    lastTs = ts;
    if (ts > maxTs) maxTs = ts;

    if (ev.ph === 'B') {
      const info = keyFor(ev);
      let frame = frames.get(info.key);
      if (!frame) {
        frame = newFrame(info.key, info.name, info.url, info.line, info.category);
        frames.set(info.key, frame);
      }
      stack.push({ frame, beginTs: ts });
    } else if (ev.ph === 'E') {
      const popped = stack.pop();
      if (popped) {
        popped.frame.totalMicros += ts - popped.beginTs;
        popped.frame.calls += 1;
      }
    }
  }

  return { frames, durationMicros: maxTs - firstTs };
}

// --- Path 2: raw Hermes .cpuprofile (samples + stackFrames), no conversion ---
//
// `samples[i].sf` names the leaf stack frame active at sample i; `stackFrames`
// is a flat map with a `parent` pointer per frame. Self time is credited to
// the leaf; total time is credited to every frame on the leaf's ancestor
// chain. No source-map resolution happens here — run the CLI conversion
// first (see skill docs) whenever you have sourcemaps, and reserve this path
// for when you don't.
function analyzeRawHermes(profile) {
  const { samples, stackFrames } = profile;
  const frames = new Map();
  const ancestorCache = new Map();

  const ancestorsOf = (sf) => {
    if (ancestorCache.has(sf)) return ancestorCache.get(sf);
    const chain = [];
    let cur = sf;
    const guard = new Set();
    while (cur != null && stackFrames[cur] && !guard.has(cur)) {
      guard.add(cur);
      chain.push(cur);
      cur = stackFrames[cur].parent;
    }
    ancestorCache.set(sf, chain);
    return chain;
  };

  const frameFor = (sf) => {
    const raw = stackFrames[sf];
    if (!raw) return null;
    const recovered = extractPathFromName(raw.name);
    const url = recovered ? recovered.url : null;
    const line = raw.line != null ? Number(raw.line) : recovered ? recovered.line : null;
    const key = `${raw.name}::${sf}`;
    let frame = frames.get(key);
    if (!frame) {
      frame = newFrame(key, raw.name || 'anonymous', url, line, raw.category);
      frames.set(key, frame);
    }
    return frame;
  };

  let firstTs = null;
  let lastTs = null;
  let prevTs = null;
  for (const sample of samples) {
    const ts = Number(sample.ts);
    if (firstTs === null) firstTs = ts;
    lastTs = ts;
    const dt = prevTs === null ? 0 : Math.max(ts - prevTs, 0);
    prevTs = ts;
    if (dt === 0) continue;

    const leaf = frameFor(sample.sf);
    if (leaf) leaf.selfMicros += dt;

    for (const sf of ancestorsOf(sample.sf)) {
      const frame = frameFor(sf);
      if (frame) {
        frame.totalMicros += dt;
        frame.calls += 1;
      }
    }
  }

  return { frames, durationMicros: (lastTs || 0) - (firstTs || 0) };
}

function loadProfile(profilePath) {
  const raw = fs.readFileSync(profilePath, 'utf8');
  const data = JSON.parse(raw);
  if (Array.isArray(data)) {
    return { format: 'converted', ...analyzeConverted(data) };
  }
  if (data && Array.isArray(data.samples) && data.stackFrames) {
    return { format: 'raw-hermes', ...analyzeRawHermes(data) };
  }
  throw new Error(
    'Unrecognised profile shape: expected either an array of B/E trace events ' +
      '(the "-converted.json" from `yarn react-native-release-profiler`) or a raw ' +
      'Hermes .cpuprofile object with `samples` + `stackFrames`.',
  );
}

function buildReport(analysis, opts) {
  const { frames, durationMicros, format } = analysis;
  const scope = opts.scope;
  const scopeRoots = scope
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const all = Array.from(frames.values());
  for (const f of all) {
    f.area = areaFor(f.url || f.name, scopeRoots);
  }
  all.sort((a, b) => b.selfMicros - a.selfMicros);

  const inScope = all.filter((f) => f.area !== null);
  const outOfScope = all.filter((f) => f.area === null);

  const byArea = new Map();
  for (const f of inScope) {
    if (!byArea.has(f.area)) byArea.set(f.area, { area: f.area, selfMicros: 0, totalMicros: 0, frames: [] });
    const bucket = byArea.get(f.area);
    bucket.selfMicros += f.selfMicros;
    bucket.totalMicros = Math.max(bucket.totalMicros, f.totalMicros);
    bucket.frames.push(f);
  }
  const areas = Array.from(byArea.values()).sort((a, b) => b.selfMicros - a.selfMicros);

  const durationMs = durationMicros / 1000;

  return {
    format,
    scope,
    durationMs,
    durationSeconds: durationMs / 1000,
    totalFrames: all.length,
    inScopeSelfMicros: inScope.reduce((s, f) => s + f.selfMicros, 0),
    outOfScopeSelfMicros: outOfScope.reduce((s, f) => s + f.selfMicros, 0),
    areas,
    topInScope: inScope.slice(0, opts.top),
    topOutOfScope: outOfScope.slice(0, Math.min(10, opts.top)),
  };
}

function ms(micros) {
  return (micros / 1000).toFixed(2);
}

function pct(part, whole) {
  if (!whole) return '0.0';
  return ((part / whole) * 100).toFixed(1);
}

function renderMarkdown(report) {
  const lines = [];
  const scopeRoots = report.scope.split(',').map((s) => s.trim()).filter(Boolean);
  const scopeLabel = scopeRoots.length > 1 ? `${scopeRoots.length} swaps/bridge-owned paths` : scopeRoots[0];
  lines.push(`# CPU profile audit \u2014 scope: ${scopeLabel}`);
  if (scopeRoots.length > 1) {
    lines.push('');
    lines.push('<details><summary>Scope roots</summary>');
    lines.push('');
    for (const r of scopeRoots) lines.push(`- \`${r}\``);
    lines.push('');
    lines.push('</details>');
  }
  lines.push('');
  const totalSelf = report.inScopeSelfMicros + report.outOfScopeSelfMicros;
  lines.push('| Metric | Value |');
  lines.push('|---|---|');
  lines.push(`| Format detected | ${report.format} |`);
  lines.push(`| Capture length | ~${Math.round(report.durationSeconds)}s |`);
  lines.push(`| Distinct frames sampled | ${report.totalFrames} |`);
  lines.push(
    `| Time spent in swaps/bridge | ${ms(report.inScopeSelfMicros)} ms (${pct(report.inScopeSelfMicros, totalSelf)}% of all sampled time) |`,
  );
  lines.push('');
  lines.push('## By area (self time)');
  lines.push('');
  lines.push('| Area | Time (ms) | % of swaps time | # of hot spots |');
  lines.push('|---|---|---|---|');
  const totalInScope = report.inScopeSelfMicros || 1;
  for (const a of report.areas) {
    lines.push(`| ${a.area} | ${ms(a.selfMicros)} | ${pct(a.selfMicros, totalInScope)}% | ${a.frames.length} |`);
  }
  lines.push('');
  lines.push('## Top in-scope frames by self time');
  lines.push('');
  lines.push('| # | Time (ms) | Total (ms) | Calls | Area | Function | Source |');
  lines.push('|---|---|---|---|---|---|---|');
  report.topInScope.forEach((f, i) => {
    const src = f.url ? `${f.url}${f.line ? ':' + f.line : ''}` : '(unsymbolicated)';
    lines.push(`| ${i + 1} | ${ms(f.selfMicros)} | ${ms(f.totalMicros)} | ${f.calls} | ${f.area} | \`${f.name}\` | ${src} |`);
  });
  if (report.topInScope.length === 0) {
    lines.push('| \u2014 | \u2014 | \u2014 | \u2014 | \u2014 | *no frame under this scope matched* | \u2014 |');
  }
  lines.push('');
  // Frames outside `--scope` are deliberately not listed here (not even as
  // context) \u2014 this tool's job is swaps/bridge only. The "% of all sampled
  // time" metric above already tells you how much of the capture they ate.
  return lines.join('\n');
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help || !args.profile) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const profilePath = path.resolve(args.profile);
  if (!fs.existsSync(profilePath)) {
    process.stderr.write(`No such file: ${profilePath}\n`);
    process.exit(1);
  }

  let analysis;
  try {
    analysis = loadProfile(profilePath);
  } catch (e) {
    process.stderr.write(`Failed to parse ${profilePath}: ${e.message}\n`);
    process.exit(1);
  }

  const report = buildReport(analysis, args);

  const output = args.json ? JSON.stringify(report, null, 2) : renderMarkdown(report);
  if (args.out) {
    fs.writeFileSync(path.resolve(args.out), output, 'utf-8');
    process.stderr.write(`Wrote report to ${path.resolve(args.out)}\n`);
  } else {
    process.stdout.write(output + '\n');
  }
}

main();
