---
name: deeplink-handler
description: Add or change a deeplink route in a MetaMask client, covering the route file, its registration, the required E2E test, and the security boundary a feature team does not own. Use when exposing a new deeplink, pointing one at a new destination, or when review raises the interstitial, signature verification, or param canonicalization. Carries the cross-client security model, defers to the client section for the per-client symbols and paths, and lists the defects that recur in review: validated params that never reach the destination, silently dropped query strings, and allowlists written as plain object literals, which admit every prototype key.
---

# Deeplink Routes

A deeplink is an external entry point into the wallet. A registered route is reachable by
anyone who can construct the URL, so the parts that decide whether a link is trusted are owned
separately from the parts that decide where it goes.

Installing this skill for a repository appends that repository's section to this file, below
the shared material. Everything client-specific lives there. In this repository the source
is `repos/<repo>.md` beside this file.

## When To Use

- Exposing a new deeplink for a feature
- Pointing an existing deeplink at a different destination
- Review has raised the security interstitial, signature verification, or param handling
- A deeplink reaches a destination that changes state or grants a permission

Not for changing how links are parsed, verified, or gated. That is a security-boundary change
with a different owner, named in the client section.

## Workflow

1. Read the client section below. The implementations differ substantially, and it names the
   files, symbols and owners this workflow refers to.
2. Confirm which files the change touches, and whether any are security-owned.
3. Write the route or handler, register it, and add the E2E test.
4. If the destination changes state or grants a permission, raise it with the client's
   security owners before the PR lands.

## Security model

`decisions/core/0011-deep-linking-into-wallet.md` is on `main` in `MetaMask/decisions` and is
the record that applies. `decisions/core/0020-shared-deeplink-registry.md` (proposed,
MetaMask/decisions#149) is an open draft. Its own Status section reads `Proposed`, it is not
on `main`, and it lists implementing the package among its non-goals, so nothing in it
describes how either client works today. It proposes moving the public route contract into a
shared package and dispatching to client-owned handlers keyed by a shared `RouteId`, which
would replace per-client route registration in both clients.

Each fact below holds in both clients. The symbols, origin lists, and file paths that
implement them are per-client and are named in the client section.

**A signature is a trust signal, not an authorization.** Both clients verify link signatures.
`SignatureStatus` is `VALID`, `INVALID`, or `MISSING`. A valid signature does not change the
route contract. It changes whether the interstitial shows. Signing happens in the internal
signer service behind privileged Okta and is never reimplemented.

**A trusted origin bypasses the interstitial before the signature is consulted.** A request
from such an origin reaches the destination unsigned and unwarned. Registering a route
inherits this. The bypass itself is unchanged, but the new destination is now reachable that
way. Which origins qualify, and the function that decides, are per-client and are named in the
client section.

**Unsigned links forward every parameter.** A handler assumes hostile input on the unsigned
path.

## Defects that recur in review

**An allowlist must not be a plain object literal.** A lookup against `{}` resolves inherited
keys, so `?param=constructor` returns `function Object() { [native code] }` and the
`?? DEFAULT` fallback never fires. Use a `Set`, a `Map`, or `Object.create(null)`.

*And the negative test must use an inherited key.* `'not-a-setting'` is `undefined` on the
prototype chain too, so it passes against a broken implementation and a correct one alike. It
cannot tell them apart. Test `'constructor'` or `'__proto__'`.

**Use the validated parameter.** Validating a param and then hardcoding the path means the
validation changes nothing. If a param is worth checking, the destination must depend on it.

**Decide about dropped query params, and say so.** A handler that silently discards the params
is a finding. Forward them or state why not.

**A new class of destination is a security question even when the code is routine.** Content
pages and a settings surface carrying consent toggles are not the same risk. If the
destination changes state, grants a permission, or exposes a toggle, raise it with the
client's security owners before it lands rather than after.
