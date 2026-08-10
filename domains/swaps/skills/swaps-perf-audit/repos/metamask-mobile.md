---
repo: metamask-mobile
parent: swaps-perf-audit
metadata:
  platform: ios-simulator
  harness: mm-cli
---

# Swaps Performance Audit — MetaMask Mobile (iOS)

Audits the swaps/bridge screen with numbers taken off a running simulator. The
subject is `app/components/UI/Bridge/**` — `BridgeView`, `TokenInputArea`,
`FlipQuoteButton`, `QuoteCountdownTimer`, the token selector, and the keypad.

Read `mms-mobile-visual-testing` for the general `mm` CLI contract; this skill
only adds the swaps-specific environment contract and measurement protocol.

## Scope

- iOS Simulator only. Android is unsupported by the `mm` iOS driver.
- Requires an **expo-dev-client build**. Metro attach and Hermes CDP are how
  counters get read back; a release build has no inspector.
- Preserves installed wallet state. Never pass `--reinstall` or
  `--reset-app-data`.

## Step 1 — Set the environment up, then check it

The audit does not provision anything. Bringing a simulator up is slow, easy to
get half-right, and impossible to do safely on a machine whose devices and
watchers belong to somebody else — so a human sets the environment up once, and
the skill verifies it before measuring anything.

### 1a. Human setup, once per machine

Ask the user to run these if the environment is not already up. Do not run them
on their behalf: each one boots, installs, or attaches something.

```bash
cd <metamask-mobile>

xcrun simctl boot <UDID> && open -a Simulator   # the device holding your wallet
yarn watch                                      # leave it running
yarn install:ios:dev                            # latest iOS dev build
yarn mm launch --device-id <UDID> --metro-port <port>
```

Then, on the simulator: open MetaMask, unlock it, and leave it on the wallet
home. Onboard a wallet first if the device has none.

Four things about that sequence matter enough to repeat:

- **The build must be an expo-dev-client build.** Metro attach and Hermes CDP
  are how counters get read back; a release build has no inspector.
- **Never pass `--reinstall` or `--reset-app-data` to `mm launch`.** They
  destroy the wallet state the audit needs.
- **The first app open compiles the bundle,** which on this project takes
  minutes and looks like a hang. Wait it out. If it never finishes, the usual
  cause is Metro exhausting the V8 heap — restart the watcher with
  `NODE_OPTIONS=--max-old-space-size=8192 yarn watch`.
- **Nobody types the password but the user.** Not this skill, not the scripts.

### 1b. Preflight — the skill's job

```bash
cd <metamask-mobile>

# The script ships inside this skill. Use whichever path your operator
# installed it to — do not confuse it with the repo's own scripts/ directory.
SP=.claude/skills/mms-swaps-perf-audit/scripts/swaps-perf-preflight.sh
# SP=.cursor/rules/mms-swaps-perf-audit/scripts/swaps-perf-preflight.sh
# SP=.agents/skills/mms-swaps-perf-audit/scripts/swaps-perf-preflight.sh

bash "$SP"
```

It is **read-only**. It boots nothing, starts nothing, installs nothing, never
runs `mm launch`, and never touches an existing session. It takes a couple of
seconds and answers exactly one question: may the audit start?

It gates on eight things, in this order:

| # | Gate | Fails when |
|---|---|---|
| 1 | Toolchain (`yarn mm:doctor`, `jq`, `curl`, Node ≥ 22 for `mm cdp`) | a dependency is missing |
| 2 | Exactly one booted iPhone simulator | none is booted, or several are and the target is ambiguous |
| 3 | Metro answering `packager-status:running` | `yarn watch` is not running |
| 4 | MetaMask installed, advertising the `expo-metamask` scheme | missing, or a release build |
| 5 | The app is running and attached to *that* Metro as a debuggable target | the app is closed, or talking to a different bundler |
| 6 | An `mm` session is live and driving the device | no daemon or no session — it prints the exact `mm launch` line |
| 7 | The wallet is unlocked | a lock screen, or any screen it cannot identify |
| 8 | At least one account exists | an empty wallet |

Gates 1–4 are independent, so all four are evaluated and every failure is
reported together; a failure there stops the run before the rest, which would
only produce noise. Gates 5–8 each depend on the one before, so the first
failure stops the run. Every failure names the command that fixes it.

Gate 8 reads `globalThis.__AGENTIC__.listAccounts().length` over `mm cdp`. That
bridge is installed only in `__DEV__` builds
(`app/dev-tools/AgenticService/AgenticService.ts`), so the check doubles as
proof that the build is right and that the Hermes CDP path every counter
readout depends on actually works.

