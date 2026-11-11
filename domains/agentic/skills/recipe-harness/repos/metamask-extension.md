---
repo: metamask-extension
parent: recipe-harness
---

# Extension

- Exclude harness overlay paths from product diffs/PR evidence.
- Record whether the claimed surface is popup, fullscreen, side panel, or service worker.
- Before proof that opens a confirmation screen (gas estimation), check the home banner "Unable to connect to Ethereum". While it shows, confirmations cannot be created: scope the proof or record the blocker with the banner text.
- Page-realm singletons (for example `PerpsStreamManager`) survive same-tab navigation; reproduce MV3-restart bugs with a UI reload.
