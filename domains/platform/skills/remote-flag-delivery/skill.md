---
name: remote-flag-delivery
description: >-
  Prove a new remote feature flag is wired correctly on both sides of the seam — the LaunchDarkly value
  that actually ships through the client-config API, and the app code that reads it. A flag is two
  independent systems that have to agree, and every hop between them fails by silently defaulting: the
  flag is served only for a (client, distribution, environment) triple the build never requests, the
  fetch fails and the error is logged rather than surfaced, the version gate or threshold bucket
  resolves the value into something the read site does not expect, or the E2E mock supplies a value
  production does not have. The falsifier is a matrix whose two arms were the same arm — both cells took
  the default branch because the override never applied, which is indistinguishable from a working flag.
  Runs the on/off/absent matrix with a delivered-value assertion read from controller state rather than
  from the UI, checks the served value against the live client-config response per triple, and checks
  the registry entry the E2E mock reads. Triggers on /mms-remote-flag-delivery, or when asked to validate or
  test a new feature flag, confirm a LaunchDarkly flag reaches the client, prove flag-gated behavior in
  both states, debug a flag that is on remotely but off in the app, or review a PR that adds a remote
  feature flag. Callable by `evidence` as its F5 feature-flag-matrix engine.
maturity: experimental
---

# /remote-flag-delivery

A remote feature flag is the rare change where **the code and the thing that controls it ship
separately**. Code review sees one half. The other half lives in LaunchDarkly, is edited by a human
after merge, and can be wrong in ways no test in the repo will ever notice — because every test in the
repo mocks it.

> **Falsifier.** A matrix whose two arms were the same arm. If the override never applied, both cells
> render the default branch, the screenshots differ for some unrelated reason (or not at all), and the
> result is indistinguishable from a correctly gated feature. **The proof obligation is the delivered
> value in each arm, read out of controller state — not the rendered outcome.**

The second falsifier is the one that reaches users: **green E2E, dark production.** The E2E mock is fed
from a registry checked into the repo, so a flag that exists nowhere upstream still passes every test
you can run locally.

## The chain

Six hops, each with its own way of quietly resolving to the default.

| hop | how it silently defaults | how to observe it |
|---|---|---|
| 1. LD flag definition (project, environment, targeting) | not created in the environment you ship, or targeting excludes your users | LaunchDarkly UI — outside every repo; projects `MetaMask Client Config API - Extension` / `- Mobile`, access via TechOps role `metamask-config` |
| 2. client-config API | key absent for the `(client, distribution, environment)` triple the build requests | `curl` the triple (step 2 below) |
| 3. controller fetch | controller constructed `disabled` (onboarding incomplete **or** basic functionality off) → no request ever; request fails → error logged, state keeps the previous (often empty) value; 15-min interval, 30-min circuit break | `state.cacheTimestamp`; in E2E, `getSeenRequests().length` on the mocked endpoint |
| 4. value processing (version map → threshold bucket → wrapper unwrap) | no version key ≤ client version → flag dropped entirely; no MetaMetrics id → threshold array left **unbucketed** in state; bucket lands on a variant you did not test | `rawRemoteFeatureFlags` (pre-processing) vs `remoteFeatureFlags` (`{ name, value }` for scoped flags) — the pair localizes hop 2 vs hop 4 |
| 5. read site | flag absent → default branch; the helper you imported disagrees with the one the flag was authored for | selector unit test; Settings → Developer Options → **Remote Feature Flags** |
| 6. test substrate (registry + `mock-e2e.js`) | flag unregistered → mock serves nothing → every test exercises the default | registry entry; `yarn feature-flags:sync` |

Hops 1–2 are the remote half, 3–5 the app half, 6 the substrate that makes the app half testable and
the remote half invisible. A validation that covers only one half has not validated a flag.

## Method

### 1. Write down the wire value and the triple

Four wire shapes, and they compose (`contributor-docs/docs/remote-feature-flags.md`):

| shape | value | resolved by |
|---|---|---|
| boolean | `true` | read directly |
| version map | `{ versions: { '13.0.0': …, '13.2.0': … } }` | highest key ≤ client version, else **flag excluded** |
| threshold array | `[{ name, scope: { type: 'threshold', value: 0.3 }, value }, …]` | first item where `userThreshold <= scope.value` |
| version map of threshold arrays | both of the above | version first, then bucket |

Then name the **triple**, because it is not one triple. `client` ∈ `extension | mobile`;
`distribution` ∈ `main | flask` (`beta` deprecated); `environment` ∈ `prod | rc | dev | beta | test |
exp`. The extension picks `environment` from the build (`app/scripts/wallet-init/instance-options/remote-feature-flag-controller.ts`)
— dev builds request `environment=dev` and **default to `dev` when unmapped**, `experimental` builds
force `exp`, and `distribution` follows build type with `experimental → main`.

