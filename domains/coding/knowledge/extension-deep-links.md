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
different mechanism, covered by `deeplink-handler`'s Mobile guide.

## How a Link Is Processed

A link reaches `parse()` (`shared/lib/deep-links/parse.ts`) three ways:

- **Intercepted.** `app/scripts/lib/deep-links/deep-link-router.ts` catches top-level tab navigations to `DEEP_LINK_HOSTS` over http or https, up to `DEEP_LINK_MAX_LENGTH` (2,048 characters). A longer URL loads as an ordinary page.
- **Deferred.** The `referringLink` of the `deferred_deeplink` cookie on MetaMask's websites, read at install and parsed when onboarding completes, unless the cookie's own `createdAt` is more than two hours in the past. Its signature is checked the same way as an intercepted link's.
- **In-app.** `resolveTrustedDeepLinkHref` (`ui/helpers/utils/resolve-deep-link-href.ts`) resolves links in in-app content, such as the carousel, with no signature check and no interstitial. New in-app content uses ordinary routes instead, per `deeplink-handler`'s router and feature boundary.

`parse()` looks the route up by the lowercased path and returns `false` for an
unknown one. Then, in order:

| Step | What it does |
|------|--------------|
| 1. `canonicalize(url)` | Builds the signed string. With `sig_params`, keeps each parameter it names, with every value, plus `sig_params` itself. Without it, keeps every parameter except `sig`. The host and scheme rules are in `canonicalize.ts` |
| 2. Route handler | Receives the canonical parameters minus `sig_params` |
| 3. `verify(url)` | Checks `sig` against the canonical string. It can retry under the other configured deep-link hosts, under conditions set in `verify.ts` |

`shouldShowDeepLinkInterstitial` in `shared/lib/deep-links/security-policy.ts`
decides whether an intercepted or deferred link shows the interstitial. It
treats an unknown onboarding state as complete.

The interstitial page parses the link again under `https://` plus the canonical
host, so the router and the page can disagree. A signed `http://link.metamask.io`
link is `invalid` at the router and `valid` on the page.

A route handler that throws sends an intercepted link to the 404 page, drops a
deferred link, and leaves an in-app link at its original URL.

## Readers Outside the Signature

Code that reads the original URL, not the handler's parameters, sees every
parameter, signed or not. To these readers, a parameter left out of
`sig_params` looks the same as a signed one. Among them:

- the route's `getTitle`, which the interstitial page calls
- the deep-link analytics event (`shared/lib/deep-links/metrics.ts`). For an intercepted link to an in-extension destination it fires before the interstitial decision, so a link the user never continues is still recorded. For a deferred link it fires when onboarding completes
- the App Installed event, which records the whole referring link
- the referral code (`shared/lib/deep-links/referral.ts`), which the router or the interstitial page adds to the extension page URL, outside the hash route and not in the route's query, and which the referral invite shows for the user to accept or decline. A deferred link that is `valid` and in-extension sets the code when onboarding completes. One that is not `valid` opens the interstitial page, which adds it if the user continues, unless an onboarding redirect is pending. A `redirectTo` link carries no code at any status
- the Mobile QR page, and the deferred UTM selector

Readers handle a repeated key differently: the analytics event keeps the last
value, the deferred UTM selector the first, and the referral code is dropped
when `ref` repeats. Referral links can carry a `ref` added after signing, so
dropping an unlisted `ref` breaks them.

A route cannot opt in to the original parameters, and cannot declare
parameters that must be signed. A route that forwards attribution decides what
to forward in its own handler.

## What a Valid Signature Pins

- **Path.** It is bound to the path as written, so it cannot be replayed onto another route.
- **Time.** `canonicalize` and `verify` check no expiry and no nonce, so a signed link stays valid. Changing a route's handler changes what every link already signed for that path does.

## Who Owns What

Extension Security is the sole owner of the deep-link security block of
`.github/CODEOWNERS`. Snapshot and story files are the exception: the exclusion
section after the block leaves them unowned.

No other deep-link file has a Security owner, including `canonicalize.ts`,
`common.ts`, `helpers.ts`, `referral.ts` and `routes/index.ts`. CODEOWNERS
requests Security only for a change that touches a file in the block.

For a route's CODEOWNERS entry, name only the route file, above the deep-link
security block, and never use a pattern that matches a Security path. The last
matching line wins.

The block matches by filename prefix, so a new file under
`shared/lib/deep-links/` that matches one of its patterns requests Security,
and so does a destination constant re-exported from `routes/route.ts`.
Importing the constant directly does not.

## Review Checks

Apply these to any change to `shared/lib/deep-links/`, a new or changed route,
or a pull request that says a parameter is signed.

| # | Check | Look for |
|---|-------|----------|
| 1 | The signature still binds the `sig_params` list | `canonicalize` adds the list to the signed string, so rewriting it fails verification. A canonicalization change keeps that |
| 2 | No handler or destination gets more than the canonical parameters | Reads of `url.searchParams`, `window.location`, or a value passed past `parse`. The readers outside the signature are the existing exceptions |
| 3 | A value is traced past the handoff | A value written into a hash query and read back later, including by mount-time actions on the destination page, is whatever the hash holds at that moment |

## Testing the Signature Boundary

- `verify.test.ts` mocks the key and `crypto.subtle`, `parse.test.ts` mocks `verify`, and a route's own tests call its `handler` directly, so none of them reaches the boundary.
- The end-to-end specs sign with a test key through `test/e2e/tests/deep-link/helpers.ts`. `shared/lib/deep-links/helpers.ts` loads the matching public key only in test builds (`IN_TEST`).
- No unit test signs with a real key yet. To write one, run it under `@jest-environment node`, generate a P-256 key pair with `webcrypto.subtle.generateKey`, and replace only `getKeyData`. `verify` caches the imported key, so reset the module between keys.
- **Assert absence, not inequality.** A check that one value did not arrive passes when a different unsigned value does.
- **Vary values across cases.** The same literal in accepted and rejected cases cannot tell stripped from never checked.
- **Break the strip and the verification separately**, and note which tests fail. A suite can guard one and not the other.
