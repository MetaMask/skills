---
repo: metamask-extension
parent: asset-selector-cleanup
---

# Asset selector cleanup — metamask-extension

Root selector module: `shared/lib/selectors/assets-migration.ts` (config: `scripts/config.metamask-extension.json`). The scripts auto-detect this repo from the git remote or the checkout name; `--repo extension` forces it.

## Repo checks (step 4, run on touched files)

```bash
yarn lint:changed:fix
yarn lint:tsc
yarn test:unit <path/to/file.test.ts>
```
