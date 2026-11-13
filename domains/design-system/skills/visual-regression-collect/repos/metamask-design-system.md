---
repo: metamask-design-system
parent: visual-regression-collect
---

# MMDS monorepo

- Hosted `main` iframes:
  `https://metamask.github.io/metamask-design-system/iframe.html?id=<storyId>&viewMode=story`
  and the same under `/react-native/`. Story ids: `index.json` at the same
  roots.
- Local Storybook on the current branch: `yarn storybook` (React web,
  port 6006) and `yarn workspace @metamask/storybook-react-native storybook:web`
  (React Native web, port 6007).
- Temporary showcase story (delete after capture, never commit):
  `src/components/VisualRegressionSandbox/VisualRegressionSandbox.stories.tsx`
  in each platform package. Use realistic props from existing stories.
- Packages to search for importers: the `src/` folders of
  `@metamask/design-system-react` and `@metamask/design-system-react-native`.
- PR body template: `.github/pull_request_template.md`; PR steps are in the
  `create-pr` skill.
