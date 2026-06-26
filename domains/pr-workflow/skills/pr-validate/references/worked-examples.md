# Worked examples (end-to-end)

Full runs: claim → lanes → capture → trust-gate → publish. The visual case is in the skill's main instructions; these cover the non-visual claim shapes.

## Perf — "defer Rive wasm at startup"
- **Claim:** on cold start of the home view, the Rive wasm chunk isn't requested until the animation surface mounts. **Surface:** startup network + chunk graph. **Falsifier:** the chunk appears in the cold-start waterfall. **Baseline:** base requests it at startup.
- **Lanes:** AEP perf validation (primary) → chunk membership + CDP netlog (corroborate).
- **Capture:** paired build of base vs head (`yarn webpack --test`); CDP netlog over cold start for each; source-map chunk membership of the Rive runtime.
- **Trust gate:** cold-vs-cold (not warm); the chunk truly absent (not deferred by a few ms); the netlog covers the whole startup window.
- **Publish:** before/after request list + a chunk-membership table in the PR body. No screenshot needed.

## Migration — "add migration NNN"
- **Claim:** loading a profile from `<prior>` applies NNN; `changedKeys = {X, Y}`; all other state intact. **Falsifier:** an untouched controller mutated / malformed state. **Baseline:** a prior-version profile.
- **Lanes:** migration test (primary) → vault round-trip (if the vault is touched).
- **Capture:** run `NNN.test.js` (old-state-in → new-state-out); assert `changedKeys`; load a real prior-version profile and confirm boot.
- **Trust gate:** the test asserts more than the happy path; `changedKeys` matches the actual mutations; the fixture is a real prior profile, not synthetic.
- **Publish:** the `changedKeys` assertion + before/after state shape; link the test run.

## Flag-gated — "Perps banner behind a remote feature flag"
- **Claim (×2):** flag on → banner shows; flag off → banner absent. **Surface:** home/Perps. **Falsifier:** banner state ≠ flag state. **Baseline:** each flag state is its own baseline.
- **Lanes:** flag matrix → visual per state.
- **Capture:** mock the client-config response for each flag state; screenshot each.
- **Trust gate:** the flag is actually toggled (read `remoteFeatureFlags`); two distinct states are shown, not the same frame twice.
- **Publish:** a two-up before/after (flag off / flag on) in the PR body.

## Refactor / no-op — "extract a hook, no behavior change"
- **Claim (negation):** behavior of `<surface>` is unchanged. **Falsifier:** any output/behavior diff. **Baseline:** base behavior.
- **Lanes:** regression suite stays green + snapshot diff empty + bundle size within noise.
- **Trust gate:** snapshots were *not* regenerated to hide a diff; the tests actually cover the surface; bundle delta is within noise, not "small but real".
- **Publish:** "no behavior change — regression suite green, snapshots unchanged, bundle ±0"; link CI. A passing screenshot is not evidence here.
