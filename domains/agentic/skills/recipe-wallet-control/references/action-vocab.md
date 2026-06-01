# Recipe Wallet Control Action Vocabulary

Use this vocabulary when composing `/recipe-cook` recipes or recording wallet validation evidence. See /recipe-harness for injection.

## Shared Recipe v1 Actions

| Action | Args | Use | Return/proof shape |
|---|---|---|---|
| `app.status` | none | Confirm runner compatibility and project shape. | platform, project root, compatibility summary |
| `cdp.target` | optional `cdp_port`, `required` | Prove the automation channel is reachable before UI work. | target/probe metadata or a hard failure when required |
| `app.hud` | `intent`, optional `status`, `progress`, `display` | Communicate the current recipe intent to a human reviewer. | HUD update result |
| `ui.navigate` | `route` (raw app route), optional `params` | Open any app/wallet/perps destination by route. | previous/current route proof |
| `ui.press` | `target` | Drive a real visible press/tap/click. | pressed target proof |
| `ui.scroll` | `test_id`/`selector`, `offset`, optional `scroll_into_view` | Reveal content or controls. | scroll result proof |
| `ui.wait_for` | `test_id`/`selector`/`text`, `expected`, timeout | Wait for settled UI state before proof. | matched/visible proof |
| `ui.screenshot` | `path` | Capture reviewer-visible proof after a settle condition. | registered screenshot artifact |

## MetaMask Wallet Actions

| Action | Args | Use | Return/proof shape |
|---|---|---|---|
| `metamask.wallet.fixture_status` | none | Check fixture/profile readiness before wallet setup. | redacted fixture summary |
| `metamask.wallet.setup` | fixture-backed setup | Materialize the configured debug wallet/profile. | setup proof, redacted fixture/account summary |
| `metamask.wallet.ensure_unlocked` | optional password source | Unlock only if the runtime is locked. | unlocked/already-unlocked proof |
| `metamask.wallet.select_account` | `address` | Select a deterministic fixture account. | selected-account proof |
| `metamask.wallet.read_state` | none | Read wallet state without mutating UI. | selected account/network/runtime state |

Navigation has no wallet- or perps-specific action: use `ui.navigate` with a raw `route` (and optional `params`), e.g. `{ "action": "ui.navigate", "route": "PerpsMarketListView" }`.

## MetaMask Perps Actions

| Action | Args | Use |
|---|---|---|
| `metamask.perps.start_state` | `market`, `page`, optional position/order expectations | Converge a recipe to a reproducible Perps starting state. |
| `metamask.perps.teardown_state` | cleanup parameters | Return the account/domain to a reusable state. |
| `metamask.perps.read_positions` / `metamask.perps.read_orders` | optional `market` | Collect domain state for proof. |
| `metamask.perps.assert_positions` / `metamask.perps.assert_orders` | expected `state`, optional `market`/mode | Assert domain state without relying on screenshots alone. |
| `metamask.perps.ensure_positions` / `metamask.perps.ensure_orders` | desired state/mode | Idempotent setup/cleanup building blocks. |
| `metamask.perps.place_order` / `metamask.perps.close_positions` / `metamask.perps.close_orders` | market/order parameters | Execute controlled Perps validation actions. |

## Boundary

See `/recipe-harness` `references/contract.md`. Use `ui.*` or a domain action for human-visible criteria; capture `ui.screenshot` as visual proof.
