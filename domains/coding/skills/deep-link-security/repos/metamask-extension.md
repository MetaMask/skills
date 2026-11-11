---
repo: metamask-extension
parent: deep-link-security
---

# Deep-link security

`docs/deep-links.md` is the single source of truth for how a deep link is processed and what to check.

## When To Use

- Exposing a new deeplink for a feature
- Pointing an existing deeplink at a different destination
- Review has raised the security interstitial, signature verification, or param handling
- A deeplink reaches a destination that changes state or grants a permission

Changing how links are parsed, verified, or gated is a security-boundary change with a different
owner, the extension security team. Reviewing such a change still uses this skill.

## How to use

1. Read `docs/deep-links.md` in full before writing or reviewing the change.
2. Answer its six review questions and its three checks under "Where a valid signature covers less than it appears to", for the change in hand.
3. Report as below.

## Authoring a route

Adding or changing a route is documented at `docs/deeplink-route-authoring.md`: the ownership split
with the extension security team, the interstitial rule, the extension's trusted origins and
canonicalization, and the four steps of adding a route.

1. Confirm which files the change touches, and whether any are security-owned.
2. Write the route or handler, register it, and add the E2E test.
3. If the destination changes state or grants a permission, raise it with the extension
   security team before the PR lands.

`decisions/core/0020-shared-deeplink-registry.md` (proposed,
MetaMask/decisions#149) is an open draft. Its own Status section reads `Proposed`, it is not
on `main`, and it lists implementing the package among its non-goals, so nothing in it
describes how either client works today. It proposes moving the public route contract into a
shared package and dispatching to client-owned handlers keyed by a shared `RouteId`, which
would replace per-client route registration in both clients.

## Checks at a glance (details in the doc)

- The signature binds the `sig_params` list.
- Canonical is not read as validated.
- Nothing past the canonical parameters reaches a handler, a title or a destination.
- Attribution is forwarded only from what the handler received.
- What consumes a value after the handoff refuses what it cannot match.
- Empty `sig_params`, repeated parameters, and path binding.
- The destination is a feature that does not depend on the link.

## Defects that recur in review

**An allowlist must not be a plain object literal.** A lookup against `{}` resolves inherited
keys, so `?param=constructor` returns `function Object() { [native code] }` and the
`?? DEFAULT` fallback never fires. Use a `Set`, a `Map`, or `Object.create(null)`.

*And the negative test must use an inherited key.* `'not-a-setting'` is `undefined` on the
prototype chain too, so it passes against a broken implementation and a correct one alike. It
cannot tell them apart. Test `'constructor'` or `'__proto__'`.

## CI coverage is neither re-verified nor narrated

Before running a lane, run the pull request's own committed tests against its falsifier: change the mechanism and run the test that covers it. If that test fails, CI already closes the falsifier. Drop the lane and leave it out of the output entirely: no check counts, no "tests pass at head", no "CI already covers X". Only a falsifier the committed tests stay green under earns a lane, and only that lane's result is reported.

## Reporting

Sort findings by which of the three processing steps they belong to, or by what consumes the destination after the handoff, because that is where a fix lands. Distinguish a claim that is false from one that is narrower than it reads. The second is the more common outcome here, and a useful report says what a reviewer would otherwise assume.

Findings that reach code outside the change belong to the system, not to the author. Route them by subject: anything about the signature boundary itself goes to the security owners rather than into a pull request comment. A finding under review question 6 is a design finding and goes on the pull request as a review comment.

### When nothing turns up

A null is a fact about what was checked, so it ships with the checks. It goes where a finding would have gone, routed by subject as above: the security owners, never the pull request.

```
Deep-link security: <repo>#<n> (<title>)
head [`<sha>`](<commit URL>) · range [`<merge-base>..<head>`](<compare URL>)

✅ **Signature boundary holds: <one sentence on what the change does with link parameters>**

| Check | Holds because | Where |
|---|---|---|
| The signature binds the `sig_params` list | … | <permalink> |
| Canonical is not read as validated | … | <permalink> |
| Nothing past canonical reaches a handler, a title or a destination | … | <permalink> |
| Attribution is forwarded only from what the handler received | … | <permalink> |
| What consumes the value after the handoff refuses what it cannot match | … | <permalink> |
| Empty `sig_params` | … | <permalink> |
| Repeated parameters | … | <permalink> |
| Path binding | … | <permalink> |
| The destination is a feature that does not depend on the link | … | <permalink> |
| <each claim the pull request makes about the boundary> | … | <permalink> |

Not reached: <each thing the run did not read or run, with its reason>
```

- The head and the range are links, so a reader opens the exact diff that was read.
- Every row is filled. A row with nothing behind it reads the same as a row that held.
- A row cites the code that holds, at the head SHA, or the package source at the version the lockfile resolves.
- No row cites a test. A falsifier the committed tests already close is left out, as the section above says.
- A row that is narrower than it reads is a finding, not a null. Report it as one.
- Omit "Not reached" only when nothing was left out.

## Related

- `consent-gate-diligence`, for what happens to a parameter after it is accepted: a campaign value that arrives validly still has to clear the marketing-consent gate.
- Mobile's deep links are a separate mechanism. The shared material above this section applies to both clients.
