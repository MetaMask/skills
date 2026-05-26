---
repo: metamask-extension
parent: recipe-quality
---

# MetaMask Extension Review Notes

Check these Extension-specific risks:

- Is the browser/channel, extension build, fixture, and dapp/network dependency stated?
- Does the recipe use existing e2e fixtures and browser helpers where available?
- Are popup, full-screen, service worker, and dapp contexts clearly distinguished?
- Are service worker or controller probes tied to internal claims rather than replacing UI proof?
- Does each screenshot happen after a route, selector, service worker, or controller-state settle condition?
- Are test reports, traces, console logs, and screenshots linked to proof targets?
- Does teardown close browser contexts or reset extension state where needed?

Fail Extension recipes that rely on raw CDP or service worker eval as the only proof of a popup UI claim.
