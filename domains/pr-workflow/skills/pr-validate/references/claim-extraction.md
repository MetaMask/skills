# Claim extraction

Before choosing any lane, turn the PR into a **falsifiable, surface-specific claim**. Every lane is only as good as the claim it tests. A vague claim ("improves perf", "fixes the bug") can't be proven or refuted; a sharp claim names the precondition, action, observable outcome, and what would disprove it.

## Read these, in order

1. **PR body** — Description (what/why), `Fixes #N`, Manual testing steps, the Before/After intent.
2. **Linked issue(s)** — the bug report / acceptance criteria; "Steps to reproduce" and "Expected vs actual" are the claim in the reporter's words.
3. **The diff** (`gh pr diff`) — what actually changed: which surfaces, controllers, modules. Anchor the claim to what the code can do, not only what the body promises.
4. **Labels / type** — bug vs feat vs perf vs refactor changes the claim shape (see special cases).

## Extraction steps

1. **Asserted change** — what does the PR say it does? (body + issue)
2. **Anchor to the diff** — which surface/module changed? Reconcile intent with the diff. If the body promises X but the diff can't deliver X, **flag the drift** — that's a finding, not a claim.
3. **Phrase as falsifiable** — `Given <precondition>, when <action>, then <observable outcome>.` The outcome must be observable and checkable. Replace vague verbs (improve / fix / handle / support) with the concrete observable.
4. **Pin the surface + reachability** — exact screen / API / metric. Reachable in the default fixture, or does it need state seeding, a feature flag, or a fallback surface?
5. **Classify the type** → routes to lanes via the matching guide: visible UI · non-visible perf · telemetry · persisted-state · build-output · behavior-no-UI.
6. **Decompose mixed claims** — a PR that changes UI *and* shifts a metric is two claims; validate each.
7. **Flow-spanning claims: derive falsifiers by mapping, not intuition.** When the claim spans a flow (a data path or a UI/action sequence), build a **flow map** — states × transitions, each node and edge anchored to the implementing file:line — and derive a breaking-scenario matrix by probing every node with standard axes: failure at each step · ordering permutations · lifecycle boundaries mid-flow (destroy/close/replace) · population boundaries (empty / first-ever / unbounded N) · state-freshness splits (a stale retry vs a superseding write; partial state) · entry-condition variants (fresh install, a flag not yet persisted). Each row becomes a falsifier closed by a lane, or an honest open item with a tracker. The map + matrix is itself publishable evidence — an uncovered row is a finding, not an omission to hide. Trust-gate: an unanchored diagram is narrative; an unsystematic list is vibes; the map's own falsifier is a reachable path it's missing.
7. **Name the falsifier** — what observation would prove it FALSE? (the negative). The trustworthiness anchor.
8. **Set the baseline** — before/after needs a "before": the base ref, a before-window (telemetry), or a test that **fails on `main`** (bug fixes).

## Claim Card (output)

```
Claim:     Given <precondition>, when <action>, then <observable>.
Surface:   <screen / API / metric>  (reachable? seed / flag / fallback: …)
Type:      <visible | perf | telemetry | state | build | behavior>  → lanes <…>
Falsifier: <observation that would disprove the claim>
Baseline:  <base ref | fails-on-main test | before-window>
```

One card per claim. For a refactor, the claim is a **negation** (see below).

## Claim quality bar

A good claim is **falsifiable** (observable outcome + clear falsifier), **surface-specific** (names the exact screen/API/metric, not "the app"), **diff-anchored** (the changed code can plausibly produce it), **bounded** (one behavior, one precondition), and **measurable** where quantitative (a number + threshold, not "faster").

## Anti-patterns → refinements

| Vague claim | Refined |
|---|---|
| "Improves performance" | "Opening the Activity tab: TBT drops below 200ms (was >600ms)" — name the interaction, metric, threshold |
| "Fixes the bug" | "With privacy mode on, the Perps tab balance is masked" — observable behavior + precondition + surface |
| "Refactor, no behavior change" | Negation claim: "behavior of `<surface>` is unchanged" → prove via a regression test staying green / snapshot / identical output, **not** a screenshot |
| "Adds a null check" (restates the diff) | "No crash when `<field>` is null on `<surface>`" — the behavior, not the code |
| Body promises X, diff does Y | Not a claim — **flag the drift** to the author |

## Special cases

- **Refactor / no-op:** the claim is "nothing observable changed." Falsifier = any behavior/output diff. Prove via a regression test staying green, an empty snapshot diff, identical bundle/output, or a benchmark within noise. A passing screenshot proves nothing here.
- **Bug fix:** the strongest claim form ships its own falsifier — a test that fails on `main` and passes on the branch. Extract the claim straight from the issue's "Expected vs actual."
- **Perf:** always quantify — metric + interaction + threshold + baseline. Without a number it isn't falsifiable.
- **Persisted-state / migration:** claim = "upgrading from `<prior version>` preserves `<state>` and applies `<change>`." Falsifier = corrupted/lost state. Baseline = a profile from the prior version.
- **Flag-gated:** two claims, one per flag state.

## Worked examples

- **Visible:** body "privacy mode doesn't hide the Perps balance"; issue: expected masked, actual visible; diff touches the Perps balance component. → **Claim:** *Given privacy mode on, when I open the Perps tab, the balance is masked.* **Surface:** Perps tab (gated → fallback: Shield entry modal). **Type:** visible. **Falsifier:** balance digits visible under privacy mode. **Baseline:** same flow on base reproduces the bug.
- **Perf:** body "defer Rive wasm at startup"; diff: dynamic `import()` of the Rive runtime. → **Claim:** *On cold start of the home view, the Rive wasm chunk is not requested until the animation surface mounts.* **Surface:** startup network + chunk graph. **Type:** perf. **Falsifier:** the chunk appears in the cold-start waterfall. **Baseline:** base requests it at startup.
- **Migration:** diff adds a state migration. → **Claim:** *Loading a profile from `<prior>` applies the migration; `changedKeys` covers only the touched controllers; all other state intact.* **Type:** state. **Falsifier:** an untouched controller mutated, or migrated state malformed. **Baseline:** a prior-version profile.
