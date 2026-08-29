---
repo: metamask-extension
parent: deeplink-handler
---

# Authoring a Deep Link Route (Extension)

Extension deep links are `Route` objects in `shared/lib/deep-links/routes/`, parsed and
verified by a security boundary that a feature team does not own. This file covers adding a
route. It does not cover changing how links are parsed, verified, or gated — that is a
different task with a different reviewer.

## What you own, and what pulls in Security

`.github/CODEOWNERS` draws the line, and it is mechanical rather than a judgement call:

| Path | Owner |
|---|---|
| `shared/lib/deep-links/routes/<your-route>.ts` | you |
| `shared/lib/deep-links/routes/index.ts` | you (registration only) |
| `shared/lib/deep-links/routes/route*` | `@MetaMask/extension-security-team` |
| `shared/lib/deep-links/parse*`, `verify*`, `utils*`, `security-policy*` | `@MetaMask/extension-security-team` |
| `app/scripts/lib/deep-links/deep-link-router.ts` | `@MetaMask/extension-security-team` |
| `ui/helpers/utils/resolve-deep-link-href*`, `ui/pages/deep-link/` | `@MetaMask/extension-security-team` |

If your change reaches any owned path, you are no longer adding a route — stop and read the
next section before writing the diff.

## The interstitial is not yours to weaken

`AGENTS.md` rule 17, verbatim:

> **DEEPLINK INTERSTITIAL SECURITY — EXTREMELY HIGH RISK:** Before implementing any change
> that can cause fewer deep links to show the security interstitial, agents **MUST stop and
> obtain explicit, documented consent from `@MetaMask/extension-security-team`**. Without
> documented Security approval, do not make the change—even when it appears necessary to
> complete another feature, migration, refactor, or test fix.

`security-policy.ts` carries the same instruction in its header, addressed to agents
specifically: *"Do not add bypasses, route or asset allowlists, remote lookups, or broader
trusted sources in pursuit of another task."*

Treat both as hard stops. "The feature needs it" is the case they were written for.

## Security model

Authority is [ADR-0011 (Deep Linking Into Wallet)][adr11] and [ADR-0020 (Shared Deeplink
Registry)][adr20]. Three facts a route author has to hold:

**Signature is a trust signal, not an authorization.** Both clients verify link signatures.
`SignatureStatus` is `VALID`, `INVALID`, or `MISSING`. A valid signature does not change the
route contract; it changes whether the interstitial shows. Signing happens in the internal
signer service behind privileged Okta — never reimplement it.

**A trusted origin bypasses the interstitial before the signature is consulted.**
`shouldShowDeepLinkInterstitial` returns `false` for a request origin in
`TRUSTED_WEB_ORIGINS` — today exactly `https://metamask.io` and `https://app.metamask.io` —
ahead of any signature check. So a link initiated from those origins reaches your
destination unsigned and unwarned. **Registering a route inherits this.** You have not
changed it, but your destination is now reachable that way.

**Unsigned links forward every parameter.** `canonicalize` keeps only the `sig_params`
allowlist for signed links; with no `sig_params` it takes a backward-compatibility branch and
forwards every param except `sig`. Your handler must assume hostile input on the unsigned
path.

## Adding a route

**1. Write the route file.** `shared/lib/deep-links/routes/<name>.ts`:

```ts
import { Route, SETTINGS_ROUTE, SHIELD_PLAN_ROUTE } from './route';

export const shield = new Route({
  pathname: '/shield',
  getTitle: (_: URLSearchParams) => 'deepLink_theTransactionShieldPage',
  handler: function handler(params: URLSearchParams) {
    return { path: SHIELD_PLAN_ROUTE, query: params };
  },
});
```

`getTitle` returns an **i18n message key**, not a display string. `handler` returns a
`Destination` — either `{ path, query }` or `{ redirectTo: URL }` — and may throw if the
params cannot be processed.

**2. Register it** in `shared/lib/deep-links/routes/index.ts`. Import and add to the exported
map. This is the line that makes the destination reachable.

**3. Add an E2E test.** Not optional. From review on
[#38003](https://github.com/MetaMask/metamask-extension/pull/38003): *"We always need e2e
tests for these routes (I'm sure some teams are slipping by without adding them, but they
aren't supposed to!)"*

**4. Add the CODEOWNERS entry** for your route file if your team owns the surface, following
`routes/perps.ts @MetaMask/perps`.

## Defects that recur in review

**An allowlist must not be a plain object literal.** A lookup against `{}` resolves inherited
keys, so `?setting=constructor` returns `function Object() { [native code] }` and the
`?? DEFAULT` fallback never fires. Use a `Set`, a `Map`, or `Object.create(null)`.

*And the negative test must use an inherited key.* `'not-a-setting'` is `undefined` on the
prototype chain too, so it passes against a broken implementation and a correct one alike —
it cannot tell them apart. Test `'constructor'` or `'__proto__'`.

**Use the validated parameter.** Validating `type` and then hardcoding the path means the
validation changes nothing. If a param is worth checking, the destination must depend on it.

**Decide about dropped query params, and say so.** A handler that silently discards `params`
is a finding. Forward them or state why not.

**Do not reintroduce `handlerSearchParams`.** The field existed and was reverted; `main`
carries zero occurrences. Routes default to canonical param handling, which removes unsigned
params for signed links. Restoring per-route control reopens what the reverts closed.

**A new class of destination is a security question even when the code is routine.** Content
pages and a settings surface carrying consent toggles are not the same risk. If your
destination changes state, grants a permission, or exposes a toggle, raise it with the
`@MetaMask/extension-security-team` before it lands rather than after.

[adr11]: https://github.com/MetaMask/decisions/blob/main/decisions/core/0011-deep-linking-into-wallet.md
[adr20]: https://github.com/MetaMask/decisions/pull/149
