---
repo: metamask-extension
parent: recipe-doctor
---

# Recipe Doctor - MetaMask Extension

For Extension readiness, doctor must check:

- `bash`, `node`, `git`, and `curl`;
- a reachable browser command hint when live validation is expected;
- installed `mms-recipe-harness`, `mms-recipe-wallet-control`, `mms-recipe-cook`, `mms-recipe-evidence`, and one high-level workflow skill;
- `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/extension/runner/bin/metamask-recipe`, `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/extension/action-manifest.json`, and `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/extension/runner/recipes` after harness install;
- `temp/runtime/agentic-runtime.json` for caller-provided CDP/runtime context;
- fixture/profile hints such as `temp/runtime/wallet-fixture.json`, `.agent/wallet-fixture.json`, `temp/runtime/extension.id`, `test/e2e/fixtures`, or `fixtures`;
- Playwright Chromium availability from the Extension checkout; this is the closest portable equivalent to an isolated Playwright Chromium launch;
- static no-start harness verify output when `mms-recipe-harness` is available.

If fixture/profile hints are missing, report a warning with the shared-fixture-compatible shared shape: `temp/runtime/wallet-fixture.json` or `.agent/wallet-fixture.json` should include `password`, `accounts[0]` mnemonic named `Primary`, optional private-key accounts named `Trading` / `MYXTrading`, optional `selectedAccount`, and `settings.skipPerpsTutorial=true`, `settings.autoLockNever=true`. The Extension harness generates `address`, `vault`, and persisted controller state from this fixture before live launch.

If browser/CDP readiness is missing, recommend an isolated browser command instead of the user's normal Chrome profile:

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness live \
  --cdp-port <free-port> \
  --launch-existing-dist \
  --chrome-user-data-dir temp/runtime/chrome-profile-recipe
```

If Playwright Chromium is missing, tell the user that `mms-recipe-harness live` uses the repo's Playwright package but must not install Chromium automatically. Ask the user first; if they approve, run `yarn exec playwright install chromium` after dependencies are installed to populate the user-level Playwright browser cache without package.json changes, or set `RECIPE_HARNESS_CHROME_BIN` to a browser they explicitly chose. If `dist/chrome` is missing, add `--start-test-watch` only after the user accepts the build/watch cost.
