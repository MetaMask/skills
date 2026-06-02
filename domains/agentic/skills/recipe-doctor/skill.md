---
name: recipe-doctor
description: Diagnose whether a MetaMask Mobile or Extension checkout is ready to use Recipe v1 skills, including installed skill bundles, harness scripts, local tools, runtime context, and wallet fixtures/profiles. Use before recipe-dev, recipe-fix-ticket, recipe-harness, recipe-wallet-control, or demo recording on a fresh machine or checkout.
maturity: experimental
---

# Recipe Doctor

`recipe-doctor` is the first command to run when a fresh agent, machine, or checkout is about to use the Recipe v1 workflow.

It does not prove product behavior. It answers: "Can this checkout run the recipe skills efficiently, and will wallet/account setup be automatic or manual?"

## Rules

- Run doctor before long recipe work on a new setup, before demos, and after a failed skill install.
- Treat failed required checks as setup blockers, not product failures.
- Report fixture/profile status early. If fixtures are missing, tell the human that the workflow can continue, but wallet/account setup may be manual and slower.
- Do not print raw fixture passwords, mnemonics, private keys, or full account material. Report counts, file paths, and schema status only.
- Doctor may run static harness verification. It must not start Metro, Chrome, simulators, emulators, builds, or live CDP sessions.

## Agent Execution

**Run the bash script directly — do not re-implement the checks manually as individual commands.**

When invoked by an agent, locate and execute the script:

```bash
# Installed in a consumer repo:
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor --target .

# Source checkout (developing this skill):
domains/agentic/skills/recipe-doctor/scripts/recipe-doctor --target <checkout>
```

The script is self-contained and handles all checks sequentially. Running checks as individual parallel bash calls is wrong: a failed CDP/curl probe (exit 7 = browser not running) will cancel sibling parallel calls and produce spurious "Cancelled" errors. Let the script manage sequencing.

## Command Shape

From a consumer repo after installing agentic skills:

```bash
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor --target . --json
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor --target <metamask-mobile-checkout> --repo metamask-mobile
```

From a source checkout while developing this skill:

```bash
domains/agentic/skills/recipe-doctor/scripts/recipe-doctor --target <metamask-mobile-checkout>
domains/agentic/skills/recipe-doctor/scripts/recipe-doctor --target <metamask-extension-checkout>
```

Use `--no-static-verify` only when the caller explicitly wants a pure read-only scan. The default static verify is no-start/no-live; it may write ignored `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/.../summary.json` artifacts.

## What It Checks

- repo detection: `metamask-mobile` or `metamask-extension`;
- required local tools: `bash`, `node`, `git`, and `curl`;
- installed recipe skill bundles under `.agents/skills`, `.claude/skills`, or `.cursor/rules`;
- installed harness runner files in the target checkout;
- static harness verification through `mms-recipe-harness` when available;
- runtime context hints in `temp/runtime/agentic-runtime.json`;
- Extension browser isolation: prefer Playwright Chromium, or Chrome/Chromium with a dedicated `--user-data-dir`, never the user's normal profile;
- Mobile wallet fixture schema at `.agent/wallet-fixture.json` or `scripts/perps/agentic/wallet-fixture.json`;
- Extension wallet fixture/profile hints at `temp/runtime/wallet-fixture.json`, `.agent/wallet-fixture.json`, `temp/runtime/extension.id`, `test/e2e/fixtures`, or `fixtures`.

## Expected Output

- `PASS`: required setup is ready.
- `WARN`: workflow can continue, but setup may be slower or more manual.
- `FAIL`: missing required tool or harness state; fix before recipe runtime claims.

For Mobile, a missing fixture should produce the exact setup hint:

```bash
mkdir -p .agent
cp scripts/perps/agentic/wallet-fixture.example.json .agent/wallet-fixture.json
# edit .agent/wallet-fixture.json with local development password/accounts only:
# - accounts[0]: mnemonic for first vault setup
# - optional privateKey accounts named "Trading"/"MYXTrading" for funded flows
# - shared-fixture-compatible settings: metametrics=true, skipGtmModals=true,
#   skipPerpsTutorial=true, autoLockNever=true, deviceAuthEnabled=true
```

For Extension, use the same human-authored account roles as Mobile. A shared-fixture-compatible Extension fixture is `temp/runtime/wallet-fixture.json` or `.agent/wallet-fixture.json` with `password`, `accounts[0]` mnemonic (name conventionally `Primary` for cross-platform shared fixture parity — any name is valid for single-platform setups; only warn if harness uses name-based account lookup), optional private-key accounts named `Trading` / `MYXTrading`, optional `selectedAccount`, and `settings.skipPerpsTutorial=true`, `settings.autoLockNever=true`. The Extension harness generates `address`, `vault`, and persisted controller state from this shape before live launch.

## Shared Wallet Fixture Contract

Mobile and Extension share this human-authored wallet fixture shape:

```json
{
  "password": "local-dev-password",
  "accounts": [
    { "type": "mnemonic", "value": "local development srp words", "name": "Primary" },
    { "type": "privateKey", "value": "0x...", "name": "Trading" },
    { "type": "privateKey", "value": "0x...", "name": "MYXTrading" }
  ],
  "selectedAccount": "Trading",
  "settings": {
    "skipPerpsTutorial": true,
    "autoLockNever": true
  }
}
```

Extension-specific `address`, `vault`, and persisted controller state are generated from that shared fixture by the Extension harness, not hand-authored by users. This lets agents import multiple account types and names consistently on both platforms, then start each wallet with a predictable selected account.

For Extension browser launch, the isolated path is an isolated Chromium profile:

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness live \
  --cdp-port <free-port> \
  --launch-existing-dist \
  --chrome-user-data-dir temp/runtime/chrome-profile-recipe
```

If no compatible `dist/chrome` exists and the human accepts build/watch cost, add `--start-test-watch`. Prefer Playwright Chromium over the user's normal Chrome profile. `mms-recipe-harness live` must not install Chromium automatically. When the browser binary is missing, stop and ask the user for approval; only after explicit approval should the user/agent run `yarn exec playwright install chromium` to populate the user-level Playwright browser cache without package.json changes, or the user can set `RECIPE_HARNESS_CHROME_BIN` to a browser they explicitly choose.
