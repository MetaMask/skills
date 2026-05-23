---
name: recipe-harness
description: Install, verify, and clean up MetaMask recipe runtimes for Mobile and Extension checkouts. Use before recipe-cook, recipe-qa, recipe-wallet-control, recipe-evidence, or recipe-quality when runtime evidence needs CDP/browser/mobile recipe execution, especially on historical commits or fresh checkouts.
maturity: experimental
---

# Recipe Harness

`recipe-harness` makes a product checkout recipe-capable without making the product repo permanently own the runtime files.

This is an extraction/overlay of the working runtimes, not a downgraded generic runner.

## Rules

- Run `install` before claiming runtime recipe proof.
- Run `verify`; failed harness verification blocks runtime claims and is not a product failure.
- Keep product diffs/evidence separate from harness overlay files.
- Record the harness manifest path, source version, adapter, verification status, and artifacts in PR evidence.
- Call direct injected scripts for automation. `yarn a:*` aliases are developer convenience only.

## Command Shape

Use the bundled script from either the source skill checkout or the installed target skill:

```bash
<skill-dir>/scripts/recipe-harness.sh <mobile|extension> <install|verify|cleanup> --target <repo> [...]
```

See `references/contract.md` for the manifest and validation contract.
