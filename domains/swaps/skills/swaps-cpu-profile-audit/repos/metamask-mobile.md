---
repo: metamask-mobile
parent: swaps-cpu-profile-audit
---

# Swaps CPU Profile Audit — MetaMask Mobile

Audits a `.cpuprofile` already captured via
[`docs/readme/release-build-profiler.md`](../../../../../../docs/readme/release-build-profiler.md).
Nothing here touches a device, a simulator, Metro, or an `mm` session — it is
pure file analysis. Subject: `app/components/UI/Bridge/**`.

## Recording (human, not this skill)

Recording a fresh profile is manual, on-device work the user does themselves,
per `docs/readme/release-build-profiler.md`:

1. Build/install an **RC build** (dev builds are not representative).
2. On the device, **shake** → the **Performance Profiler** menu appears.
3. **Start**, reproduce the swaps/bridge flow, **Stop**.
4. iOS: **Export** the file (Share sheet). Android: it lands in Downloads
   automatically.

This skill's job starts once that `.cpuprofile` exists somewhere on disk. If
the user has not recorded one yet, point them at that doc rather than trying
to drive a device yourself.

## Step 1 — Locate the profile and the source maps

Ask for (or find) the `.cpuprofile` path — typically named
`sampling-profiler-trace*.cpuprofile` or similar. Source maps are optional but
the entire point of this skill is scoping findings to
`app/components/UI/Bridge/**`, which needs original file paths — without a
source map, frames stay at the minified-bundle level and almost nothing will
match. If the user doesn't have sourcemaps yet, get them one of two ways:

**From a local RC build (matches the profile exactly, and is what the
Performance Profiler UI itself requires — `METAMASK_ENVIRONMENT=rc`):**

```bash
# iOS — the "Bundle JS Code & Upload Sentry Files" Xcode phase always writes this
yarn build:ios:main:rc
ls -la sourcemaps/ios/index.js.map

# Android — the RN Gradle plugin's Hermes compose step always writes this
# (variant is prodRelease for the `main` flavor)
yarn build:android:main:rc
ls -la android/app/build/generated/sourcemaps/react/prodRelease/index.android.bundle.map
```

**From CI, if the profile came from a CI-built RC instead:** GitHub Actions
artifacts from the `Build Mobile App` (`build.yml`) workflow —
`ios-sourcemaps-main-rc` (contains `index.js.map`) or
`android-sourcemaps-main-rc` (contains `index.android.bundle.map`). Download
and unzip.

Two traps, either of which silently produces an unusable or missing map:

- **A `yarn watch` / Metro dev-server map does not work here.** Metro's
  `/index.map` endpoint (what `react-native-release-profiler`'s
  `--generate-sourcemap` falls back to) serves a **dev** bundle map, which
  does not correctly symbolicate a **release** Hermes profile — different
  minification, different module IDs. Always use the Release/RC-build map
  above, not a running watcher.
- **`yarn gen-bundle:ios` / `gen-bundle:android` do not pass
  `--sourcemap-output`** (as of this writing) — running them produces a
  bundle with no map at all. Don't use them for this.

If no source maps exist at all, proceed anyway (Step 2 is skippable) but say
so explicitly in the final report — the audit becomes best-effort.

## Step 2 — Symbolicate (skip only if already converted, or no sourcemaps)

```bash
cd <metamask-mobile>
yarn react-native-release-profiler --local /path/to/profile.cpuprofile --sourcemap-path /path/to/sourcemaps
```

This writes `<profile>-converted.json` in the current directory — a JSON
**array** of Chrome-trace Begin/End duration events, each carrying
`args.url` / `args.line` / `args.column` resolved to original `app/...`
source when the source map covers that frame. Without `--sourcemap-path`, run
the same command anyway — it still produces a converted JSON, just with
unresolved (minified) names/paths.

## Step 3 — Aggregate with the bundled analyzer

The script ships inside this skill, installed under whichever harness
directory `yarn skills` wrote to. Probe for it rather than hardcoding one
path — which of these exists depends on which harnesses were synced, and
that can differ per directory:

```bash
cd <metamask-mobile>

for AC in \
  .claude/skills/mms-swaps-cpu-profile-audit/scripts/analyze-cpuprofile.cjs \
  .cursor/rules/mms-swaps-cpu-profile-audit/scripts/analyze-cpuprofile.cjs \
  .agents/skills/mms-swaps-cpu-profile-audit/scripts/analyze-cpuprofile.cjs
do
  [ -f "$AC" ] && break
done
if [ ! -f "${AC:-}" ]; then
  echo "analyze-cpuprofile.cjs not found under .claude, .cursor, or .agents." >&2
  echo "Run 'yarn skills' to (re)sync it, then retry." >&2
  exit 1
fi

node "$AC" --profile /path/to/profile-converted.json
```

