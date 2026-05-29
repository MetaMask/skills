---
repo: metamask-extension
parent: visual-testing
metadata:
  location: test/e2e/playwright/llm-workflow/
  type: browser-testing
---

# MetaMask Visual Testing — Agent Skill

## When to Use This Skill

Use this skill when you need to:

- Visually validate MetaMask UI changes in a real browser
- Capture screenshots as evidence
- Verify onboarding, unlock, transaction, swap, or dapp-confirmation flows
- Click through extension behavior instead of reasoning from code alone
- Debug unexpected UI state in the extension or sidepanel

For architecture and developer-facing implementation details, see `test/e2e/playwright/llm-workflow/README.md`.

## Prerequisites

**CLI invocation**: The `mm` CLI is a project-local dependency. Use one of:

```bash
yarn mm <command>
npx mm <command>
./node_modules/.bin/mm <command>
```

All examples in this skill use `mm` for brevity.

**Validate that there is an extension build** before `mm launch`:

- Build output is in `dist/chrome/`
- If there is no build, build the extension
- If there is a build and the user explicitly asked to rebuild, rebuild it
- If there is a build and the user explicitly asked not to rebuild, reuse it
- If reuse vs rebuild affects the task and the user was explicit, follow that instruction

**Build command**:

```bash
yarn install
yarn build:test:webpack
```

`mm launch` validates the build and returns an actionable error if it is missing.

If ports are stuck from a previous run, do not assume fixed port numbers. The current daemon and sub-service ports are persisted in the worktree-local `.mm-server` file:

```bash
cat .mm-server
```

Look under `subPorts` for the active `anvil` and `fixture` ports, then target those specific ports if you need to clean up orphan processes.

## Gotchas

- `a11yRef`s (`e1`, `e2`, ...) are **ephemeral**. After `mm describe-screen`, `mm accessibility-snapshot`, or major navigation, re-describe before reusing refs.
- `mm type` uses Playwright `fill()` and **clears the field first**.
- After confirm or reject in sidepanel mode, the page does **not** close. It stays open and navigates back to the home route.
- `mm wait-for-notification` waits for the sidepanel confirmation route. It does **not** wait for a legacy popup window.
- `mm run-steps` expects a JSON **object** with a `steps` key, not a bare array.
- In `mm run-steps`, prefer `a11yRef`, `testId`, or `selector` in args. `ref` is accepted as shorthand, but explicit keys are clearer.
- You cannot switch context during an active session. Run `mm cleanup` first, or use `mm launch --context ...`.
- The default password for built-in fixtures is `correct horse battery staple`.
- Network mocks are session-scoped. Add `mm mock-network` rules after `mm launch` and before the UI action that triggers the request; `mm cleanup` removes them.
- `mm mock-network` uses Playwright route interception and can mock requests from both page and extension service-worker contexts. However, it **cannot** intercept requests made during extension startup before the session is fully active. Pre-launch mocking is not currently supported and will be added in a future update.

## CLI Commands Overview

The `mm` CLI is the primary interface.

### Lifecycle

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `mm launch`             | Launch MetaMask in headless Chrome     |
| `mm cleanup`            | Stop browser and services              |
| `mm cleanup --shutdown` | Stop browser, services, and the daemon |
| `mm status`             | Show current daemon and session status |

### Interaction

| Command                      | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `mm click <ref>`             | Click element by a11y ref, testId, or selector       |
| `mm type <ref> <text>`       | Type text into element                               |
| `mm get-text <ref>`          | Read text content of element                         |
| `mm describe-screen`         | Combined state + activeTab + testIds + a11y snapshot |
| `mm screenshot [--name <n>]` | Take and save screenshot                             |
| `mm wait-for <ref>`          | Wait for element to be visible                       |
| `mm wait-for-notification`   | Wait for sidepanel confirmation route, set as active |
| `mm accessibility-snapshot`  | Get trimmed a11y tree with refs                      |
| `mm list-testids`            | List visible `data-testid` attributes                |
| `mm clipboard <action>`      | Read from or write to browser clipboard              |

