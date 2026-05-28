---
repo: metamask-mobile
parent: recipe-doctor
---

# Recipe Doctor - MetaMask Mobile

For Mobile readiness, doctor must check:

- `bash`, `node`, `git`, and `curl`;
- iOS/Android host hints (`xcrun` on macOS, `adb` when Android validation is expected);
- installed `mms-recipe-harness`, `mms-recipe-wallet-control`, `mms-recipe-cook`, `mms-recipe-evidence`, and one high-level workflow skill;
- `scripts/perps/agentic/preflight.sh`, `app-state.sh`, `setup-wallet.sh`, and `validate-recipe.sh` after harness install;
- fixture status for `.agent/wallet-fixture.json`, falling back to `scripts/perps/agentic/wallet-fixture.json`;
- static no-start harness verify output when `mms-recipe-harness` is available.

If the fixture is missing, recommend copying `scripts/perps/agentic/wallet-fixture.example.json` to `.agent/wallet-fixture.json` and editing it with throwaway accounts. The message should be concrete and Farmslot-compatible: include one mnemonic account for first vault setup, optionally include private-key accounts named `Trading` / `MYXTrading` for funded flows, and set `metametrics=true`, `skipGtmModals=true`, `skipPerpsTutorial=true`, `autoLockNever=true`, and `deviceAuthEnabled=true` (applied by the Mobile harness on Android). Do not ask the agent to repair wallet state manually until fixture setup is either declined or impossible.
