# MM CLI Command Reference

Complete command reference for the `mm` CLI. For core workflow and getting started, see the main skill.

## Contents

- [Lifecycle](#lifecycle)
- [Interaction](#interaction)
- [Navigation & Tabs](#navigation--tabs)
- [Context](#context)
- [State, Knowledge & Seeding](#state-knowledge--seeding)
- [Advanced](#advanced)

## Lifecycle

| Command                 | Description                            |
| ----------------------- | -------------------------------------- |
| `mm launch`             | Launch MetaMask in headless Chrome     |
| `mm cleanup`            | Stop browser and services              |
| `mm cleanup --shutdown` | Stop browser, services, and the daemon |
| `mm status`             | Show current daemon and session status |

## Interaction

| Command                      | Description                                          |
| ---------------------------- | ---------------------------------------------------- |
| `mm click <ref>`             | Click element by a11y ref, testId, or selector       |
| `mm type <ref> <text>`       | Type text into element (uses `fill()`, clears first) |
| `mm get-text <ref>`          | Read text content of element                         |
| `mm describe-screen`         | Combined state + activeTab + testIds + a11y snapshot |
| `mm screenshot [--name <n>]` | Take and save screenshot                             |
| `mm wait-for <ref>`          | Wait for element to be visible                       |
| `mm wait-for-notification`   | Wait for sidepanel confirmation route, set as active |
| `mm accessibility-snapshot`  | Get trimmed a11y tree with refs                      |
| `mm list-testids`            | List visible `data-testid` attributes                |
| `mm clipboard <action>`      | Read from or write to browser clipboard              |

All interaction commands accept `--timeout <ms>` (default 15000). This is a **single deadline budget** covering visibility wait + action combined — not a per-phase timeout.

## Navigation & Tabs

| Command                   | Description                                   |
| ------------------------- | --------------------------------------------- |
| `mm navigate <url>`       | Navigate to a specific URL                    |
| `mm navigate-home`        | Navigate to the extension home                |
| `mm navigate-settings`    | Navigate to the extension settings            |
| `mm switch-to-tab <role>` | Switch active page to a different tab by role |
| `mm close-tab <role>`     | Close a tab                                   |

Tab roles: `extension`, `notification`, `dapp`, `other`.

`mm switch-to-tab dapp` is equivalent to `mm switch-to-tab --role dapp`.

## Context

| Command                      | Description                                    |
| ---------------------------- | ---------------------------------------------- |
| `mm get-context`             | Get current context and available capabilities |
| `mm set-context <e2e\|prod>` | Switch workflow context                        |

Two contexts: `e2e` (default — local Anvil, fixtures, seeding) and `prod` (no fixtures, no local chain). Cannot switch during active session — run `mm cleanup` first.

## State, Knowledge & Seeding

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

## Advanced

| Command                                           | Description                                                 |
| ------------------------------------------------- | ----------------------------------------------------------- |
| `mm mock-network add '<json-rule-or-config>'`     | Add Playwright route mocks during active session            |
| `mm mock-network clear`                           | Clear network mocks and recorded requests                   |
| `mm mock-network list`                            | List active network mock rules                              |
| `mm mock-network requests [--limit <n>]`          | Show recorded matched and missed mocked-origin requests     |
| `mm cdp <method> [params-json] [--timeout <ms>]`  | Send raw Chrome DevTools Protocol command against active page|

For mock network details, see [mock-network.md](mock-network.md).
For CDP state manipulation, see [state-manipulation.md](state-manipulation.md).
