---
name: extension-deep-links
domain: coding
description: >
  MetaMask Extension deep links: how a link is processed, what reads it
  outside the signature, what a signature pins, who owns which files, the
  checks a deep-link change is reviewed against, and how to test the signature
  boundary. Reference for deeplink-handler's Extension guide.
---

# Extension Deep Links

**Scope: MetaMask Extension only.** Mobile handles deep links through a
different mechanism, covered by `deeplink-handler`'s Mobile guide. The rules
for writing a route are in `deeplink-handler`'s Extension guide, and this file
does not repeat them.

## How a Link Is Processed

The decision record is
[Deep Linking Into Wallet](https://github.com/MetaMask/decisions/blob/aa3ad7e1c642cf5e080fafa92c450b323fe8ddca/decisions/core/0011-deep-linking-into-wallet.md#both-public-and-private-deep-links)
(`decisions/core/0011`). A link reaches `parse()` (`shared/lib/deep-links/parse.ts`) three ways:

- **Intercepted.** `app/scripts/lib/deep-links/deep-link-router.ts` catches top-level navigations to `DEEP_LINK_HOSTS` on any scheme, up to `DEEP_LINK_MAX_LENGTH` (2,048 characters). A longer URL loads as an ordinary page. An unregistered path with `share=1` gets a QR page for Mobile instead, which opens no destination.
- **Deferred.** The `referringLink` of the `deferred_deeplink` cookie on MetaMask's websites, read at install and parsed when onboarding completes, unless it is more than two hours old.
- **In-app.** `resolveTrustedDeepLinkHref` (`ui/helpers/utils/resolve-deep-link-href.ts`) resolves links in in-app content, such as the carousel, with no signature check and no interstitial.

`parse()` looks the route up by the lowercased path and returns `false` for an
unknown one. Then, in order:

| Step | What it does |
|------|--------------|
| 1. `canonicalize(url)` | Builds the signed string. An alternate deep-link host becomes `https://` plus the canonical host, dropping the link's scheme and port. The canonical host keeps the link's own scheme. With `sig_params`, keeps every value of each parameter it names, adds `sig_params` itself, and sorts. Without it, keeps every parameter except `sig` |
| 2. Route handler | Receives the canonical parameters minus `sig_params`. On a `missing` or `invalid` link every one of them is unsigned, and the handler cannot tell |
| 3. `verify(url)` | Checks `sig` against the canonical string locally (ECDSA, P-256, SHA-256). If that fails and the link is HTTPS on a configured deep-link host with no port, retries the same signed path and query under each other configured host |

A `valid` link gets the "Redirecting to MetaMask" interstitial, and any other
status gets "Proceed with caution". A deferred link skips the interstitial only
when `valid`. An intercepted link skips it from a trusted web origin at any
status, or when `valid` and either onboarding is incomplete or the user turned
the warning off.

The interstitial page parses the link again under `https://` plus the canonical
host, so the router and the page can disagree. A signed `http://link.metamask.io`
link is `invalid` at the router and `valid` on the page.

A route handler that throws sends an intercepted link to the 404 page, drops a
deferred link, and leaves an in-app link at its original URL. `Route`
lowercases the pathname. In `DEBUG` builds `addRoute` throws when two routes
claim one pathname, and production builds keep the later one without an error.

## Readers Outside the Signature

Code that reads the original URL, not the handler's parameters, sees every
parameter, signed or not. To these readers, a parameter left out of
`sig_params` looks the same as a signed one. Among them:

- the route's `getTitle`, which the interstitial page calls
- the deep-link analytics event (`shared/lib/deep-links/metrics.ts`). For an intercepted link to an in-extension destination it fires before the interstitial decision, so a link the user never continues is still recorded. For a deferred link it fires when onboarding completes
- the App Installed event, which records the whole referring link
- the referral code (`shared/lib/deep-links/referral.ts`), which the router or the interstitial page adds to the extension page URL, and which the referral invite shows for the user to accept or decline. A deferred link carries it only when `valid` and internal
- the Mobile QR page, and the deferred UTM selector

Readers handle a repeated key differently: the analytics event keeps the last
value, the deferred UTM selector the first, and the referral code is dropped
when `ref` repeats. Referral links can carry a `ref` added after signing, so
dropping an unlisted `ref` breaks them.

A route cannot opt in to the original parameters, and cannot declare
parameters that must be signed. A route that forwards attribution decides what
to forward in its own handler.

## What a Valid Signature Pins

- **Host.** On an alternate deep-link host the scheme and port are not signed, so the signature verifies whatever they are. On the canonical host they are part of the signed string.
- **Path.** It is bound to the path as written, so it cannot be replayed onto another route. The route lookup lowercases the path, the signature does not.
- **Time.** `canonicalize` and `verify` check no expiry and no nonce, so a signed link stays valid. Changing a route's handler changes what every link already signed for that path does.

## Who Owns What

Extension Security is the sole owner of the files in the deep-link security
block of `.github/CODEOWNERS`: the router and its test, `parse*`, `verify*`,
`utils*`, `security-policy*` and `routes/route*` under `shared/lib/deep-links/`,
`resolve-deep-link-href*`, `ui/pages/deep-link/` and `AGENTS.md`. Snapshot and
story files are the exception: the exclusion section after the block leaves
them unowned.

No other deep-link file has a Security owner, including `canonicalize.ts`,
`common.ts`, `helpers.ts`, `referral.ts` and `routes/index.ts`. Of the route
files, only `buy*`, `perps.ts` and `musd.ts` have an owner at all. Raise any
change that affects what verifies, what skips the interstitial or what is
reachable with Extension Security, since CODEOWNERS will not request it.

For a route's CODEOWNERS entry, name only the route file, above the deep-link
security block, and never use a pattern that matches a Security path. The last
matching line wins.

Two changes reach Security-owned files without looking like it: a route file
whose name starts with `route`, and re-exporting a new destination constant
from `routes/route.ts`. Importing the constant directly does not.

## Review Checks

Apply these to any change to `shared/lib/deep-links/`, a new or changed route,
or a pull request that says a parameter is signed.

| # | Check | Look for |
|---|-------|----------|
| 1 | The signature still binds the `sig_params` list | `canonicalize` adds the list to the signed string, so rewriting it fails verification. A canonicalization change keeps that |
| 2 | "Canonical" is not read as "validated" | "The handler receives canonical parameters only" bounds nothing unless the link is `valid`. From a trusted web origin, or in-app, a link skips the interstitial |
| 3 | No handler or destination gets more than the canonical parameters | Reads of `url.searchParams`, `window.location`, or a value passed past `parse`. The readers outside the signature are the existing exceptions |
| 4 | Attribution is forwarded only from what the handler received | `utm_*`, `source` or `attributionId` written into a destination carry whatever the handler received, unsigned on an unsigned link |
| 5 | A value is traced past the handoff | A value written into a hash query and read back later is whatever the hash holds at that moment |
| 6 | The destination is a feature, not a page for the link | A page named for the link is also where mount-time actions sit, so read it under 3 and 5 |

## Testing the Signature Boundary

- `verify.test.ts` mocks the key, `parse.test.ts` mocks `verify`, and a route's own tests call its `handler` directly, so none of them reaches the boundary.
- The end-to-end specs sign with a test key through `test/e2e/tests/deep-link/helpers.ts`. `shared/lib/deep-links/helpers.ts` loads the matching public key only in test builds (`IN_TEST`).
- No unit test signs with a real key yet. To write one, run it under `@jest-environment node`, generate a P-256 key pair with `webcrypto.subtle.generateKey`, and replace only `getKeyData`.
- **Assert absence, not inequality.** A check that one value did not arrive passes when a different unsigned value does.
- **Vary values across cases.** The same literal in accepted and rejected cases cannot tell stripped from never checked.
- **Break the strip and the verification separately**, and note which tests fail. A suite can guard one and not the other.
