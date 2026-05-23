# Recipe Harness Contract

## Manifest

Each install writes `.agent/recipe-harness/<adapter>/manifest.json` in the target checkout.

Required fields:

- `adapter`: `mobile` or `extension`
- `installedAt`
- `source`: skill/runtime source path and git revision when available
- `target`
- `installedPaths`
- `patchedFiles` (may be an empty array for adapters that only copy ignored runtime files)
- `backupDir`
- `cleanupCommand`
- `productDiffExcludes`

## Verification

Verification writes artifacts under `.agent/recipe-harness/<adapter>/verify/`.

Mobile verification should prove, when a live app is available:

- `scripts/perps/agentic/**` backing scripts are installed.
- direct script entrypoints work; harness automation must not depend on `yarn a:*`.
- `package.json` exposes optional `a:*` aliases that point at the injected backing scripts.
- CDP connects.
- `globalThis.__AGENTIC__` exists.
- route read works.
- `scripts/perps/agentic/app-state.sh status` works.
- wallet fixture setup/unlock works when fixture data exists.
- screenshot capture works.
- a tiny recipe can emit summary, trace, and artifact manifest.

Extension verification should prove:

- runner files are installed.
- CDP/browser connection works when a browser is available.
- one non-UI sample recipe runs.
- one UI/browser sample recipe runs when feasible.
- product diff excludes harness files.

Static verification is useful for install/idempotency checks but does not prove runtime behavior.

## Source Revision Caveat

When install runs from a copied installed skill directory rather than a git checkout, `source.revision` may be `unknown`. Treat `source.skillDir`, `source.runtime`, adapter name, manifest timestamp, and the PR/branch that installed the skill as the audit trail in that case.

## Static vs Live Verification

Static verification can prove install shape and idempotency only. Live Extension verification requires `--cdp-port`; if it is omitted outside `--static-only`, verification must fail or report `liveMode: missing-cdp` so agents cannot claim runtime proof from static checks.
