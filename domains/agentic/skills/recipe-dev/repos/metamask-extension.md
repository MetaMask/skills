---
repo: metamask-extension
parent: recipe-dev
---

# MetaMask Extension

For Extension dev tasks, classify whether proof belongs in popup UI, full-screen UI, service worker/controller state, dapp interaction, permissions, network, transaction, migration, or build/config behavior.

Use the runner-appropriate `mms-recipe-harness` delegate (Codex: `$mms-recipe-harness`; Claude/Cursor: `/mms-recipe-harness`) or its installed portable `scripts/recipe-harness verify` wrapper before live CDP proof. Save recipe artifacts under an ignored task directory such as `temp/tasks/<slug>/artifacts/` and report native screenshot/CDP gaps explicitly instead of claiming visual proof from DOM/state alone. Do not require personal shell aliases.

Load `references/metamask-extension-checklist.md` and execute it as the ordered checklist for Extension dev work. Name the target context: popup, sidepanel, fullscreen, dapp tab, or service-worker/controller.