On success it prints the resolved device and port for the rest of the run:

```
SWAPS_PERF_UDID=457B6DC4-5360-4335-BAB5-9681C3333A72
SWAPS_PERF_METRO_PORT=8081
```

Two overrides exist, both for disambiguation only:

| Var | Effect |
|---|---|
| `MM_AUDIT_DEVICE_ID` | Which booted simulator to audit. Required when several are booted. |
| `MM_AUDIT_METRO_PORT` | Which port to expect Metro on. Defaults to `.js.env` `WATCHER_PORT`, else 8081. |

**Do not work around a failing gate.** Each one guards a way for the audit to
produce numbers that look real and are not: a lock screen renders no swaps
components, a detached app answers no CDP, a release build has no inspector,
and a wallet with no accounts cannot reach the swaps screen at all. Report the
failure to the user with the command it printed and stop.

### The one thing preflight cannot check

The `mm` daemon is one-per-git-worktree, binds an OS-assigned port recorded in
`.mm-server`, and permits a single active session. If someone else's session is
live in this worktree, gate 6 passes — the session is real and driving a
device — but the device may not be the one you think, and driving it will
disrupt their run. If the user has more than one audit or visual-testing
session in flight, run from a separate git worktree.

## Step 2 — Navigate to swaps

Check recorded knowledge before discovering the flow by hand:

```bash
yarn mm knowledge-search "swaps"
yarn mm knowledge-sessions
```

Observe before every action; accessibility refs are ephemeral and only
`--testid` (lowercase) plus fresh `eN` refs work on iOS.

```bash
yarn mm describe-screen
```

Preflight already gated on an unlocked wallet, so this should show the wallet
home. If the wallet locked itself since, ask the user to unlock it by hand —
**never assume the password**. Only if they hand you one explicitly:

```bash
yarn mm type --testid login-password-input "<password from the user>"
yarn mm click --testid log-in-button
yarn mm wait-for --testid wallet-swap-button --timeout 20000
```

Open swaps from the wallet home:

```bash
yarn mm click --testid wallet-swap-button
yarn mm wait-for --testid bridge-view-scroll --timeout 20000
yarn mm screenshot --name "swaps-baseline"
```

Test IDs for the swaps screen, from
`tests/selectors/Bridge/QuoteView.selectors.ts` and
`app/components/Views/Wallet/WalletView.testIds.ts`. Area files list the IDs
for their own surfaces:

| Element | Test ID |
|---|---|
| Swap entry (wallet home) | `wallet-swap-button` |
| Swap entry (homepage grid) | `homepage-action-buttons-grid-swap` |
| Swap entry (wallet actions sheet) | `wallet-actions-bottom-sheet-swap-button` |
| Swap entry (token page) | `token-swap-button` |
| Swaps screen root (scroll view) | `bridge-view-scroll` |
| Source token area | `source-token-area` |
| Source amount input | `source-token-area-input` |
| Destination token area | `dest-token-area` |
| Destination amount input | `dest-token-area-input` |
| Source token selector | `select-source-token-selector` |
| Token search input (selector modal) | `bridge-token-search-input` |
| Token list (selector modal) | `bridge-token-list` |
| Keypad delete | `keypad-delete-button` |
| Quote details expander | `rate-arrow-button` |
| Confirm | `bridge-confirm-button` |

Element matching is fuzzy substring matching on accessibility label or
identifier, so prefer these exact IDs over partial strings.

### Navigating to a non-default surface

`bridge-view-scroll` is where every surface starts. Surfaces are grouped by
area; the area files under `references/checks/` list which components to
instrument on each.

| Area | Surface | From the swaps screen, do this | Wait for |
|---|---|---|---|
| swaps-screen | `quote-entry` | already there | `bridge-view-scroll` |
| swaps-screen | `quote-details` | enter an amount, wait for a quote, click `rate-arrow-button` | describe-screen to confirm |
| swaps-screen | `slippage` | click `bridge-slippage-settings-button` | `input-stepper-plus-button` |
| swaps-screen | `trending-tokens` | already there in the zero state, below the inputs | `bridge-trending-tokens-section` |
| swaps-screen | `post-trade` | enter an amount, click `bridge-confirm-button` | describe-screen to confirm |
| asset-picker | `token-list` | click `select-source-token-selector` | `bridge-token-list` |
| asset-picker | `network-filter` | from `token-list`, click `network-pills-more-button` | `network-list-modal-scroll` |
| batch-sell | `batch-sell-token-select` | not recorded | `batch-sell-token-select-token-list` |
| batch-sell | `batch-sell-review` | from token select, click `batch-sell-token-select-next-button` | `batch-sell-review-container` |
| batch-sell | `batch-sell-sheets` | not recorded | — |

