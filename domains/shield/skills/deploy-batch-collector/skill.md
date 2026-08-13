---
name: deploy-batch-collector
description: >-
  Add a chain and deploy, verify, or upgrade BatchCollectorUpgradeable in
  Shield contracts. Use when asked to deploy the Shield batch collector on a
  new chain or add network support.
maturity: stable
---

# Deploy BatchCollectorUpgradeable

Copy the newest existing chain in the consumer repo rather than inventing a new layout.

Do not commit `.env`, private keys, or secrets. Broadcast JSON is a local record only; it does not lock on-chain permissions.

## When to use

- Add a new EVM chain to Shield contracts
- Deploy / verify / upgrade `BatchCollectorUpgradeable` on a chain

## Prerequisites

- Foundry (`forge`, `cast`). Confirm `forge --version` knows the chain before enabling `--verify`.
- Env file copied from the repo example (never commit secrets).
- Chain ID, RPC URL, explorer URL, and an Etherscan API V2 key.

## Workflow

### 1. Collect chain facts

Need: slug, chain ID, RPC env name, explorer API env name, explorer site, mainnet vs testnet.

### 2. Patch network wiring

Copy the newest existing chain. Add the chain to network config, explorer verification, deploy/upgrade/verify commands, env example, and docs.

Existing chains already use Etherscan API V2 (`https://api.etherscan.io/v2/api?chainid=<id>`). Copy that URL. Do not introduce a V1 explorer endpoint.

### 3. Choose roles before broadcasting

`ADMIN_ADDRESS` can grant/revoke roles and authorize UUPS upgrades. `OPERATOR_ADDRESS` submits `collectPayments`. `TREASURY_ADDRESS` receives withdrawals.

- Test deploy: set admin, operator, and treasury to one address you control so withdrawals do not need extra signers.
- Prod deploy: use the real role split. Confirm who holds `ADMIN_PRIVATE_KEY` before promising an upgrade.

The deployer key (`DEPLOYER_PRIVATE_KEY`) only needs gas. It does not have to be admin.

### 4. Deploy

Run the consumer repo's `deploy-<slug>` target. Required: deployer key, admin, operator, treasury, and RPC. Explorer key optional but recommended.

If Foundry reports `Chain <id> not supported`, upgrade Foundry or drop `--verify` for this chain, deploy, then verify with the `verify-*` targets.

### 5. If verify fails after a successful broadcast

On-chain deploy already happened. Do not redeploy. Set implementation, proxy, and the same constructor/initialize addresses, then run `verify-<slug>` and `verify-proxy-<slug>`.

### 6. Keep broadcast logs

Foundry writes `broadcast/<Script>/<chainId>/run-latest.json`.

- Commit `run-latest.json`.
- If `run-<timestamp>.json` is missing, copy `run-latest.json` to `run-<timestamp>.json` using the `timestamp` field inside the JSON.
- Do not use `--resume` against another account's logs. A new deployer key is not blocked by old files.
- Upgrading the existing proxy requires the on-chain admin key (`ADMIN_PRIVATE_KEY`), not the original deployer.

### 7. Format and PR

After a Foundry bump, run `forge fmt` before pushing. Include broadcast artifacts in the PR. Never include `.env`.

## Examples

### Add a chain, then deploy

User: "Deploy BatchCollector to `<chain>` for testing."

Agent: add the chain using Etherscan V2; set test roles to one controllable address; run `deploy-<slug>`; if verify fails, run `verify-<slug>` and `verify-proxy-<slug>`; commit broadcast JSON.

### Later deploy with a different key

User: "Redeploy with a different deployer account."

Agent: do not `--resume`. Use the new `DEPLOYER_PRIVATE_KEY` and the intended `ADMIN_ADDRESS` / `OPERATOR_ADDRESS` / `TREASURY_ADDRESS`. Old broadcast files are logs only.

## Troubleshooting

**`You are using a deprecated V1 endpoint`**
Use `https://api.etherscan.io/v2/api?chainid=<id>` for verification.

**`Chain <id> not supported` during `--verify`**
Foundry is too old for that chain. Upgrade, or deploy without `--verify` and verify separately.

**CI `forge fmt --check` fails after a Foundry upgrade**
Run `forge fmt` and push. Do not mix formatting with unrelated edits if CI is already red.

**Cannot withdraw after a test collect**
Treasury is a different address, or you are not admin. Admin can change treasury/operator; only treasury receives tokens.

## Security considerations

- Never print, commit, or paste `DEPLOYER_PRIVATE_KEY` / `ADMIN_PRIVATE_KEY`.
- Confirm chain, roles, and RPC before `--broadcast` on mainnet.
- Upgrade is UUPS: only `ADMIN_ROLE` on the proxy can upgrade.
