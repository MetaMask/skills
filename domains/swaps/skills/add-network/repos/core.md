---
repo: core
parent: add-network
---


# Add Swaps/Bridge Network (Core Controllers)

`knowledge/add-network-core.md` is the single source of truth.

Follow `knowledge/add-network-core.md` section `Agent Execution Standard (SSOT)` for:

- prerequisites
- network classification
- reference implementations
- implementation checklist
- package contract validation
- required response sections

## Validation

1. `yarn workspace @metamask/bridge-controller test`
2. `yarn workspace @metamask/bridge-status-controller test` only when BridgeStatus is touched
