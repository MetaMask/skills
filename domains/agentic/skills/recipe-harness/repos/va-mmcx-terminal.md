---
repo: va-mmcx-terminal
parent: recipe-harness
---

# Terminal

- Exclude harness overlay paths from product diffs/PR evidence.
- The app is the checkout's Next.js dev server on the slot's watcher port, with Hyperliquid testnet forced; `mm-harness launch` uses that server and refuses mainnet unless asked explicitly. Outside a farm slot, start it with `MM_HARNESS_TERMINAL_PREPARE=1 mm-harness doctor --fix` (it needs `DATABASE_URL` pointing at a local PostgreSQL).
- After pulling main, run `npm install` before launching: a stale install makes pages fail with `Export … doesn't exist in target module` (HTTP 500).
- Record the signer: the MetaMask Extension (default; it loads a built Extension dist) or the injected test wallet (`--signer injected`).
- Recover only through `mm-harness` and the `Next:` commands it prints.
