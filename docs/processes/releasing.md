# Releasing `@metamask/skills`

This repo follows the same MetaMask package publication model used by Core packages:

1. Cut the release branch and pull request with the **Create Release PR** workflow:
   dispatch it from the repository's Actions tab with `base-branch: main` and
   either a `release-type` (`major`, `minor`, or `patch`) or an explicit
   `release-version`. The workflow uses `MetaMask/action-create-release-pr` to
   create the `release/<version>` branch, bump the version in `package.json`, and
   open the release pull request with a generated `CHANGELOG.md` section.

2. Review the generated `CHANGELOG.md` section and keep entries consumer-facing.
   If pull requests merged to `main` after the branch was cut, merge `main` into
   the release branch and fold their changes into the release entries, so nothing
   in the tag ships without a changelog entry.

3. Validate locally.

   ```bash
   yarn lint:changelog --rc
   yarn build
   yarn test
   yarn pack:dry-run
   ```

   CI runs `yarn lint:changelog --rc` on `release/*` branches.

4. Merge the release pull request.

5. The merge commit is detected by `MetaMask/action-is-release`, then
   `.github/workflows/publish-release.yml` runs, in order:

   - `MetaMask/action-npm-publish` performs a dry-run package review and notifies
     the `@metamask-npm-publishers` Slack group.
   - The `Publish to NPM` job runs in the gated `npm-publish` environment and
     publishes the package. `NPM_TOKEN` only needs to be set in that environment
     for the first publish of the package, and removed afterwards.
   - `MetaMask/action-publish-release` creates the GitHub release and tag.

The package is published publicly to npm as `@metamask/skills`.
