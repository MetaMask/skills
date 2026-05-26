# Recipe Wallet Control Action Vocabulary

Use this vocabulary when recording wallet validation evidence or composing `/recipe-cook` recipes that call harness-backed Mobile or Extension wallet primitives. Runtime injection belongs in `/recipe-harness`; wallet-control names the primitives and proof expectations.

## Mobile

| Action | Args | MetaMask Mobile command | Return shape |
|---|---|---|---|
| `status` | none | `bash scripts/perps/agentic/app-state.sh status` (`yarn a:status` convenience alias only) | current account, route, device, platform |
| `unlock` | `password` or `MM_PASSWORD` | `bash scripts/perps/agentic/unlock-wallet.sh "$WALLET_PASSWORD"` | success/failure plus post-unlock route |
| `setup-wallet` | `fixturePath` | `bash scripts/perps/agentic/setup-wallet.sh --fixture .agent/wallet-fixture.json` | `{ ok, accountCount, selectedAccount }` or account summary |
| `navigate` | `routeName`, optional params JSON | `bash scripts/perps/agentic/app-navigate.sh <RouteName> [params-json]` | previous/current route plus optional screenshot path |
| `screenshot` | `label` or `outputPath` | `bash scripts/perps/agentic/screenshot.sh <label>` | absolute PNG path |
| `eval-state` | `ref` such as `accounts`, `network`, `perps/positions` | `bash scripts/perps/agentic/app-state.sh status/accounts/eval-ref <ref>` | JSON snapshot |

## Extension

| Action | Args | MetaMask Extension harness primitive | Return shape |
|---|---|---|---|
| `unlock` | existing vault/profile, CDP port | `validate-recipe.sh temp/agentic/recipes/domains/extension-core/flows/unlock-wallet.json --cdp-port <port>` | summary/trace plus visible account menu assertion |
| `select-account` | `address`, CDP port | `validate-recipe.sh temp/agentic/recipes/domains/extension-core/flows/select-account.json --param address=0x... --cdp-port <port>` | `selectedAddress` equals requested address |
| `navigate` | route or flow file | recipe `navigate` node or `extension-core/flows/navigate-settings.json` | route/selector proof plus optional screenshot |
| `screenshot` | `filename` | recipe `screenshot` node | PNG artifact path |
| `eval-state` | `extension-core/accounts`, `extension-core/network`, `extension-core/wallet-state` | recipe `eval_ref` node | JSON snapshot |

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
