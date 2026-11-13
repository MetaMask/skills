---
repo: metamask-mobile
parent: asset-selector-cleanup
---

# Asset selector cleanup — metamask-mobile

Root selector module: `app/selectors/assets/assets-migration.ts` (config: `scripts/config.metamask-mobile.json`). The scripts auto-detect this repo from the git remote or the checkout name; `--repo mobile` forces it.

## Repo checks (step 4, run on touched files)

```bash
yarn lint:fix
yarn lint:tsc
yarn test:unit <path/to/file.test.ts>
```