Some surfaces need a quote before their entry control exists — `quote-details`
and `post-trade` both require a valid amount and a returned quote, so run
`SWAPS-S1` before trying to reach them.

Where the path is not recorded, discover it with `mm describe-screen` and add
it to this table as part of that audit. Do not take test IDs from `*.test.tsx`
files: most of those are mocks and do not exist at run time. The batch sell IDs
above come from `*.testIds.ts` modules, which are real, but their entry paths
have never been driven.

**`tests/selectors/**` is not a source of truth either.** It is the E2E
selector registry, and it contains IDs that no component applies —
`expand-quote-details` is one, which is why this table used to point at a
control that does not exist. Confirm an ID against `mm describe-screen` output
or a `testID=` in a non-test `.tsx`/`.testIds.ts` file before recording it.

`post-trade` submits a real transaction on whatever network the wallet is on.
Confirm the account and network with the user before driving that surface.

## Step 3 — Audit

Follow the protocol in `references/audit-protocol.md`, using the counter
recipes in `references/instrumentation.md`. In short: sweep statically for
candidates, instrument the candidates, measure fixed scenarios, fix,
re-measure, then revert the instrumentation.

Read `references/checks.md` for how the standard is organised, then the area
file this run is scoped to plus `references/checks/common.md`. Those set the
surfaces, the scenarios and the counters you need. The report must carry a
result for every check in scope, plus whatever the open-ended sweep found, plus
the area it covered.

Rank findings and pick fixes with `mms-performance` — in particular
`references/mm-audit-playbook.md` for the sweep, and the guides it maps to for
each anti-pattern. This skill supplies evidence; that skill supplies judgement.

## Step 4 — Close out

The skill started no watcher, booted no simulator and opened no session, so it
has nothing to tear down: **leave the environment as you found it.** Shutting
down a simulator or a Metro process the user is still working in is a worse
outcome than leaving a session open. If they want the session released, that is
theirs to run:

```bash
yarn mm cleanup --shutdown
```

What the skill *must* clean up is the source tree. Before reporting, confirm
the working tree has no instrumentation left:

```bash
git diff --stat
git diff | grep -n "__mmPerf" && echo "INSTRUMENTATION STILL PRESENT"
```

## Gotchas

- **`--testid` is lowercase.** `--testId` is parsed as a positional target and
  silently hits the wrong element.
- **`--selector` and `--within` are rejected** by the iOS driver even though
  the shared CLI parses them.
- **`mm type` clears the field first** (idb does `cmd+a` → delete → type), so
  measuring "typing" scenarios means one `type` call, not incremental keys.
  For per-keystroke render counts, type single characters in sequence.
- **A fresh simulator has no wallet.** Preflight gate 8 catches this, and
  onboarding is the user's to do. Boot a device that already has a wallet
  instead, and name it with `MM_AUDIT_DEVICE_ID` if several are up.
- **Metro must already be running** before `mm launch --metro-port`; the mm
  workflow is attach-only and never spawns a bundler.
- **Background churn is real.** The swaps screen re-renders from controller
  polling even when idle. That is why every scenario needs an idle baseline
  subtracted from it — see `references/audit-protocol.md`.

## Error recovery

| Error | Meaning and fix |
|---|---|
| `MM_SESSION_ALREADY_RUNNING` | Another mm session owns this worktree. Stop it (`yarn mm cleanup --shutdown`) or use a separate worktree. Do not use `--force` on someone else's session. |
| `MM_DEPENDENCIES_MISSING` | `brew tap facebook/fb && brew install idb-companion && pip3 install fb-idb` |
| `MM_DEVICE_NOT_AVAILABLE` | UDID does not exist or nothing is booted. `xcrun simctl list devices`, then boot one. |
| `MM_INVALID_CONFIG` | No app and no `--app-bundle`, or Metro unreachable on the given port. Check `curl localhost:<port>/status`. |
| `MM_WAIT_TIMEOUT` on `bridge-view-scroll` | The swaps screen did not mount. `describe-screen` to see where the flow actually stopped — often an unlock screen or a network/token-selection modal. |
| `mm cdp` connection refused | The app is not attached to Metro, or the build is a release build. Re-run the preflight: gates 4, 5 and 8 each isolate one of the causes. |
| Preflight gate fails mid-audit | Something changed under you — the wallet auto-locked, Metro died, the app was backgrounded. Re-run the preflight before trusting another number, and discard any measurement taken after the last passing run. |
