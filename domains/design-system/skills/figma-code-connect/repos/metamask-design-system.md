---
repo: metamask-design-system
parent: figma-code-connect
---

# MMDS monorepo

- Canonical Figma file: [MMDS Components](https://www.figma.com/design/1D6tnzXqWgnUC3spaAOELN/%F0%9F%A6%8A-MMDS-Components?node-id=0-1)
  (`fileKey` `1D6tnzXqWgnUC3spaAOELN`).
- Token and environment setup: `docs/figma-code-connect.md`.
- Config: `figma.config.json` in each platform package.

```bash
yarn figma:connect:react                  # React wizard
yarn figma:connect:react-native           # React Native wizard
yarn figma:connect:publish:dry-run        # Validate both
yarn figma:connect:publish                # Publish both (CI does this on merge)
yarn figma:connect:unpublish              # Unpublish both
yarn figma:connect:publish:react:dry-run
yarn figma:connect:publish:react-native:dry-run
```

References: [Code Connect docs](https://www.figma.com/code-connect-docs/),
[React](https://www.figma.com/code-connect-docs/react/).
