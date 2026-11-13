---
repo: metamask-design-system
parent: component-documentation
---

# MMDS monorepo

- README templates: `docs/component-readme-examples/` (React `.mdx`, React
  Native `.md`).
- READMEs and stories live in the component folder of each platform package.

```bash
yarn storybook                                             # React web, port 6006
yarn workspace @metamask/storybook-react-native storybook:web  # React Native web, port 6007
yarn storybook:ios:build && yarn storybook:ios             # React Native iOS
yarn storybook:android:build && yarn storybook:android     # React Native Android
yarn build-storybook                                       # Static build
yarn test:storybook                                        # Storybook accessibility tests
```

A local static build writes the same components manifest as the hosted one,
for your branch: `apps/storybook-react/storybook-static/manifests/components.json`
after `yarn build-storybook`, or `http://localhost:6006/manifests/components.json`
while Storybook runs. React Native: `http://localhost:6007/manifests/components.json`.
