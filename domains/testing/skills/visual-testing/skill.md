---
name: visual-testing
description: Drives the MetaMask Chrome extension via the mm CLI for visual testing in Chrome (headed by default, headless with MM_HEADLESS=true). Use when asked to visually verify UI changes, capture screenshots or debug extension UI state. Trigger phrases include "verify visually", "take a screenshot", "test the flow", and "check the UI".
---

## CLI invocation

`mm` is a project-local dependency. Run it from the repository root, where `node_modules/` is:

```bash
node_modules/.bin/mm <command>   # from the repository root
```

This skill and its repo overlays write commands as `mm <command>`; run them as `node_modules/.bin/mm <command>`. `yarn mm <command>` also works but is slower, because Yarn starts on every call.
