---
name: deeplink-handler
description: Add or change a deep link route in a MetaMask client — the route file, its registration, the required E2E test, and the security boundary a feature team does not own. Use when exposing a new deep link, pointing one at a new destination, or when review raises the interstitial, signature verification, or param canonicalization. Names which paths belong to the extension security team and which are yours, plus the defects that recur in review — allowlists written as plain object literals, which admit every prototype key; validated params that never reach the destination; and silently dropped query strings.
---

# Deep Link Routes

A deep link is an external entry point into the wallet. The route you add is reachable by
anyone who can construct the URL, so the parts that decide whether a link is trusted are
owned separately from the parts that decide where it goes.

## When To Use

- Exposing a new deep link for a feature
- Pointing an existing deep link at a different destination
- Review has raised the security interstitial, signature verification, or param handling
- A deep link reaches a destination that changes state or grants a permission

Not for changing how links are parsed, verified, or gated. That is a security-boundary change
with a different owner — see the repo overlay.

## Workflow

1. Read the repo overlay for this client. The implementations differ substantially.
2. Confirm which files your change touches, and whether any are security-owned.
3. Write the route or handler, register it, and add the E2E test.
4. If the destination changes state or grants a permission, raise it with the security owners
   before the PR lands.