> A flag created only in the `prod` environment is invisible in every local build and every CI run. A
> flag validated in a local build proves nothing about `prod`. State the triple next to every claim.

### 2. Prove the remote half — live, per triple

```bash
curl -s 'https://client-config.api.cx.metamask.io/v1/flags?client=extension&distribution=main&environment=prod' \
  | jq --arg k '<flagName>' 'map(select(has($k))) | .[0]'
```

Repeat for every triple the claim covers (`environment=dev` for what you tested locally, `flask` if the
flag ships there). The response is an **array of single-key objects**; a non-array response makes the
controller throw `Feature flags api did not return an array`.

Then diff the whole surface against the repo's registry, from `metamask-extension`:

```bash
yarn feature-flags:sync          # report drift, exit 0
yarn feature-flags:sync:check    # exit 1 on drift (what CI runs)
```

**This is not a PR gate.** `.github/workflows/check-feature-flag-registry-drift.yml` runs on
`cron: '0 1 * * 2'` — Tuesdays, despite the comment saying daily — and opens a follow-up PR. Nothing
checks a newly added flag at the time it is added.

**Negative control before believing an absence:** run the same `jq` with a key you know does not exist.
A served flag prints its object; an unserved one prints `null` — and so does a truncated response, a
network failure, or a typo in the flag name. Confirm the control prints `null` *and* that a flag you know
is served prints an object, in the same run. `curl -s` swallows the failure otherwise.

### 3. Run the matrix — three cells, not two

| cell | how to force it | what it proves |
|---|---|---|
| on | override to the enabled value | the gated path is reachable |
| off | override to the disabled value | the gate actually gates |
| **absent** | no override, no mock — empty `remoteFeatureFlags` | the default branch is the *safe* branch |

The absent cell is not hypothetical. It is the state of every user until the first fetch resolves; of
every user whose fetch failed, because `updateRemoteFeatureFlags` catches and `log.error`s so failure
never reaches the UI (`app/scripts/lib/update-remote-feature-flags.ts`); and **permanently** of every
user with basic functionality off or onboarding incomplete, because the controller is constructed
`disabled` in that case and issues no request at all
(`app/scripts/wallet-init/instance-options/remote-feature-flag-controller.ts`,
`app/scripts/wallet-init/remote-feature-flags.ts`). Ship a flag whose absent behavior is the new path
and the new path is what everyone gets during startup and what privacy-conscious users get forever.

Two override mechanisms work in E2E today:

```ts
// (a) manifest override — merged over controller state, wins on conflict
await withFixtures({ manifestFlags: { remoteFeatureFlags: { myFlag: false } } }, async () => { … });

// (b) testSpecificMock — control the raw API response, exercising hops 3–4 for real
mockServer.forGet('https://client-config.api.cx.metamask.io/v1/flags')
  .withQuery({ client: 'extension', distribution: 'main', environment: 'dev' })
  .thenCallback(() => ({ statusCode: 200, json: [{ myFlag: false }] }));
```

Prefer **(b)** when the claim involves processing (version gate, bucketing) — (a) writes a post-processing
value and therefore skips hop 4 entirely. Assert the no-fetch path with `getSeenRequests().length === 0`
on the mocked endpoint, as `test/e2e/tests/remote-feature-flag/remote-feature-flag.spec.ts` does.

> **Never seed the controller's persisted state as your capture method — for a timing claim it is
> worse than no evidence.** Writing `RemoteFeatureFlagController.remoteFeatureFlags` straight into
> `chrome.storage.local` (over CDP, or via a fixture) and then observing the read site is a tempting
> capture: it survives a cold service-worker restart and the read site behaves correctly. But the
> value is already present *before boot*, so any defect in **when** the value becomes available cannot
> occur. That is the opposite of covering it — a green arm is then indistinguishable from a green arm
> on genuinely fixed code, and the method reports success precisely because it disabled the mechanism
> under test.
>
> The failure this hides is real and shipped: `sentry-install` reads
> `globalThis.stateHooks.getPersistedState` before `setup-initial-state-hooks` registers it, so a
> naive read optional-chains through `undefined` and the override silently never applies
> (`metamask-extension#44538`). Only a *real asynchronous fetch* recreates that ordering. Seeding
> destroys it; mocking the endpoint preserves it.
>
> Rule of thumb: count the hops between the mock and the assertion. `manifestFlags` skips hop 4.
> Storage seeding skips hops 2–4 **and** the hook timing — four of the five client-side stages, leaving
> only the read, which is the stage least likely to be wrong.

> **`FixtureBuilder.withRemoteFeatureFlags(...)` does not exist.** It is cited in
> `contributor-docs`, in `docs/ab-testing.md`, and in comments inside the registry itself, but there is
> no implementation anywhere in `test/` — the references are stale. Copying it produces a test that
> fails to compile, or worse, a helper someone stubs to a no-op.

