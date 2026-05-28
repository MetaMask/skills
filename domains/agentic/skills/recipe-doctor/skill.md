---
name: recipe-doctor
description: Diagnose whether a MetaMask Mobile or Extension checkout is ready to use ADR-58 recipe skills, including installed skill bundles, harness scripts, local tools, runtime context, and wallet fixtures/profiles. Use before recipe-dev, recipe-fix-ticket, recipe-harness, recipe-wallet-control, or demo recording on a fresh machine or checkout.
maturity: experimental
---

# Recipe Doctor

`recipe-doctor` is the first command to run when a fresh agent, machine, or checkout is about to use the ADR-58 recipe workflow.

It does not prove product behavior. It answers: "Can this checkout run the recipe skills efficiently, and will wallet/account setup be automatic or manual?"

## Rules

- Run doctor before long recipe work on a new setup, before demos, and after a failed skill install.
- Treat failed required checks as setup blockers, not product failures.
- Report fixture/profile status early. If fixtures are missing, tell the human that the workflow can continue, but wallet/account setup may be manual and slower.
- Do not print raw fixture passwords, mnemonics, private keys, or full account material. Report counts, file paths, and schema status only.
- Doctor may run static harness verification. It must not start Metro, Chrome, simulators, emulators, builds, or live CDP sessions.

## Command Shape

From a consumer repo after installing agentic skills:

```bash
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor --target . --json
.agents/skills/mms-recipe-doctor/scripts/recipe-doctor --target ~/dev/metamask/metamask-mobile --repo metamask-mobile
```

From a source checkout while developing this skill:

```bash
domains/agentic/skills/recipe-doctor/scripts/recipe-doctor --target ~/dev/metamask/metamask-mobile
domains/agentic/skills/recipe-doctor/scripts/recipe-doctor --target ~/dev/metamask/metamask-extension
```

Use `--no-static-verify` only when the caller explicitly wants a pure read-only scan. The default static verify is no-start/no-live; it may write ignored `.agent/recipe-harness/.../summary.json` artifacts.

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
# edit .agent/wallet-fixture.json with throwaway password/accounts only:
# - accounts[0]: mnemonic for first vault setup
# - optional privateKey accounts named "Trading"/"MYXTrading" for funded flows
# - Farmslot-compatible settings: metametrics=true, skipGtmModals=true,
#   skipPerpsTutorial=true, autoLockNever=true, deviceAuthEnabled=true
```

For Extension, use the same account roles where possible. A Farmslot-compatible Extension fixture is `temp/runtime/wallet-fixture.json` or `.agent/wallet-fixture.json` with `password`, `address`, `vault`, `accounts[0]` mnemonic, optional private-key accounts named `Trading` / `MYXTrading`, and `settings.skipPerpsTutorial=true`, `settings.autoLockNever=true`. If no fixture generator is available, use a prepared debug profile with the intended throwaway account already selected.

## Follow-Up Goal: Shared Wallet Fixture Contract

Mobile and Extension should converge on the same human-authored wallet fixture shape:

```json
{
  "password": "throwaway-password",
  "accounts": [
    { "type": "mnemonic", "value": "throwaway srp words", "name": "Primary" },
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

Extension-specific `address`, `vault`, and persisted controller state should be generated from that shared fixture by the Extension harness, not hand-authored by users. The goal is for agents to import multiple account types and names consistently on both platforms, then start each wallet with a predictable selected account.

For Extension browser launch, the Farmslot-like path is an isolated Chromium profile:

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness live \
  --cdp-port <free-port> \
  --launch-existing-dist \
  --chrome-user-data-dir temp/runtime/chrome-profile-recipe
```

If no compatible `dist/chrome` exists and the human accepts build/watch cost, add `--start-test-watch`. Prefer Playwright Chromium over the user's normal Chrome profile. `mms-recipe-harness live` must not install Chromium automatically; when the browser binary is missing, ask the user first, then run `npx playwright install chromium` only if they approve, or set `RECIPE_HARNESS_CHROME_BIN` to a browser they explicitly chose.