### Navigation & Tabs

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `mm navigate <url>`       | Navigate to a specific URL                    |
| `mm navigate-home`        | Navigate to the extension home                |
| `mm navigate-settings`    | Navigate to the extension settings            |
| `mm switch-to-tab <role>` | Switch active page to a different tab by role |
| `mm close-tab <role>`     | Close a tab                                   |

### Context

| Command                      | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `mm get-context`             | Get current context and available capabilities |
| `mm set-context <e2e\|prod>` | Switch workflow context                        |

### State, Knowledge, and Seeding

| Command                       | Description                               |
| ----------------------------- | ----------------------------------------- |
| `mm get-state`                | Get current extension state               |
| `mm knowledge-search <query>` | Search steps across sessions              |
| `mm knowledge-last`           | Get last N step records from this session |
| `mm knowledge-sessions`       | List recent sessions with metadata        |
| `mm knowledge-summarize`      | Generate session recipe                   |
| `mm run-steps <json>`         | Execute multiple tools in sequence        |
| `mm seed-contract <type>`     | Deploy a test contract                    |
| `mm seed-contracts`           | Deploy multiple test contracts            |
| `mm get-contract-address`     | Get deployed contract address             |
| `mm list-contracts`           | List all deployed contracts               |

### Advanced

| Command                                         | Description                                                   |
| ----------------------------------------------- | ------------------------------------------------------------- |
| `mm mock-network add '<json-rule-or-config>'`   | Add one or more Playwright route mocks during active session   |
| `mm mock-network clear`                         | Clear network mocks and recorded requests                     |
| `mm mock-network list`                          | List active network mock rules                                |
| `mm mock-network requests [--limit <n>]`        | Show recorded matched and missed mocked-origin requests       |
| `mm cdp <method> [params-json] [--timeout <ms>]` | Send raw Chrome DevTools Protocol command against active page |

## Launch Modes & Fixtures

### Default: Pre-Onboarded Wallet

Wallet is pre-configured with 25 ETH on local Anvil.

```bash
mm launch
mm launch --state default
mm launch --context prod
```

### Onboarding: Fresh Wallet

```bash
mm launch --state onboarding
```

### Custom Fixture

```bash
mm launch --state custom --preset withMultipleAccounts
```

### Available Presets

| Preset                 | Description                       |
| ---------------------- | --------------------------------- |
| `withMultipleAccounts` | Wallet with 2 accounts            |
| `withERC20Tokens`      | Wallet with test ERC-20 tokens    |
| `withConnectedDapp`    | Wallet pre-connected to test dapp |
| `withPopularNetworks`  | Popular L2 networks added         |
| `withMainnet`          | Switched to Ethereum Mainnet      |
| `withNFTs`             | Wallet with test NFTs             |
| `withFiatDisabled`     | Fiat conversion display disabled  |
| `withHSTToken`         | Wallet with HST token             |

## Context Switching (e2e vs prod)

Two execution contexts are supported:

| Context | Description                                                              |
| ------- | ------------------------------------------------------------------------ |
| `e2e`   | Default. Local Anvil blockchain, pre-onboarded wallet, fixtures, seeding |
| `prod`  | Production-like mode. No fixtures, no local chain, limited capabilities  |

Use:

```bash
mm get-context
mm set-context prod
mm set-context e2e
```

Rules:

1. Cannot switch during an active session — run `mm cleanup` first
2. Default context is `e2e`
3. Context persists until changed or daemon restart
4. `mm launch --context prod` sets context and launches in one step

## Sidepanel Mode (Default)

The extension runs in **headless browser mode** by default, using `sidepanel.html` instead of the legacy popup.

What matters operationally:

1. After confirm or reject, the sidepanel stays open and navigates back to home
2. `mm wait-for-notification` waits for a confirmation route in the sidepanel URL hash
3. After a confirmation action, use `mm describe-screen` to verify the return to home state
4. Known confirmation routes include:
   - `/connect`
   - `/confirm-transaction`
   - `/confirmation`
   - `/confirm-import-token`
   - `/confirm-add-suggested-token`
   - `/confirm-add-suggested-nft`

## Core Workflow

### 1. Build Extension

```bash
yarn build:test:webpack
```

