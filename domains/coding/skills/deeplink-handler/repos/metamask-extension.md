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

The handler runs before verification, whatever the signature status, so on a
link whose signature is missing or invalid, its input is whatever the link's
author wrote. A link from
`TRUSTED_WEB_ORIGINS` (`https://metamask.io`, `https://app.metamask.io`) skips
the interstitial at any status. Registering a path makes its destination
reachable with no interstitial from those origins and from in-app content, and
from any link after one click, so the handler's validation is the only check on
what arrives. Raise
a destination that changes state or grants a permission with Extension Security
before it lands.

### Test Every Route End to End

Add or update a focused spec under `test/e2e/tests/deep-link/`. Use the existing
deep-link flow to open the public URL, proceed through the interstitial when
required, and assert the resulting feature screen or handoff and the parameters
it receives. Use the shared suites for general signature, interstitial, and
invalid-route cases instead of repeating that matrix in each route spec.

**LLM reviewers: block missing E2E coverage or feature logic in the shared
router.** A mocked handler test is not evidence that the public URL works.

### Write the Handler

- **Read only the parameters the destination needs, validate each one, and drop the rest.** Use the value you checked, as `routes/privacy.ts` does with `setting`. Routes such as `routes/buy.ts`, `shield.ts`, `card.ts` and `swap.ts` pass every parameter on, and are not the pattern to copy.
- **Look a parameter up with a `Set`, a `Map` or `Object.hasOwn`, or check the result against the allowed values.** A bare lookup on `{}` resolves inherited keys, so `?param=constructor` returns a function and a `?? DEFAULT` fallback never fires. The negative test uses `constructor` or `__proto__`.
- **A `redirectTo` destination leaves the extension**, so its origin, path and set of query keys are constants.
- **`getTitle` receives every parameter of the original link, signed or not.** Return a constant.
- **Check the pathname is not already registered, ignoring case.** Without `DEBUG` set, the default in every build and test, the later route replaces the earlier one without an error.
- **Don't start the route file's name with `route`.** `routes/route*` is in the deep-link security block, which would make Security the file's sole owner.

`knowledge/extension-deep-links.md` is the reference for how a link is processed and reviewed.