It is **read-only** — plain Node, no dependencies, no network, no repo
writes — so it needs no sandbox permission beyond reading the profile file
and this repo. It auto-detects the input shape (converted JSON array, or a
raw un-converted `.cpuprofile` object as a fallback) and prints a Markdown
report to stdout: capture duration, a by-area self-time breakdown, and the
top in-scope (`app/components/UI/Bridge/**`) frames. Frames outside that
scope are never itemized — the "Time spent in swaps/bridge" line's
percentage is the only signal about them, on purpose, since this skill's
whole job is staying scoped to swaps. Useful flags:

| Flag | Default | Purpose |
|---|---|---|
| `--scope <substring>` | `components/UI/Bridge` | What counts as "in scope". Rarely needs changing. |
| `--top <n>` | `40` | How many ranked frames to list per section. |
| `--json` | off | Emit the aggregated JSON instead of Markdown (for further scripting). |
| `--out <path>` | stdout | Write the report to a file instead of printing it. |

The report header prints the capture's actual duration as a plain value in
the "Metric | Value" table — no ideal/minimum comparison for now, just the
raw timing:

```
| Metric | Value |
|---|---|
| Capture length | ~10s |
```

Use judgment on whether that duration looks long enough to cover the full
swaps/bridge journey (quote fetch, screen transitions, animations) and say
so in Step 6 (confidence) if it looks short.

Read the Markdown report yourself before writing the final audit — it is raw
aggregated data, not the finished analysis. Step 4 below is where the actual
audit work happens.

### Optional: one-shot wrapper (`scripts/run.sh`)

If the input is an archive (a zipped sourcemaps CI artifact, or a bundle
containing the `.cpuprofile` alongside other files) or you'd simply rather
not run Steps 2–3 by hand, `scripts/run.sh` (next to `analyze-cpuprofile.cjs`
in this skill) does the whole staging → convert → aggregate pipeline in one
call. Every file it extracts, converts, or writes (staged input, extracted
archives, the `*-converted.json`, the final report) goes under a throwaway
run folder created **inside the metamask-mobile repo itself**
(`<repo>/.mms-swaps-cpu-audit-run.XXXXXX/`), which is deleted automatically
when the script exits — success, failure, or interrupted — so nothing is
left on disk afterwards and there is no manual cleanup step. (An earlier
version of this script staged everything under the OS tmp directory instead;
that made `yarn --cwd <repo> react-native-release-profiler` resolve
Corepack's pinned Yarn version inconsistently, since Corepack determines the
version from the `packageManager` field by walking up from the shell's
actual cwd, not from `--cwd`. Anchoring the run folder inside the repo, and
always invoking `yarn` with the repo as cwd, avoids that.)

```bash
for RC in \
  .claude/skills/mms-swaps-cpu-profile-audit/scripts/run.sh \
  .cursor/rules/mms-swaps-cpu-profile-audit/scripts/run.sh \
  .agents/skills/mms-swaps-cpu-profile-audit/scripts/run.sh
do
  [ -f "$RC" ] && break
done

bash "$RC" \
  --repo <metamask-mobile> \
  --profile /path/to/profile.cpuprofile-or-converted.json-or-archive.zip \
  --sourcemaps /path/to/sourcemaps-dir-or.zip   # optional
```

It prints the same Markdown report `analyze-cpuprofile.cjs` would produce
directly, so Step 4 below still applies unchanged — by the time it returns,
its run folder has already been removed.

## Step 4 — Area map (how self time attributes to a swaps surface)

The analyzer buckets any in-scope frame by matching its resolved source path
against `app/components/UI/Bridge/**` subfolders, most-specific first. This
mirrors the directory as of the time this was written — re-run
`find app/components/UI/Bridge -maxdepth 2 -type d` if it looks stale, and
update `AREA_MAP` in the script if the tree has been restructured:

