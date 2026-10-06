---
repo: metamask-extension
parent: feature-flags
---

# Feature flags — MetaMask Extension

- `test/e2e/feature-flags/feature-flag-registry.ts` holds production defaults and feeds the E2E `/v1/flags` mock. `sync-production-flags` and the registry drift workflow keep it current: before adding a key, grep the registry on `origin/main` and match a synced entry instead of adding a copy.
- An E2E test that needs a non-default flag sets the fixture state and the `/v1/flags` mock from one constant: the controller refetches on load and overwrites a fixture-only seed.
