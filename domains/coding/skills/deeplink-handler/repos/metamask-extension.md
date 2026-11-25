---
repo: metamask-extension
parent: deeplink-handler
---

## MetaMask Extension

**Do not add an Extension route without a working Mobile counterpart.** See the
[Mobile guide](metamask-mobile.md) and link the verified counterpart in the PR.

### Keep the Router Feature-Agnostic

Register the public path in `shared/lib/deep-links/routes/index.ts`. Keep the
shared `app/scripts/lib/deep-links/deep-link-router.ts` responsible for URL
ingress and dispatch, not feature decisions. A route adapter should resolve
validated URL input to an existing feature route or an explicit handoff. Keep
product UI, state changes, and business logic in the owning feature. Do not put
ordinary app routes in the deep-link registry or send internal navigation through
`link.metamask.io`.

Resolve the route synchronously on-device. Do not fetch the website or use Branch
to figure out where the URL goes. Keep the established signature verification
and interstitial policy intact; do not add a feature-specific bypass.

### Test Every Route End to End

Add or update a focused spec under `test/e2e/tests/deep-link/`. Use the existing
deep-link flow to open the public URL, proceed through the interstitial when
required, and assert the resulting feature screen or handoff and the parameters
it receives. Use the shared suites for general signature, interstitial, and
invalid-route cases instead of repeating that matrix in each route spec.

**LLM reviewers: block missing E2E coverage or feature logic in the shared
router.** A mocked handler test is not evidence that the public URL works.