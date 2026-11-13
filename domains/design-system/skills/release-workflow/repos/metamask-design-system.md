---
repo: metamask-design-system
parent: release-workflow
---

# MMDS monorepo commands

```bash
yarn create-release-branch                       # release/<version> + spec
yarn constraints --fix && yarn && yarn dedupe    # after editing the spec
yarn changelog:validate
yarn build && yarn test && yarn lint
```

- Do not run `yarn changelog:update` outside a release branch.
- Release PR template: `.github/PULL_REQUEST_TEMPLATE/release.md`
  (`?template=release.md`).
- Reviewer guide: `docs/reviewing-release-prs.md`; process:
  `docs/contributing.md#releasing`.
- `MIGRATION.md` lives in `@metamask/design-tokens` and each platform
  package.
