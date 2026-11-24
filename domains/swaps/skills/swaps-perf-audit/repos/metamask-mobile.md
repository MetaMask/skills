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

# The script ships inside this skill, installed under whichever harness
# directory `yarn skills` wrote to — do not confuse it with the repo's own
# scripts/ directory. Which of these exists depends on which harnesses were
# synced, and that can differ per directory, so probe instead of guessing one:
for SP in \
  .claude/skills/mms-swaps-perf-audit/scripts/swaps-perf-preflight.sh \
  .cursor/rules/mms-swaps-perf-audit/scripts/swaps-perf-preflight.sh \
  .agents/skills/mms-swaps-perf-audit/scripts/swaps-perf-preflight.sh
do
  [ -f "$SP" ] && break
done
if [ ! -f "${SP:-}" ]; then
  echo "swaps-perf-preflight.sh not found under .claude, .cursor, or .agents." >&2
  echo "Run 'yarn skills' to (re)sync it, then retry." >&2
  exit 1
fi

bash "$SP"
```

Never hardcode one of those three paths and stop if it is missing — that is
what produces the "isn't at the .agents/skills path, let me check other
locations" hunt-and-guess loop. Probe all of them in one shot as above, and if
none exist the skill is not synced into this repo at all; tell the user to run
`yarn skills` rather than searching further.

**Run it unsandboxed.** It is **read-only** — it boots nothing, starts
nothing, installs nothing, never runs `mm launch`, and never touches an
existing session — so a restricted/sandboxed shell buys no safety here and
only costs false failures. The gates shell out to `xcrun simctl`, `idb`,
`lsof`, and `curl` against `localhost` (Metro, the inspector), which a default
agent sandbox commonly blocks or partially blocks; a blocked syscall then
reads as a failed gate even though nothing is actually wrong. Invoke it with
full/unrestricted permissions:

- Cursor: pass `required_permissions: ["all"]` on the `Shell` tool call (or
  the equivalent "run outside the sandbox" option in your harness).
- If a run fails and the output looks like a permission or sandbox denial
  rather than one of the named gates below, re-run once, unsandboxed, before
  reporting it as a real failure.

It takes a couple of seconds and answers exactly one question: may the audit
start?

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

**Do not work around a failing gate, and do not attempt to resolve it
yourself.** Each one guards a way for the audit to produce numbers that look
real and are not: a lock screen renders no swaps components, a detached app
answers no CDP, a release build has no inspector, and a wallet with no
accounts cannot reach the swaps screen at all. Report the failure to the user
with the command it printed, then terminate the session. Fixing the
environment (booting a device, restarting Metro, installing a build, unlocking
the wallet, and so on) is the user's to do, never the skill's.

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
yarn mm wait-for --testid tab-bar-item-Trade --timeout 20000
```

Open swaps from the wallet home's **Trade** tab (bottom nav) — verified live
against a running dev build:

```bash
yarn mm click --testid tab-bar-item-Trade
yarn mm wait-for --testid wallet-actions-bottom-sheet-swap-button --timeout 10000
yarn mm click --testid wallet-actions-bottom-sheet-swap-button
yarn mm wait-for --testid source-token-area-input --timeout 20000
yarn mm screenshot --name "swaps-baseline"
```

`tab-bar-item-Trade` opens a bottom sheet offering Batch Sell, Swap, Perps,
Predictions and Earn; `wallet-actions-bottom-sheet-swap-button` is the "Swap"
row in that sheet. This is the same test ID the wallet-actions sheet already
used from other entry points — only the path to reach the sheet changed.

**`wallet-swap-button` (the old direct entry point) no longer works** — it
still exists in `WalletView.testIds.ts` but clicking it now fails
(`MM_CLICK_FAILED`); it is not wired to a visible control on the current home
screen. Use the Trade-tab flow above instead.

**Wait on `source-token-area-input`, not `bridge-view-scroll`.** The
`bridge-view-scroll` test ID is still applied to the screen's `ScrollView` in
`app/components/UI/Bridge/Views/BridgeView/index.tsx`, but it does not appear
in `mm describe-screen`'s testId/accessibility output, so waiting on it times
out even though the screen has mounted. `source-token-area-input` is a
reliable, already-documented stand-in for "the swaps screen is up."

Test IDs for the swaps screen, from
`tests/selectors/Bridge/QuoteView.selectors.ts` and
`app/components/Views/Wallet/WalletView.testIds.ts`. Area files list the IDs
for their own surfaces:

| Element | Test ID |
|---|---|
| Swap entry (Trade tab bottom nav) | `tab-bar-item-Trade` |
| Swap entry (Trade tab sheet) | `wallet-actions-bottom-sheet-swap-button` |
| Swap entry (homepage grid) | `homepage-action-buttons-grid-swap` |
| Swap entry (token page) | `token-swap-button` |
| Swaps screen root (scroll view; not exposed to `mm describe-screen`, see above) | `bridge-view-scroll` |
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

Do not take test IDs from `*.test.tsx` files: most of those are mocks and do
not exist at run time. `tests/selectors/**` is not a source of truth either —
it is the E2E selector registry, and it contains IDs that no component
applies. Confirm an ID against `mm describe-screen` output or a `testID=` in a
non-test `.tsx`/`.testIds.ts` file before recording it.
