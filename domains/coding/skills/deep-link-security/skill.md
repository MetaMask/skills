---
name: deep-link-security
description: >
  Add, change or review a deep-link route in a MetaMask client: the route file, its registration,
  the required E2E test, and the signature boundary a feature team does not own. Use on any change
  that adds or edits a route, points one at a new destination, forwards a query parameter to a
  destination, builds a page or hook a deep link opens, or states that a parameter is signed,
  whatever the task is about. The recurring failure is reading "canonical" as "validated": the
  handler runs on every signature status, and on an unsigned link the author writes `sig_params`
  too. The client section names the files, the owners and the documents that hold the model.
---

# Deep-link security

A deeplink is an external entry point into the wallet. A registered route is reachable by
anyone who can construct the URL, so the parts that decide whether a link is trusted are owned
separately from the parts that decide where it goes.

Installing this skill for a repository appends that repository's section to this file, below
the shared material. This file holds only the principles both clients share. Everything else
is in the client section. In this repository the source is `repos/<repo>.md` beside this file.

## Security model

`decisions/core/0011-deep-linking-into-wallet.md` is on `main` in `MetaMask/decisions` and is
the record that applies.

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

**Canonical is not validated.** A handler runs on every signature status. On an unsigned link the
author writes `sig_params` too, so the canonical parameters are whatever the author lists, or the
whole query minus `sig` when the list is absent. Only a `VALID` link's canonical parameters are
covered by a signature.

**Use the validated parameter.** Validating a param and then hardcoding the path means the
validation changes nothing. If a param is worth checking, the destination must depend on it.

**Decide about dropped query params, and say so.** A handler that silently discards the params
is a finding. Forward them or state why not.

**A new class of destination is a security question even when the code is routine.** Content
pages and a settings surface carrying consent toggles are not the same risk. If the
destination changes state, grants a permission, or exposes a toggle, raise it with the
client's security owners before it lands rather than after.
