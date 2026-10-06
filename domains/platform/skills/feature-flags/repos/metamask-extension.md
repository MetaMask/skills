---
repo: metamask-extension
parent: feature-flags
---

# Feature flags — MetaMask Extension

- Shared helper: `validatedVersionGatedFeatureFlag` in `shared/lib/remote-feature-flag-utils.ts`.
- `test/e2e/feature-flags/feature-flag-registry.ts` holds production defaults and feeds the E2E `/v1/flags` mock; a scheduled sync PR adds production keys. Grep it on `origin/main` and reuse any synced entry; add a pre-launch key with `inProd: false`.
- E2E with a non-default flag: prefer `manifestFlags.remoteFeatureFlags`. When the consumer reads `RemoteFeatureFlagController` state directly, set the fixture and the `/v1/flags` mock from one constant: the controller refetches whenever the UI opens and overwrites a fixture-only seed.
