---
repo: metamask-mobile
parent: recipe-dev
---

# MetaMask Mobile

For Mobile dev tasks, prove visible changes on the intended simulator/device when practical. Use `mm-harness verify` before live recipe proof and keep harness/generated files out of the product diff summary.

Prefer existing fixtures, page objects, and wallet-control primitives before adding new runtime helpers. If the simulator/app cannot be prepared, mark runtime proof blocked with the verify/preflight artifact path.
