# Recipe Harness Contract

## Manifest

Each install writes `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/<adapter>/manifest.json` in the target checkout.

Required fields:

- `adapter`: `mobile` or `extension`
- `installedAt`
- `source`: skill UX wrapper path/revision plus resolved runner source path/revision/kind when available. Prefer `METAMASK_RECIPE_RUNNER_SOURCE`; local development may use a sibling `metamask-recipe-runner` checkout. The skills repo does not own the runner runtime.
- `target`
- `installedPaths`
- `patchedFiles` (may be an empty array for adapters that only copy ignored runtime files)
- `backupDir`
- `cleanupCommand`
- `productDiffExcludes`

## Overlay Source Files

Mobile app overlay templates under `adapters/mobile/app-overlay/` use `.patch` suffixed filenames such as `AgenticService.ts.patch`. They are full overlay templates, not TypeScript files meant to compile inside the skills repo. The installer strips the `.patch` suffix when copying them into the target checkout. This keeps editors and reviewers from treating target-specific imports as broken skills-repo source.

## Verification

Verification writes artifacts under `${RECIPE_HARNESS_ROOT:-temp/agentic/recipe-harness}/<adapter>/verify/`.

Every live verification must classify the runtime before trusting evidence:

- `runtimeOwner`: harness-owned, compatible external, incompatible external, or unknown when derivable from ports/processes/manifest/profile;
- CDP reachability and selected target metadata;
- recipe bridge reachability;
- native screenshot capability or the reason fallback evidence would be used;
- Metro/webpack log locations;
- fixture/profile status (`READY`, `MISSING_FIXTURES`, or `STALE_OR_INVALID`);
- cleanup ownership, so agents know what they can safely stop at the end.

Build/reuse rule: verification must not silently kick off an expensive native/full build when a runtime is missing or incompatible. Prefer reuse, installed-app fingerprint checks, shared build-cache artifacts, Expo/native prebuild artifacts, and Extension watch output. Mobile live verify defaults to `fast` preflight mode, which fails before native rebuild; modes that can rebuild (`auto`, `rebuild-native`, `clean`) require an explicit caller/human decision and should be recorded in the evidence.

Mobile verification should prove, when a live app is available:

- `scripts/perps/agentic/**` backing scripts are present from the product checkout or an explicit external Mobile bridge source; they are not bundled in the skills repo.
- direct script entrypoints work; harness automation must not depend on `yarn a:*`.
- `package.json` exposes optional `a:*` aliases that point at the product/external backing scripts when overlay install is used.
- CDP connects.
- `globalThis.__AGENTIC__` exists.
- route read works.
- `scripts/perps/agentic/app-state.sh status` works.
- wallet fixture setup/unlock works when fixture data exists.
- screenshot capture works.
- a tiny recipe can emit summary, trace, and artifact manifest.
- externally-started Metro/app states are detected as compatible only if the recipe bridge and screenshot capture work; otherwise verification must relaunch/reconnect through the harness path or fail with actionable diagnostics.

Extension verification should prove:

- runner files are installed.
- CDP/browser connection works when a browser is available.
- extension build readiness is derived from `dist/chrome/manifest.json` so
  historical MV2/MV3 commits are handled without hardcoding current output
  filenames.
- one non-UI sample recipe runs.
- one UI/browser sample recipe runs when feasible.
- product diff excludes harness files.
- externally-started webpack/Chrome/CDP states are detected as compatible only if the loaded extension target is recipe-controllable and screenshot/evidence capture works; otherwise verification must relaunch/reconnect through the harness path or fail with actionable diagnostics.

## Recipe authoring boundary

The skills repo is only the installer/invoker. Recipe semantics come from
Farmslot Recipe Protocol v1 and the resolved MetaMask recipe runner manifest.

- Read the runner action manifest before writing a recipe; only manifest-listed
  actions are callable.
- Use `metamask.*` actions for reproducible setup/teardown, direct supported
  product/controller operations, and read/assert checks.
- Use official `ui.*` actions for any human-visible proof path: pressing a
  button, entering an input/keypad value, scrolling an element into view, and
  capturing screenshots.
- Do not use direct controller/CDP calls to replace the UI path for a visual
  acceptance criterion. Controller/API calls are acceptable for setup when the
  recipe then proves the resulting state.
- Drag/swipe proof is not available until the runner manifest advertises
  `ui.gesture` and live action-validation proves it on Mobile and Extension.

## Source Revision Caveat

When install runs from a copied installed skill directory or unpacked runner package rather than a git checkout, `source.skillRevision` or `source.runnerRevision` may be `unknown`. Treat `source.skillDir`, `source.runnerDir`, `source.runnerSourceKind`, adapter name, manifest timestamp, and the PR/branch that installed the skill as the audit trail in that case.

## Static vs Live Verification

Static verification can prove install shape and idempotency only. Live Extension verification requires `--cdp-port`; if it is omitted outside `--static-only`, verification must fail or report `liveMode: missing-cdp` so agents cannot claim runtime proof from static checks.