Locally: `.manifest-overrides.json` under `_flags.remoteFeatureFlags`, with
`MANIFEST_OVERRIDES=.manifest-overrides.json` uncommented in `.metamaskrc`. The controller also exposes
`setFlagOverride` / `removeFlagOverride` / `clearAllFlagOverrides` (persisted in `state.localOverrides`)
for driving arms from the background rather than the build.

**Trap — the override is a deep merge, not a replace.** `getRemoteFeatureFlags` is
`merge({}, stateFlags, manifestFlags)` (`shared/lib/selectors/remote-feature-flags.ts`). A partial
object override keeps the state's other keys, and an **array-valued flag merges index-wise** — a
one-element override against a three-element threshold array leaves elements 2 and 3 in place. For
scoped flags, override the *post-bucketing* shape `{ name, value }`, which is what the controller
writes to state anyway.

**Delivered-value assertion (do not skip).** In each arm, read the value the app actually holds —
`uiState.metamask.remoteFeatureFlags[flagName]`, or the Developer Options → Remote Feature Flags panel
for a screenshot (`[data-testid="developer-options-remote-feature-flags"]`, driven by
`DeveloperOptionsPage.validateRemoteFeatureFlagState()`) — and show that the three cells hold three
different values. Two identical values under two different screenshots is one arm and a coincidence.
When the arms disagree with what you served, `rawRemoteFeatureFlags` beside `remoteFeatureFlags` says
whether the value arrived and was mangled, or never arrived.

### 4. Resolve the value the way the read site resolves it

The extension has **two live version-gating helpers that disagree on the same wire value**:

| wire value | `shared/lib/feature-flags/version-gating.ts` | `shared/lib/remote-feature-flag-utils.ts` |
|---|---|---|
| `{ enabled: true, minimumVersion: '13.9.0' }` | `true` when app ≥ 13.9.0 | same |
| `{ enabled: true, minimumVersion: null }` | **`false`** (`hasMinimumRequiredVersion(null)` → false) | **`defaultValue`** (shape rejected → `undefined` → fallback) |
| `{ name, value: { enabled, minimumVersion } }` | not unwrapped | unwrapped (progressive-rollout wrapper) |

`minimumVersion: null` is a shape live in `prod` today (`ledgerDmk` — check the response, not the registry), and
the two helpers resolve it in opposite directions whenever the call site's default is `true`. Read the
import at the call site before predicting anything; both are widely used (`ui/selectors/**` mostly the
latter, rewards/perps/mUSD the former).

Neither is the same comparison the **controller** makes. The controller resolves a `{ versions: … }` map
against `clientVersion`, which the extension passes as `getBaseSemVerVersion()` — major.minor.patch with
any prerelease suffix stripped — while both extension helpers `semver.gte` against the raw
`package.json` version. If that string ever carries a prerelease suffix, the two answers diverge at
exactly the boundary release. A flag gated on an unreleased `minimumVersion` is off everywhere until
that build ships, and a client-version change zeroes `cacheTimestamp` (`prevClientVersion`), so the
first session after an update refetches rather than reusing yesterday's flags.

Bucketing: `sha256(metaMetricsId + flagName)` normalized to `[0,1)`, then the **first** array item where
`threshold <= scope.value`; the result is cached in `state.thresholdCache` per `id:flag`. **With no
MetaMetrics id the array is left in state unbucketed** — a read site expecting `{ name, value }` gets an
array, and `getBooleanFeatureFlag` falls to its default. Metrics-off is therefore a distinct cell, not a
variant. Never report a bucket assignment without the id that produced it; one id is one sample, not a
rollout percentage.

### 5. Check the substrate, not just the run

- **Registry entry** in `test/e2e/feature-flags/feature-flag-registry.ts`, holding the *exact* production
  value including the full threshold array — `mock-e2e.js` serves this to every E2E test. Nothing
  enforces this at PR time: the registry test asserts shape and a couple of named flags, not that every
  referenced flag is registered.
- **State coverage** — `yarn test:e2e:feature-flag:coverage` reports `testedStates: { true, false }` per
  flag; `default-only` means no test ever exercised the other state.
- The global mock matches on `{ client, distribution }` and **omits `environment`**, so any environment
  matches locally. Production does not work that way — this is exactly why step 2 exists.

## Falsifiers

