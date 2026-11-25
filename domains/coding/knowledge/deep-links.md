---
name: deep-links
domain: coding
description: >
  MetaMask deep links: the security model both clients share, how the
  Extension processes a link and what its signature covers, who owns which
  route files, and the checks a deep-link change is reviewed against.
  Canonical source for deeplink-handler and for any review of a route or a
  link parameter.
---

# Deep Links

**This file is the single source of truth** for the deep-link security model
and for how the Extension processes a link. The `deeplink-handler` skill
carries the instructions (client parity, the router boundary, end-to-end
coverage) and cites this file rather than repeating it.

A deep link is untrusted input that arrives looking like navigation. Most links
come from MetaMask, but a registered route is reachable by anyone who can build
the URL. The signature makes some of that input trustworthy, and reviewing a
deep-link change comes down to which part.

## Security Model

These hold in both clients. The decision record is
[Deep Linking Into Wallet](https://github.com/MetaMask/decisions/blob/aa3ad7e1c642cf5e080fafa92c450b323fe8ddca/decisions/core/0011-deep-linking-into-wallet.md#both-public-and-private-deep-links)
(`decisions/core/0011`).

| Rule | Why |
|------|-----|
| A signature is a trust signal, not an authorization | `SignatureStatus` is `VALID`, `INVALID` or `MISSING`. It decides which interstitial shows, never what the route does. Signatures come from an admin interface MetaMask operates and are never reimplemented in a client |
| Canonical is not validated | The handler runs on every status. On an unsigned or invalid link the author writes `sig_params` too, so the canonical parameters are whatever they listed, or the whole query minus `sig` when the list is absent. Only a `VALID` link's canonical parameters are signed |
| A trusted origin skips the interstitial before the signature is consulted | Registering a route makes its destination reachable that way, unsigned and unwarned |
| A parameter outside `sig_params` can be added after signing, and links rely on it | Referral links add each sharer's `ref` to a signed link. A value that must be tamper-evident is listed in `sig_params` when the link is signed. One left outside is acceptable only where its consumer shows it to the user and acts on their choice. Dropping it for being unsigned breaks every link already shared |
| The interstitial is the security boundary | Showing it less often (a trusted origin, an allowlisted action or URL) is a Security policy change with its own approval, never part of adding a route |
| A new class of destination is a security question | A destination that changes state, grants a permission or exposes a toggle goes to the client's security owners before it lands |

Where each client implements the interstitial bypass:

| Client | Bypass | Decided in |
|--------|--------|------------|
| Extension | `TRUSTED_WEB_ORIGINS` | `shouldShowDeepLinkInterstitial`, `shared/lib/deep-links/security-policy.ts` |
| Mobile | `WHITELISTED_ACTIONS`, `interstitialWhitelistUrls` | `app/core/DeeplinkManager/handlers/legacy/handleUniversalLink.ts` |

## Handler Rules

- **Use the parameter you validate.** Validating a parameter and then hardcoding the path changes nothing. If it is worth checking, the destination depends on it.
- **Forward dropped query parameters, or state why not.** A handler that silently discards them is a review finding.
- **An allowlist is a `Set`, a `Map` or `Object.create(null)`, never `{}`.** A lookup against `{}` resolves inherited keys, so `?param=constructor` returns a function and the `?? DEFAULT` fallback never fires. The negative test uses `constructor` or `__proto__`, since an arbitrary unknown key is `undefined` on a broken implementation too.
- **A `redirectTo` destination leaves the extension**, so its origin and path are constants. Copying parameters into its query forwards whatever the handler received.

## Extension: How a Link Is Processed

A link reaches `parse()` (`shared/lib/deep-links/parse.ts`) from one of two places:

- **Intercepted.** `app/scripts/lib/deep-links/deep-link-router.ts` catches top-level navigations to `DEEP_LINK_HOSTS`. A URL longer than `DEEP_LINK_MAX_LENGTH` (2,048 characters) loads as an ordinary page.
- **Deferred.** The `referringLink` of the `deferred_deeplink` cookie on MetaMask's websites, read at install by `shared/lib/install-attribution.ts`. `getDeferredDeepLinkRoute` parses it when onboarding completes, unless it is more than two hours old.

`parse()` looks the route up by the lowercased path. An unknown path returns
`false`, which the router answers with its 404 page and the deferred flow by
dropping the link. Then, in order:

| Step | What it does |
|------|--------------|
| 1. `canonicalize(url)` | Builds the signed string. Replaces an alternate host with the canonical signing origin (`https://link.metamask.io` unless `CANONICAL_DEEP_LINK_HOST` overrides it). With `sig_params`, keeps every value of each parameter it names, adds `sig_params` itself, and sorts. Without it, keeps every parameter except `sig` |
| 2. Route handler | Receives the canonical parameters minus `sig_params`, before verification and on every status. A handler that throws makes `parse()` return `false` |
| 3. `verify(url)` | Checks `sig` against the canonical string locally (ECDSA, P-256, SHA-256). On failure, retries the same path and query under each other configured HTTPS deep-link host. Returns `valid`, `invalid`, or `missing` |

A `valid` link gets the trusted interstitial ("Redirecting to MetaMask"), any
other status the untrusted one ("Proceed with caution"). Whether one shows at
all: a deferred link skips it only when `valid`. An intercepted link skips it
from a `TRUSTED_WEB_ORIGINS` origin, or when `valid` and either onboarding is
incomplete or the user turned the warning off. Neither changes what the handler
received. When it shows, the page in `ui/pages/deep-link/deep-link.tsx` parses
`https://<canonical host><u>` again. So the destination the user continues to
is also computed from the canonical parameters.

Two readers use the original URL, outside the signature:

- **Attribution.** The event built in `shared/lib/deep-links/metrics.ts` reads every parameter except `sig`. It records the last value of a repeated key, and records `ref` only when it appears once. So `signature: valid` sits beside UTM, `attributionId` and `referral_code` values the signature may not cover. The deferred flow's UTM parameters come from the stored link, via `getDeferredDeepLinkParameters` in `ui/selectors/selectors.js`.
- **Referral.** The function `getReferralCode` accepts `ref` only when it appears once and is well formed. Then `withReferralCode` adds it to the destination, after the handler has run. The router does this when no interstitial shows, and the interstitial page does it when the user continues. A deferred link's code is read by `useOnboardingCompletion`. The referral invite shows the code, and the user decides whether to accept it.

Three mechanisms are deliberately absent:

- **No route opts in to the original parameters.** A handler receives the canonical parameters and nothing else.
- **No route declares parameters that must be signed.** A route that forwards attribution decides what to forward in its own handler.
- **`ref` is not ignored when `sig_params` leaves it out.** Keeping the code any other way costs the referral program. Every sharer's code would need its own link signed in the admin interface, or unsigned links would show every recipient the untrusted interstitial.

## Extension: Routes and Ownership

A route is a `Route` in `shared/lib/deep-links/routes/`:

- **`pathname`**, the public path.
- **`getTitle`**, which returns an i18n message key.
- **`handler`**, which returns `{ path, query }` or `{ redirectTo }` and may throw. The handler in `routes/shield.ts` is a short example whose destination depends on a parameter it read.

Registration is `addRoute` in `routes/index.ts`, which throws in `DEBUG` builds
when two routes claim one pathname. End-to-end specs sign links with the
helpers in `test/e2e/tests/deep-link/helpers.ts`. A team that owns the feature
adds a CODEOWNERS entry for its route file, as `routes/perps.ts` has.

| Owner | Files |
|-------|-------|
| Feature team | `routes/<name>.ts` and its registration in `routes/index.ts` |
| Extension Security | `routes/route*`, and `parse*`, `verify*`, `utils*`, `security-policy*` under `shared/lib/deep-links/`, the router, `resolve-deep-link-href*`, `ui/pages/deep-link/` |

Two changes reach Security-owned files without looking like it: a route file
whose name starts with `route`, and a destination constant that
`routes/route.ts` does not already export.

## Extension: Review Checks

Apply these to any change to `shared/lib/deep-links/`, a new or changed route,
or a pull request that says a parameter is signed.

| # | Check | Look for |
|---|-------|----------|
| 1 | The signature still binds the `sig_params` list | `canonicalize` adds the list to the signed string, so rewriting it fails verification. A canonicalization change keeps that |
| 2 | "Canonical" is not read as "validated" | "The handler receives canonical parameters only" bounds nothing unless the link is `valid` |
| 3 | No handler, title or destination gets more than the canonical parameters | Reads of `url.searchParams`, `window.location`, a value passed past `parse`, or `getTitle`, which the interstitial calls with the original parameters. `withReferralCode` is the one deliberate exception |
| 4 | Attribution is forwarded only from what the handler received | `utm_*`, `source` or `attributionId` written into a destination carry whatever the handler received, unsigned on an unsigned link |
| 5 | A value is traced past the handoff | A value written into a hash query and read back later is whatever the hash holds at that moment |
| 6 | The destination is a feature, not a page for the link | The router boundary in `deeplink-handler`. A page named for the link is also where mount-time actions sit, so read it under 3 and 5 |

Where a `valid` signature covers less than it appears to. For each, the
question is whether a route in the change consumes a parameter that reaches it
this way:

- **Empty `sig_params`.** The canonical string is the signing origin and path followed by `?sig_params=`. The handler receives no parameters, and everything else in the URL is unsigned yet still verifies, reaching only original-URL readers.
- **Repeated parameters.** The canonicalizer reads `sig_params` with `.get()` (the first) and each named parameter with `.getAll()`, so every value a handler can read is signed. An original-URL reader can pick another: the analytics event records the last. No reader accepts a repeated `ref`.
- **A parameter added after signing** looks the same as a signed one to an original-URL reader.
- **Path binding.** A signature is bound to the signing origin and the path as written, so it cannot be replayed onto another route. The route lookup lowercases the path, the signature does not.

## Extension: Testing the Signature Boundary

- The suite `shared/lib/deep-links/signature-boundary.test.ts` signs with a real P-256 key and asserts what a handler receives, what `valid` covers and when `verify()` retries.
- The suite `verify.test.ts` mocks the key, `parse.test.ts` mocks `verify`, and a route's own tests call its `handler` directly, so none reaches the boundary. The end-to-end specs sign through `helpers.ts`.
- A real-key unit test runs under `@jest-environment node`, generates a key pair with `crypto.subtle.generateKey`, and replaces only `getKeyData`.
- **Assert absence, not inequality.** A check that one value did not arrive passes when a different unsigned value does.
- **Vary values across cases.** The same literal in accepted and rejected cases cannot tell stripped from never checked.
- **Break the strip and the verification separately**, and note which tests fail. A suite can guard one and not the other.
