---
name: mobile-visual-testing
description: Drives MetaMask Mobile through the mm CLI for visual testing on an iOS Simulator or Android emulator. Use when asked to visually verify UI changes, capture screenshots or debug Mobile UI state. Trigger phrases include "verify visually", "take a screenshot", "test the flow", and "check the UI".
---

# Mobile visual testing

## Running the CLI

Run the CLI from the repository root, where `node_modules/` is installed:

```bash
node_modules/.bin/mm <command>   # from the repository root
```

This skill writes commands as `mm <command>`; run them as `node_modules/.bin/mm <command>`. `yarn mm <command>` also works but is slower, because Yarn starts on every call.
