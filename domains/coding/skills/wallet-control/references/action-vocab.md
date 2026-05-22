# Wallet Control Action Vocabulary

Use this vocabulary when recording mobile validation evidence or composing `/cook` recipes that call MetaMask Mobile agentic scripts. These primitives are mobile-focused; Extension fixture/runtime injection belongs in `/cook` recipe-runtime tooling until it is available in Extension itself.

| Action | Args | MetaMask Mobile command | Return shape |
|---|---|---|---|
| `status` | none | `yarn a:status` or `bash scripts/perps/agentic/app-state.sh status` | current account, route, device, platform |
| `unlock` | `password` or `MM_PASSWORD` | `bash scripts/perps/agentic/unlock-wallet.sh "$WALLET_PASSWORD"` | success/failure plus post-unlock route |
| `setup-wallet` | `fixturePath` | `bash scripts/perps/agentic/setup-wallet.sh --fixture .agent/wallet-fixture.json` | `{ ok, accountCount, selectedAccount }` or account summary |
| `navigate` | `routeName`, optional params JSON | `bash scripts/perps/agentic/app-navigate.sh <RouteName> [params-json]` | previous/current route plus optional screenshot path |
| `screenshot` | `label` or `outputPath` | `bash scripts/perps/agentic/screenshot.sh <label>` | absolute PNG path |
| `eval-state` | `ref` such as `accounts`, `network`, `perps/positions` | `bash scripts/perps/agentic/app-state.sh status/accounts/eval-ref <ref>` | JSON snapshot |

## Bounded Interaction Helpers

These helpers are lower-level escape hatches for real UI flows. They are not replacements for wallet-semantic primitives and must not fabricate final validation state.

| Helper | MetaMask Mobile command | Use |
|---|---|---|
| `press` | `bash scripts/perps/agentic/app-state.sh press <testId>` | Tap a real UI control by test id. |
| `set-input` / `type` | `bash scripts/perps/agentic/app-state.sh set-input <testId> "value"` | Enter user-provided text through the UI. |
| `scroll` | `bash scripts/perps/agentic/app-state.sh scroll --test-id <id> --offset <n>` or `--offset <n>` | Reveal content or controls. |
| `wait-for` | recipe `wait_for`, or shell polling with `app-state.sh` | Wait for route, selector, or state readiness. |
| `go-back` | `bash scripts/perps/agentic/app-state.sh go-back` | Return to the previous route/screen. |
| `raw-eval` | `app-state.sh eval`, `eval-async`, `eval-ref` | Debug inspection or setup-only operations when named primitives are insufficient. |
