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

The handler runs before verification, whatever the signature status, so on an
unsigned link its input is whatever the link's author wrote. A link from
`TRUSTED_WEB_ORIGINS` (`https://metamask.io`, `https://app.metamask.io`) skips
the interstitial at any status. Registering a path makes its destination
reachable that way, with the handler's own validation as the only check. Raise
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

- **Read only the parameters the destination needs, validate each one, and drop the rest.** Dropping is the normal case. A handler that passes its whole `params` on, as `routes/shield.ts` does, forwards whatever the link's author wrote.
- **If a value is worth validating, the destination depends on it.** `routes/privacy.ts` is the example: it checks `setting` against a `Set`, falls back to a default, uses the value it checked, and sends an empty query.
- **An allowlist is a `Set`, a `Map` or `Object.create(null)`, never `{}`.** A lookup against `{}` resolves inherited keys, so `?param=constructor` returns a function and the `?? DEFAULT` fallback never fires. The negative test uses `constructor` or `__proto__`, since an arbitrary unknown key is `undefined` on a broken implementation too.
- **A `redirectTo` destination leaves the extension**, so its origin and path are constants.

A `Route` in `shared/lib/deep-links/routes/` has a `pathname`, a `getTitle` that
returns an i18n message key, and a `handler` that returns `{ path, query }` or
`{ redirectTo }` and may throw. A handler that throws sends the link to the 404
page. In `DEBUG` builds, `addRoute` throws when two routes claim one pathname.
End-to-end specs sign links with the helpers in
`test/e2e/tests/deep-link/helpers.ts`. A team that owns the feature adds a
CODEOWNERS entry for its route file, as `routes/perps.ts` has.

### How a Link Is Processed

