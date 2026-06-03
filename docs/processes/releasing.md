# Releasing `@metamask/skills`

This repo follows the same MetaMask package publication model used by Core packages:

1. Prepare a release branch from `main`.

   ```bash
   yarn create-release-branch --bump patch
   ```

   Use `--bump minor` or `--bump major` when appropriate.

2. Review the generated `CHANGELOG.md` section and keep entries consumer-facing.

3. Validate locally.

   ```bash
   yarn changelog:validate
   yarn build
   yarn test
   yarn pack:dry-run
   ```

4. Open and merge the release PR.

5. The merge commit is detected by `MetaMask/action-is-release`, then `.github/workflows/publish-release.yml` runs:
   - `MetaMask/action-publish-release` creates the GitHub release/tag.
   - `MetaMask/action-npm-publish` performs a dry-run package review.
   - The `npm-publish` environment gates the final npm publish with the org `NPM_TOKEN`.

The package is published publicly to npm as `@metamask/skills`.
