---
repo: metamask-mobile
parent: recipe-dev
---

# MetaMask Mobile

For Mobile dev tasks, prove visible changes on the intended simulator/device when practical. Use the runner-appropriate `mms-recipe-harness` delegate (Codex: `$mms-recipe-harness`; Claude/Cursor: `/mms-recipe-harness`) or its installed portable `scripts/recipe-harness verify` wrapper before live recipe proof, and keep harness/generated files out of the product diff summary. Do not require personal shell aliases.

Prefer existing fixtures, page objects, and wallet-control primitives before adding new runtime helpers. If the simulator/app cannot be prepared, mark runtime proof blocked with the verify/preflight artifact path.

Load `references/metamask-mobile-checklist.md` and execute it as the ordered checklist for Mobile dev work. Runtime proof should avoid inherited simulator state and name the fixture/setup flow used.