Skip if already built and reuse is acceptable for the task.

### 2. Launch Extension

```bash
mm launch
mm launch --state default
mm launch --state onboarding
mm launch --context prod --state onboarding
mm launch --state custom --preset withMultipleAccounts
```

### 3. Reuse Existing Knowledge (Mandatory)

Before interacting, query prior knowledge:

```bash
mm knowledge-search "<flow name>"
mm knowledge-sessions
```

If knowledge exists, reuse the discovered sequence. If not, proceed with discovery and let this session record the new steps.

### 4. Describe Current Screen

```bash
mm describe-screen
```

This returns the current screen, active tab info, visible testIds, and an accessibility tree with refs.

**Observation efficiency:**

- Mutating actions like `click`, `type`, and `navigate` return compact observations
- After the first mutation, later mutations return diff-based observations until `mm describe-screen` resets the baseline
- Use mutation responses for quick next-step targeting when they already contain the needed refs
- Call `mm describe-screen` when you need the full a11y tree, screenshots, or priorKnowledge

### 5. Interact with UI

Use exactly one targeting method per call.

#### Timeouts (deadline-based)

`mm click`, `mm type`, `mm get-text`, and `mm wait-for` all accept `--timeout <ms>` (default 15000). This is a **single deadline budget** covering the entire operation — visibility wait + action combined — not a per-phase timeout.

Phase-specific error codes:

- `MM_WAIT_TIMEOUT` — element never became visible within the budget.
- `MM_CLICK_TIMEOUT` — element was found but the click action hung. The click may still complete in the background; run `mm describe-screen` to verify before retrying.
- `MM_TYPE_TIMEOUT` — element was found but `fill()` hung.
- `MM_GETTEXT_TIMEOUT` — element was found but `textContent()` hung.
- `MM_PAGE_CLOSED` — page closed during the action (expected for some confirmation flows; `mm click` may instead succeed with `pageClosedAfterClick: true` when the closure was a natural consequence of the click).

Examples:

```bash
mm click --testid onboarding-complete-done --timeout 60000
mm type --testid send-amount "0.01" --timeout 10000
mm get-text --testid balance-display --timeout 5000
mm wait-for --testid account-menu-icon --timeout 10000
```

#### By a11yRef

Use refs from `mm describe-screen` or `mm accessibility-snapshot` during discovery.

```bash
mm click e5
mm type e2 "correct horse battery staple"
mm wait-for e3 --timeout 10000
```

#### Scoped targeting with `--within`

Use `--within` when duplicate names or testIds exist and you need to target inside a specific container.

```bash
mm click --testid end-accessory --within "testid:account-list-item/0"
mm click e3 --within "testid:dialog-container"
mm wait-for --testid confirm-btn --within "selector:.modal-content"
```

The `--within` value accepts an a11y ref, `testid:<id>`, or `selector:<css>`.

#### By testId

Prefer `testId` for stable, known flows and batching.

```bash
mm click --testid unlock-submit
mm type --testid unlock-password "correct horse battery staple"
mm wait-for --testid account-menu-icon --timeout 10000
mm get-text --testid balance-display
```

#### By CSS selector

Use selectors as a fallback when testIds or a11y refs are unavailable.

Supported forms:

- CSS: `button.primary`
- Text: `text=Rename`
- Role: `role=button[name='Submit']`

Do not use the unsupported `:text()` pseudo-class.

```bash
mm click --selector "button.primary"
mm click --selector "text=Rename"
mm click --selector "role=button[name='Submit']"
mm type --selector "input[name='amount']" "0.1"
mm wait-for --selector ".transaction-list-item" --timeout 10000
mm get-text --selector ".balance-value"
```

#### Reading Element Text

```bash
mm get-text e5
mm get-text --testid balance-display
mm get-text --selector ".tx-amount"
mm get-text --testid amount --within "testid:tx-row"
```

Start with a11y refs during discovery, then prefer testIds once the flow is known.

### 6. Verify-Fix Loop

After any interaction sequence:

1. Run `mm describe-screen` to verify the expected state
2. If the state is wrong:
   - capture `mm screenshot --name "debug-<action>"`
   - check `mm knowledge-search "<flow>"`
   - retry the failed step or adjust targeting