| Path fragment | Reported area | User-facing surface |
|---|---|---|
| `Views/BridgeView` | Swaps/Bridge screen (BridgeView) | Main swaps screen |
| `components/BridgeTokenSelector` | Asset picker (token selector modal) | Asset picker |
| `components/QuoteSelectorView` | Quote select screen | Quote select screen |
| `components/QuoteDetailsCard`, `QuoteDetailsRecipientKeyValueRow` | Quote details card | Quote select screen |
| `components/QuoteCountdownTimer` | Quote countdown timer | Quote select screen |
| `components/PostTradeBottomSheet`, `components/TransactionDetails` | Post-trade modal | Post-trade modal |
| `Views/BatchSellReview` | Batch sell — review | Batch sell |
| `Views/BatchSellTokenSelect` | Batch sell — token select | Batch sell |
| `components/BatchSell*Modal` | Batch sell — \<modal\> | Batch sell |
| `components/TokenInputArea` | Token input area | Main swaps screen |
| `components/SwapsKeypad` | Keypad | Main swaps screen |
| `components/SlippageModal` | Slippage modal | Slippage modal |
| `components/BlockaidModal`, `HighRateAlertModal`, `PriceImpactModal`, `MissingPriceModal`, `TokenWarningModal`, `MarketClosedBottomSheets` | \<respective\> modal | Warning/alert modals |
| `hooks/` | Bridge hooks | (cross-cutting — attribute to whichever screen calls the hook) |
| `utils/` | Bridge utils | (cross-cutting) |
| anywhere else under `Bridge/` | Bridge (other / unmapped subfolder) | Unmapped — read the file to place it |

Frames under `hooks/` or `utils/` are cross-cutting: the analyzer buckets
them into "Bridge hooks"/"Bridge utils" rather than a specific screen, so
when one shows up hot, check its call sites (`grep -rn "useTheHookName("
app/components/UI/Bridge`) to say which screen actually pays for it in the
report.

## Step 5 — Diagnose and propose fixes

For every in-scope hot frame, read the actual source at `file:line` (and its
immediate call site) before writing a finding — self/total time tells you
*where*, not *why*. Match what you read against the `performance` skill's
verified anti-pattern catalogue and cite its fix recipe rather than
improvising:

| Symptom in the code | Guide |
|---|---|
| Selector returns a new array/object/identity, or mutates | `mm-selector-memoization.md` |
| Hook builds a fresh array/object/function and returns it without `useMemo`/`useCallback` | `mm-unstable-hook-return.md` |
| `useSelector(x, isEqual)` band-aid, inline `useSelector(state => state.x)` | `mm-redux-antipatterns.md` |
| `Context.Provider value={{...}}` inline object | `mm-context-performance.md` |
| `JSON.stringify` in a `useEffect`/`useMemo` dependency array | `mm-hook-dependency-arrays.md` |
| Screen/modal fetches everything on mount instead of what's visible | `mm-eager-work-on-mount.md` |
| `FlatList`/`ScrollView` rendering a growing list without perf props | `js-lists-flatlist-flashlist.md` |
| `useNativeDriver: false` animating layout properties | `mm-layout-animations.md` |

These guides live in the `performance` skill
(`domains/performance/skills/performance/references/`) — read the specific
guide before proposing the fix in your report, don't just cite the filename.

## Worked example

```bash
$ yarn react-native-release-profiler --local ~/Downloads/sampling-profiler-trace-1699999999.cpuprofile \
    --sourcemap-path ~/Downloads/ios-sourcemaps-main-rc
Successfully converted to Chrome tracing format and pulled the file to ./sampling-profiler-trace-1699999999-converted.json

$ node .agents/skills/mms-swaps-cpu-profile-audit/scripts/analyze-cpuprofile.cjs \
    --profile ./sampling-profiler-trace-1699999999-converted.json
# CPU profile audit — scope: `components/UI/Bridge`

| Metric | Value |
|---|---|
| Format detected | converted |
| Capture length | ~5s |
| Distinct frames sampled | 42 |
| Time spent in swaps/bridge | 1234.56 ms (82.3% of all sampled time) |

## By area (self time)
| Area | Time (ms) | % of swaps time | # of hot spots |
|---|---|---|---|
| Quote select screen | 612.40 | 41.2% | 6 |
| Asset picker (token selector modal) | 398.10 | 26.8% | 4 |
...
```

This raw table is aggregated data, not the finished audit — read it, then
open the top frame in "Quote select screen" (say,
`app/components/UI/Bridge/components/QuoteSelectorView/index.tsx:88`), read
what it's actually doing, and turn it into a plain-language row in the final
report's probable-cause/fix table (see `skill.md`'s Output format; the
`Metric`/`By area` tables above are reused as-is in the final report):

| Screen | Probable cause | Fix |
|---|---|---|
| Quote select screen | Re-sorts the entire quote list every time the screen re-renders — sort comparator is inline and not memoized — 612ms, 6x, `QuoteSelectorView/index.tsx:88` | Wrap in `useMemo` keyed on the quote list identity (see `mm-unstable-hook-return.md` if the list itself has no stable reference either) |