The decision record is
[Deep Linking Into Wallet](https://github.com/MetaMask/decisions/blob/aa3ad7e1c642cf5e080fafa92c450b323fe8ddca/decisions/core/0011-deep-linking-into-wallet.md#both-public-and-private-deep-links)
(`decisions/core/0011`). In the Extension:

- **Intercepted.** `app/scripts/lib/deep-links/deep-link-router.ts` catches top-level navigations to `DEEP_LINK_HOSTS`. A URL longer than `DEEP_LINK_MAX_LENGTH` (2,048 characters) loads as an ordinary page. A link that `isMobileShareFallback` (`shared/lib/deep-links/mobile-share.ts`) accepts never reaches `parse()`: the router shows a QR code for Mobile instead.
- **Deferred.** The `referringLink` of the `deferred_deeplink` cookie on MetaMask's websites, read at install by `shared/lib/install-attribution.ts`. `getDeferredDeepLinkRoute` parses it when onboarding completes, unless it is more than two hours old.

`parse()` looks the route up by the lowercased path. An unknown path returns
`false`, which the router answers with its 404 page and the deferred flow by
dropping the link. Then, in order:

| Step | What it does |
|------|--------------|
| 1. `canonicalize(url)` | Builds the signed string. Replaces an alternate deep-link host with `https://` plus the canonical host (`link.metamask.io` unless `CANONICAL_DEEP_LINK_HOST` overrides it). With `sig_params`, keeps every value of each parameter it names, adds `sig_params` itself, and sorts. Without it, keeps every parameter except `sig` |
| 2. Route handler | Receives the canonical parameters minus `sig_params`. On a `missing` or `invalid` link every one of them is unsigned, and the handler cannot tell |
| 3. `verify(url)` | Checks `sig` against the canonical string locally (ECDSA, P-256, SHA-256). If that fails and the link is HTTPS on a configured deep-link host with no port, retries the same signed path and query under each other configured host. Returns `valid`, `invalid`, or `missing` |

A `valid` link gets the "Redirecting to MetaMask" interstitial, any other status
the "Proceed with caution" one. A deferred link skips the interstitial only when
`valid`. An intercepted link skips it from a `TRUSTED_WEB_ORIGINS` origin at any
status, or when `valid` and either onboarding is incomplete or the user turned
the warning off. When it shows, the page in `ui/pages/deep-link/deep-link.tsx`
parses the link again, so the destination the user continues to is also
computed from the canonical parameters.

Two readers use the original URL, outside the signature. A parameter left out
of `sig_params` reaches only these, and to them it looks the same as a signed
one:

- **Attribution.** The event built in `shared/lib/deep-links/metrics.ts` reads every parameter except `sig` and `ref`, and records the last value of a repeated key. On a `valid` link signed with `sig_params`, `signature: valid` sits beside UTM and `attributionId` values the signature may not cover.
- **Referral.** The function `getReferralCode` accepts `ref` only when it appears once and is well formed. `withReferralCode` adds it to the extension page URL, outside the hash route, after the handler has run, and `consumeReferralCode` reads and strips it when the page loads. The referral invite (`ReferralInvite`) shows the code, and the user decides whether to accept it. Referral links can carry a `ref` added after signing, so dropping an unlisted `ref` breaks them.

A route cannot opt in to the original parameters, and cannot declare
parameters that must be signed. A route that forwards attribution decides what
to forward in its own handler.

### Who Owns What

| Owner | Files |
|-------|-------|
| Feature team | `routes/<name>.ts` and its registration in `routes/index.ts` |
| Extension Security | `routes/route*`, and `parse*`, `verify*`, `utils*`, `security-policy*` under `shared/lib/deep-links/`, the router and its test, `resolve-deep-link-href*`, `ui/pages/deep-link/`, `AGENTS.md` |

Two changes reach Security-owned files without looking like it: a route file
whose name starts with `route`, and a destination constant that
`routes/route.ts` does not already export.

Four files under `shared/lib/deep-links/` decide what verifies or what skips
`parse()`, and have no Security owner, so a change to them requests no Security
review:

- `canonicalize.ts` builds the signed string.
- `common.ts` sets the intercepted and retried hosts.
- `helpers.ts` loads the key and decodes `sig`.
- `mobile-share.ts` lets a link skip `parse()`.

Raise a change to any of them with Extension Security.

### Review Checks

Apply these to any change to `shared/lib/deep-links/`, a new or changed route,
or a pull request that says a parameter is signed.

| # | Check | Look for |
|---|-------|----------|
| 1 | The signature still binds the `sig_params` list | `canonicalize` adds the list to the signed string, so rewriting it fails verification. A canonicalization change keeps that |
| 2 | "Canonical" is not read as "validated" | "The handler receives canonical parameters only" bounds nothing unless the link is `valid`. From a trusted web origin, a link at any status skips the interstitial |
| 3 | No handler, title or destination gets more than the canonical parameters | Reads of `url.searchParams`, `window.location`, a value passed past `parse`, or `getTitle`, which the interstitial calls with the original parameters. `withReferralCode` is the one deliberate exception |
| 4 | Attribution is forwarded only from what the handler received | `utm_*`, `source` or `attributionId` written into a destination carry whatever the handler received, unsigned on an unsigned link |
| 5 | A value is traced past the handoff | A value written into a hash query and read back later is whatever the hash holds at that moment |
| 6 | The destination is a feature, not a page for the link | A page named for the link is also where mount-time actions sit, so read it under 3 and 5 |

What a `valid` signature does and does not pin:

- **Host.** The same signature verifies on every host in `DEEP_LINK_HOSTS`.
- **Path.** It is bound to the path as written, so it cannot be replayed onto another route. The route lookup lowercases the path, the signature does not.
- **Repeated parameters.** The canonicalizer reads `sig_params` with `.get()` (the first) and each named parameter with `.getAll()`, so every value a handler can read is signed. An original-URL reader can pick another value: the analytics event records the last.
- **Time.** `canonicalize` and `verify` check no expiry and no nonce, so a signed link stays valid. Changing a route's handler changes what every link already signed for that path does.

### Test the Signature Boundary

- `verify.test.ts` mocks the key, `parse.test.ts` mocks `verify`, and a route's own tests call its `handler` directly, so none of them reaches the boundary. The end-to-end specs sign with a real key through `helpers.ts`.
- A unit test with a real key runs under `@jest-environment node`, generates a P-256 key pair with `webcrypto.subtle.generateKey`, and replaces only `getKeyData`.
- **Assert absence, not inequality.** A check that one value did not arrive passes when a different unsigned value does.
- **Vary values across cases.** The same literal in accepted and rejected cases cannot tell stripped from never checked.
- **Break the strip and the verification separately**, and note which tests fail. A suite can guard one and not the other.