3. Only continue when the expected screen or state is confirmed

### 7. Handle Confirmations (Dapp Flows)

```bash
mm navigate https://test-dapp.io
mm click e1
mm wait-for-notification
mm describe-screen
mm click e2
mm describe-screen
mm switch-to-tab dapp
mm describe-screen
```

`mm switch-to-tab dapp` is equivalent to `mm switch-to-tab --role dapp`.

Tab roles: `extension`, `notification`, `dapp`, `other`.

### 8. Navigate

```bash
mm navigate-home
mm navigate-settings
mm navigate https://test-dapp.io
```

### 9. Take Screenshots

```bash
mm screenshot --name "after-unlock"
```

For visual validation, capture screenshots before and after meaningful state changes.

### 10. Cleanup (Always Required)

```bash
mm cleanup
mm cleanup --shutdown
```

## Mock Network Requests

Use `mm mock-network` to stub browser network requests during an active session. Prefer this over raw CDP when you need deterministic API responses.

Rules are installed on the active Playwright browser context:

- Run `mm launch` first.
- Add rules before the UI action that triggers the request.
- Rules are removed by `mm cleanup`; `mm mock-network clear` removes rules and request history without ending the session.
- Unmatched requests on an origin with a mock rule continue unchanged and are recorded as misses.

Rule shape:

```json
{
  "id": "token-prices",
  "method": "GET",
  "url": "https://price.api.metamask.io/v1/**",
  "response": {
    "status": 200,
    "json": {
      "ethereum": {
        "usd": 1234.56
      }
    }
  }
}
```

Fields:

| Field              | Description                                                                                         |
| ------------------ | --------------------------------------------------------------------------------------------------- |
| `id`               | Stable identifier. Adding another rule with the same `id` replaces the previous rule.               |
| `method`           | HTTP method to match; normalized to uppercase.                                                       |
| `url`              | Absolute `http`/`https` URL or URL glob. `*` matches within a segment; `**` matches any path suffix. |
| `response.status`  | Optional HTTP status; defaults to `200`.                                                            |
| `response.json`    | JSON response payload.                                                                              |
| `response.body`    | Text response payload. Use either `json` or `body`.                                                 |
| `response.headers` | Optional response headers. JSON/text defaults include `access-control-allow-origin: *`.              |

Examples:

```bash
mm mock-network add '{"id":"token-prices","method":"GET","url":"https://price.api.metamask.io/v1/**","response":{"status":200,"json":{"ethereum":{"usd":1234.56}}}}'

mm mock-network add '{"routes":[
  {"id":"feature-flags","method":"GET","url":"https://client-config.api.cx.metamask.io/**","response":{"json":{"flags":{}}}},
  {"id":"empty-nfts","method":"POST","url":"https://nft.api.metamask.io/**","response":{"status":200,"json":{"nfts":[]}}}
]}'

mm mock-network list
mm mock-network requests --limit 20
mm mock-network clear
```

Verification pattern:

1. Add the rule with `mm mock-network add ...`
2. Trigger the UI flow that makes the request
3. Run `mm mock-network requests --limit 20`
4. Confirm the expected request has `matched: true` and the expected `ruleId`

In `mm run-steps`, use tool name `mock_network` with the same input shape:

```bash
mm run-steps '{"steps":[
  {"tool":"mock_network","args":{"action":"add","rule":{"id":"prices","method":"GET","url":"https://price.api.metamask.io/v1/**","response":{"json":{"ok":true}}}}},
  {"tool":"navigate","args":{"screen":"url","url":"https://test-dapp.io"}}
]}'
```

## Raw CDP Commands

