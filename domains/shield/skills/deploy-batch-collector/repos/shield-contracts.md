---
repo: shield-contracts
parent: deploy-batch-collector
---

# shield-contracts overlay

Copy the newest existing chain.

## Files to touch

| File | What to add |
| --- | --- |
| `script/Config.sol` | `networks[<chainId>] = NetworkConfig({name, chainId, isTestnet, blockExplorerUrl})` |
| `foundry.toml` `[etherscan]` | `<slug> = { key = "${<EXPLORER>_API_KEY}", chain = <id>, url = "https://api.etherscan.io/v2/api?chainid=<id>" }` |
| `make/BatchCollectorUpgradeable.mk` | `deploy-<slug>`, `upgrade-<slug>`, `verify-<slug>`, `verify-proxy-<slug>` plus `.PHONY` |
| `.env.example` | `<SLUG>_RPC_URL=` and `<EXPLORER>_API_KEY=` |
| `README.md` | deploy / upgrade / verify / verify-proxy commands and Networks list |

Makefile `--verify` flags must include `--verifier etherscan --verifier-url https://api.etherscan.io/v2/api?chainid=<id>`.

`script/VerifyContract.s.sol` already builds the V2 URL from `block.chainid` when `VERIFIER_URL` is unset. Keep it that way.

## Commands

```bash
make -f make/BatchCollectorUpgradeable.mk deploy-<slug>
make -f make/BatchCollectorUpgradeable.mk verify-<slug>
make -f make/BatchCollectorUpgradeable.mk verify-proxy-<slug>
make -f make/BatchCollectorUpgradeable.mk upgrade-<slug>
```

Broadcast path: `broadcast/DeployBatchCollectorUpgradeable.s.sol/<chainId>/`.

Mainnet `Config.sol` logs `WARNING: Deploying to MAINNET` before broadcast.
