---
name: recipe-harness
description: Install, verify, and clean up MetaMask recipe runtimes for Mobile and Extension checkouts. Use before recipe-cook, recipe-qa, recipe-wallet-control, recipe-evidence, or recipe-quality when runtime evidence needs CDP/browser/mobile recipe execution, especially on historical commits or fresh checkouts.
maturity: stable
---

# Recipe Harness

`recipe-harness` makes a product checkout recipe-capable without making the product repo permanently own the runtime files.

This is an extraction/overlay of the working runtimes, not a downgraded generic runner. Installed skills mirror the shared `adapters/` bundle for self-contained use; follow the target repo overlay to choose `mobile` or `extension`.

## Rules

- Run `install` before claiming runtime recipe proof.
- Run `verify`; failed harness verification blocks runtime claims and is not a product failure.
- Keep product diffs/evidence separate from harness overlay files.
- Record the harness manifest path, source version when available, adapter, verification status, and artifacts in PR evidence. If installed from a copied skill, `source.revision` may be `unknown`; record the installed skill path and PR/branch instead.
- Call direct injected scripts for automation. `yarn a:*` aliases are developer convenience only.

## Command Shape

For humans, prefer the smart wrapper from either the source skill checkout or the installed target skill:

```bash
<skill-dir>/scripts/mm-harness                  # auto-detect current repo and install
<skill-dir>/scripts/mm-harness verify --static-only
<skill-dir>/scripts/mm-harness verify --cdp-port <port>
```

`mm-harness` auto-detects `metamask-mobile` vs `metamask-extension`, defaults `--target` to the current directory, prints progress, and defaults to `install` when no action is supplied.

For orchestration or explicit automation, keep using the low-level stable form:

```bash
<skill-dir>/scripts/recipe-harness.sh <mobile|extension> <install|verify|cleanup> --target <repo> [...]
```

See `references/contract.md` for the manifest and validation contract.