`mm cdp` sends a raw [Chrome DevTools Protocol](https://chromedevtools.github.io/devtools-protocol/) command against the active page. Reach for this **only when structured commands (`mm click`, `mm type`, `mm navigate`, etc.) cannot express what you need** — for example, evaluating JavaScript, enabling network tracking, or inspecting the DOM tree directly.

```bash
mm cdp Runtime.evaluate '{"expression":"document.title"}'
mm cdp Network.enable
mm cdp DOM.getDocument '{"depth":2}' --timeout 60000
```

Arguments:

| Argument        | Description                                                                  |
| --------------- | ---------------------------------------------------------------------------- |
| `<method>`      | CDP method name (e.g., `Runtime.evaluate`, `DOM.getDocument`, `Network.enable`) |
| `[params-json]` | Optional JSON object with method-specific parameters                         |
| `--timeout`     | Per-command timeout in ms. Default: 30000. Min: 1000. Max: 30000             |

**Blocked methods** (would destroy the session — returns `MM_CDP_BLOCKED`):

- `Browser.close`
- `Target.closeTarget`
- `Target.disposeBrowserContext`
- `Browser.crashGpuProcess`

**Behavior:**

- Categorized as **mutating** — state-changing CDP calls bypass session tracking. Run `mm describe-screen` afterward to re-sync the a11y ref map and screen state.
- CDP failures (invalid method, malformed params, timeout) return `MM_CDP_FAILED`.
- This is an **escape hatch, not a sandbox**: prefer structured commands whenever they cover your use case.

**When to reach for `mm cdp`:**

| Need                                                  | Suggested CDP method                                          |
| ----------------------------------------------------- | ------------------------------------------------------------- |
| Read a JS value / `window` property                   | `Runtime.evaluate` with `{ "expression": "..." }`             |
| Inspect / traverse DOM                                | `DOM.getDocument`, `DOM.querySelector`                        |
| Capture network traffic                               | `Network.enable` (then read events via subsequent CDP calls)  |
| Inject cookies or storage                             | `Network.setCookie`, `Storage.setLocalStorage*`               |
| Low-level input beyond `mm click` / `mm type`         | `Input.dispatchKeyEvent`, `Input.dispatchMouseEvent`          |

## Batching with mm run-steps

Use `mm run-steps` for known, deterministic sequences. Use individual commands for discovery, debugging, or when intermediate state changes the next action.

Important details:

- `mm run-steps` expects a JSON object with a `steps` key
- Prefer `a11yRef`, `testId`, or `selector` in args
- Use `within` in args to scope a target within a parent element
- Add `batchTimeoutMs` for an overall timeout
- Tool aliases such as `navigate_home` and `navigate-home` are supported

```bash
mm run-steps '{"steps":[
  { "tool": "type", "args": { "testId": "unlock-password", "text": "correct horse battery staple" } },
  { "tool": "click", "args": { "testId": "unlock-submit" } },
  { "tool": "wait_for", "args": { "testId": "account-menu-icon", "timeoutMs": 10000 } },
  { "tool": "get_text", "args": { "testId": "account-balance", "within": { "testId": "account-overview" } } }
]}'
```

Pattern:

1. Discover with `mm describe-screen`
2. Reuse prior successful steps from `mm knowledge-search`
3. Batch the known sequence with `mm run-steps`
4. Re-verify with `mm describe-screen`

## Capabilities

- **Anvil**: Local blockchain on port 8545
- **Fixture Server**: Wallet state management on port 12345
- **Contract Seeding**: Deploy test contracts with `mm seed-contract`

## Error Recovery

### On Failure

1. Run `mm describe-screen`
2. Check the current screen:
   - `unlock` → enter password and submit
   - `home` → continue, but check for modals or blockers
   - `onboarding-*` → complete onboarding
   - `unknown` → take a screenshot and investigate
3. Query prior runs if needed:

```bash
mm knowledge-search "send"
mm knowledge-sessions
mm knowledge-last
```

4. Capture `mm screenshot --name "debug"` for diagnosis

### Error Codes

| Code                         | Meaning                                                                                                          |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `MM_SESSION_ALREADY_RUNNING` | Session exists, call `mm cleanup` first                                                                          |
| `MM_NO_ACTIVE_SESSION`       | No session, call `mm launch` first                                                                               |
| `MM_LAUNCH_FAILED`           | Browser launch failed                                                                                            |
| `MM_INVALID_INPUT`           | Invalid parameters                                                                                               |
| `MM_TARGET_NOT_FOUND`        | Element not found                                                                                                |
| `MM_TAB_NOT_FOUND`           | Tab not found                                                                                                    |
| `MM_CLICK_FAILED`            | Click operation failed (post-find, not a timeout)                                                                |
| `MM_CLICK_TIMEOUT`           | Click action timed out (element found, click hung) — may have completed in background; run `mm describe-screen`  |
| `MM_TYPE_FAILED`             | Type operation failed (post-find, not a timeout)                                                                 |
| `MM_TYPE_TIMEOUT`            | `fill()` action timed out; run `mm describe-screen` and retry                                                    |
| `MM_GETTEXT_FAILED`          | `get-text` failed (non-timeout, e.g. element detached) — re-target                                               |
| `MM_GETTEXT_TIMEOUT`         | `textContent()` action timed out                                                                                 |
| `MM_WAIT_TIMEOUT`            | Wait timeout exceeded                                                                                            |
| `MM_PAGE_CLOSED`             | Browser page closed during interaction — normal after some confirmations                                         |
| `MM_SCREENSHOT_FAILED`       | Screenshot capture failed                                                                                        |
| `MM_BATCH_TIMEOUT`           | `batchTimeoutMs` deadline exceeded                                                                               |
| `MM_CONTEXT_SWITCH_BLOCKED`  | Cannot switch context during active session                                                                      |
| `MM_SET_CONTEXT_FAILED`      | Context switch failed                                                                                            |
| `MM_CDP_BLOCKED`             | CDP method is in the destructive-blocklist (e.g. `Browser.close`)                                                |
| `MM_CDP_FAILED`              | CDP command execution failed or timed out                                                                        |

## Default Credentials

| Property | Value                          |
| -------- | ------------------------------ |
| Password | `correct horse battery staple` |
| Chain ID | `1337`                         |
| Balance  | 25 ETH                         |

## Common Failures & Solutions

| Symptom                                    | Likely Cause                                  | Solution                                                                                                         |
| ------------------------------------------ | --------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `MM_SESSION_ALREADY_RUNNING`               | Previous session not cleaned                  | Call `mm cleanup` first                                                                                          |
| `MM_NO_ACTIVE_SESSION`                     | No browser running                            | Call `mm launch` first                                                                                           |
| Extension not loading                      | Extension not built                           | Run `yarn build:test:webpack` then retry `mm launch`                                                             |
| `EADDRINUSE` port error                    | Orphan processes                              | Check `.mm-server` for the active daemon/sub-service ports, then kill the specific orphaned process on that port |
| `MM_TARGET_NOT_FOUND`                      | Element not visible                           | Use `mm describe-screen` to check state                                                                          |
| `MM_WAIT_TIMEOUT`                          | Slow environment or UI delay                  | Increase `--timeout`, inspect screenshot                                                                         |
| `MM_CLICK_TIMEOUT` / `MM_TYPE_TIMEOUT`     | Element found but action hung (side effect)   | Run `mm describe-screen` first to verify it didn't already complete; retry with larger `--timeout`               |
| `MM_GETTEXT_TIMEOUT` / `MM_GETTEXT_FAILED` | Element detached or content not ready         | Run `mm describe-screen` and re-target; bump `--timeout` if the value is async                                   |
| `MM_PAGE_CLOSED`                           | Confirmation popup auto-closed, dapp tab gone | Expected after some confirmations — run `mm describe-screen` to find the new active page                         |
| `MM_CDP_BLOCKED`                           | Attempted a destructive CDP method            | Use a non-blocked CDP method; see the blocked list in the Raw CDP Commands section                               |
| `MM_CDP_FAILED`                            | Invalid CDP method / params, or CDP timed out | Check method name & params shape; retry with a larger `--timeout` (max 30000)                                    |
| `MM_CONTEXT_SWITCH_BLOCKED`                | Switching during active session               | Call `mm cleanup` before `mm set-context`                                                                        |
| Fixtures not available                     | Running in prod context                       | Switch to e2e: `mm set-context e2e`                                                                              |
| Stale a11yRefs after navigate              | Refs not refreshed                            | Call `mm describe-screen` to get fresh refs                                                                      |