| falsifier | how it looks | kill it with |
|---|---|---|
| both arms were the same arm | matrix passes, cells differ by nothing that came from the flag | delivered-value read per arm (step 3) |
| green E2E, dark production | every test passes; users see the old path | live `curl` per shipped triple (step 2) |
| flag on, feature off | remote value correct, behavior absent | resolve through the actual helper + version + bucket (step 4) |
| absent cell never tested | on/off both fine; startup, fetch-failure and basic-functionality-off show the new path | third cell (step 3) |
| registry proves itself | "registry says `true`" | registry is an input to the mock, not evidence about production |
| bucket read as rollout | "30% see it" from one local run | one id is one sample; report the id, or assert the boundary |
| override skipped the processing | manifest-override arms pass; the version gate or bucket is never executed | serve the raw wire value via `testSpecificMock` for at least one arm |
| off vs. never-fetched conflated | the off arm is really a disabled controller | `getSeenRequests()` in the off arm — a gate that gates and a fetch that never happened are different claims |
| the fixture disabled the defect | a timing claim passes on a tree where the value was seeded into storage before boot, so the race could not occur | serve the value over `testSpecificMock` so the fetch is genuinely async; count the hops between mock and assertion and name the ones skipped |

## Output

```
Remote flag delivery — <flagName>

Remote half
| triple | served value | source |
|---|---|---|
| extension / main / prod | <value or ABSENT> | curl <ts> |
| extension / main / dev   | <value or ABSENT> | curl <ts> |
Registry drift: <yarn feature-flags:sync result>   Controls: absent-key probe → null, known-served key → object

App half
| cell | forced by | delivered value in state | observable | result |
|---|---|---|---|---|
| on | <mechanism> | <value> | <screenshot / assertion> | pass |
| off | <mechanism> | <value> | … | pass |
| absent | no override | undefined | <default branch shown> | pass |

Resolution: <helper at the call site> · minimumVersion <v> vs client <v> · bucket <id → variant>
Substrate: registry entry <present/absent> · state coverage <full | partial | default-only>
Not covered: <triples not queried, clients not run, LD targeting not inspected>
```

Lead with the remote half — it is the half no reviewer can see. A row without a triple, or a cell
without its delivered value, is a claim rather than evidence. LaunchDarkly targeting itself is outside
the repo: if the claim depends on it, say that it was read in the LD UI by a human, or record it as not
covered.

## Not this skill

- **Build-time flags** (`.metamaskrc`, `builds.yml`) — a different mechanism needing one build per arm;
  never conflate the two in a matrix.
- **Experiment wiring and analytics** (`useABTest`, `Experiment Viewed`, `active_ab_tests`) →
  `ab-testing`. This skill proves the value arrives; that one proves the experiment is instrumented.
- **Flag removal** — a flag deleted from code while still served, or still read after deletion →
  `unintended-breakage`.
- **Cross-client parity** for the same flag → `perps-validate-multiproject` for the multi-checkout run.

## References

- `contributor-docs/docs/remote-feature-flags.md` — the four wire shapes, LD access, the add-a-flag
  process; `docs/testing/e2e-testing.md#feature-flags-in-e2e-tests` — override patterns.
- `MetaMask/decisions#43` — remote feature flags ADR; `consensys-vertical-apps/mmwp-client-config-api` —
  the service between LD and clients.
- `@metamask/remote-feature-flag-controller` — `BASE_URL`, `ClientType` / `DistributionType` /
  `EnvironmentType`, `DEFAULT_CACHE_DURATION`, `setFlagOverride` and friends,
  `utils/version.ts` (version map), `utils/user-segmentation-utils.ts` (`calculateThresholdForFlag`,
  `generateDeterministicRandomNumber`).
- `metamask-extension`: `app/scripts/wallet-init/instance-options/remote-feature-flag-controller.ts`
  (triple, 15-min interval, initial `disabled`), `app/scripts/wallet-init/remote-feature-flags.ts`
  (enable/disable orchestration), `app/scripts/lib/update-remote-feature-flags.ts` (swallowed failure),
  `shared/lib/selectors/remote-feature-flags.ts` (merge precedence),
  `shared/lib/remote-feature-flag-utils.ts` + `shared/lib/feature-flags/version-gating.ts` (the two
  helpers), `test/e2e/feature-flags/` (registry, sync script), `test/e2e/mock-e2e.js` (global mock),
  `test/e2e/set-manifest-flags.ts` (how `manifestFlags` reaches the build),
  `test/e2e/page-objects/pages/debug-page.ts` (the Developer Options readout),
  `docs/ab-testing.md` (threshold naming + local override shape).
- Mobile requests the same service with `client=mobile`. `contributor-docs` prescribes a per-flag
  selector under `app/selectors/featureFlagsController/<flag>/` carrying its own fallback values, and
  `OVERRIDE_REMOTE_FEATURE_FLAGS=TRUE` in `.js.env` to force those fallbacks locally. **Every command and
  path in this skill is verified against `metamask-extension` only** — confirm the mobile wiring in a
  current checkout before reusing them, and treat a mobile claim proved with extension steps as not
  covered.
