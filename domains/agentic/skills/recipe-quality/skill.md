---
name: recipe-quality
description: Critique per-PR validation recipes and their evidence. Use when an agent or reviewer needs a structured verdict on acceptance-criteria coverage, recipe graph quality, adapter independence, evidence fit, flake risk, and the highest-value fixes before trusting a recipe.
maturity: experimental
---

# Recipe Quality

`recipe-quality` is the review loop for executable validation recipes. Use it after `/recipe-cook`, after a recipe run, or whenever recipe evidence looks weak. The job is to decide whether the recipe actually proves the intended PR claims and to return concrete fixes, not generic QA advice.

Load only what applies:

- Canonical protocol: `$FARMSLOT_ROOT/docs/RECIPE-PROTOCOL-V1.md`
- Full rubric: `references/rubric.md`
- Critique examples: `references/examples.md`
- Target-repo review notes are appended below when installed.

## Inputs

Use whatever is available:

- PR/task context, acceptance criteria, changed files, or proof targets.
- `recipe.json` or another recipe graph.
- Optional run artifacts: `summary.json`, `trace.json`, `artifact-manifest.json`, screenshots, videos, logs, reports, and command output.
- Optional runner/adapter notes from the target repo.

If evidence is missing, say so. Do not infer that a recipe is validated because the graph looks plausible.

## Modes

### Recipe-Only Mode

Use when only the recipe and task context are present. Judge whether the graph is executable, complete, well decomposed, and likely to produce useful artifacts.

### Recipe + Evidence Mode

Use when run artifacts are present. Judge whether the artifacts prove the recipe's named claims, whether the run settled before screenshots/assertions, and whether logs/traces match the expected nodes.


## Composition / Start-State Checks

Treat recipe composition as a first-class quality gate. A clean pass requires the recipe to preserve a concise proof story:

- each AC/proof target maps to a focused proof flow;
- repeated setup/navigation/teardown is handled by reusable parameterized `ensure_*` flows when the runner publishes them;
- the recipe declares the domain starting state before proof begins;
- proof screenshots/videos capture the user-visible AC interaction, not generic setup noise;
- setup remains reproducible in `trace.json`/`summary.json` even when excluded from proof media.

For MetaMask Perps, expect setup/start-state flows such as `metamask.wallet.ensure_unlocked` and `metamask.perps.start_state({ network, provider, page, market, position })` when they are available in the installed manifest/flow catalog.

## Mandatory Failure Conditions

Return `fail` or `pass-with-gaps` (never clean `pass`) when any of these apply:

- a visible UI acceptance criterion has no screenshot/video or equivalent
  reviewer-visible artifact;
- screenshot/video artifacts for visible UI acceptance criteria are blank, black,
  or otherwise non-reviewable unless an alternate reviewer-visible proof is
  included and the gap is explicit;
- screenshot/video artifacts for visible UI acceptance criteria do not visibly
  show the claimed component/text/state, show it below the fold or obscured, or
  show the wrong screen/tab/panel;
- a visual/mixed acceptance criterion relies only on fiber-tree/DOM presence,
  `manifest-declared state assertions`, controller state, or recipe pass status without a viewport
  assertion (`ui.scroll` `scroll_into_view` + `ui.wait_for` `visible`) and a
  screenshot backed by a state assertion;
- DOM-rendered fallback screenshots may satisfy reviewer-visible evidence only
  when they are labelled as fallback artifacts and derived from the live page in
  the same recipe run;
- `summary.json` or `trace.json` is missing for a claimed runtime recipe pass;
- a production recipe inlines repeated setup/navigation despite available domain `ensure_*` flows;
- a production recipe has no declared setup/start-state contract and relies on hidden wallet/account/network/provider/page state;
- `artifact-manifest.json`/evidence manifest is missing or references files that
  do not exist;
- the agent claims acceptance criteria from unit tests only when the task
  requested runtime/visual proof;
- the recipe never ran and the response does not clearly mark the gap;
- the run depends on hidden local-runtime-only context when the goal is standalone
  skills validation.

When failing, name the weak layer: product, recipe, fixture/state setup,
harness/runtime, skill instruction, evidence packaging, or runner steering.

## Required Output Sections

Always return these sections:

1. `Verdict` — `pass`, `pass-with-gaps`, or `fail`, with one sentence why.
2. `Coverage Gaps` — missing or weak acceptance-criteria/proof-target coverage.
3. `Graph / Flow Issues` — broken transitions, over-broad nodes, bad boundaries, or missing teardown.
4. `Adapter / Reuse Issues` — unnecessary raw steps, project-specific coupling, or missed existing runner/action reuse.
5. `Evidence Mismatches` — artifacts that do not prove the claim, are mislabeled, or capture intermediate state.
6. `Flake Risks` — weak waits, ambiguous assertions, hidden preconditions, timing hazards, environment assumptions.
7. `Suggested Fixes` — top 3 highest-value changes first, then lower-priority polish.
8. `Suggested Debug Markers` — temporary markers or probes that would make ambiguous evidence decisive.

## Critique Standards

Use `references/rubric.md` for the full bar. In short, a good recipe is executable, covers each proof target, uses documented repo actions, waits on state rather than time, produces artifacts that prove the claims, and states any unrun gap.

Recipe action/field shapes are mechanically checked by `mms-recipe-harness/scripts/validate-recipe-docs.js` (run in the harness safety contracts) against the committed manifest vocabulary fixture. Note its scope limit: it fully validates fenced ` ```json ` recipe blocks and the adapter embedded recipes, but free prose is only checked against a denylist of removed field tokens. When you cite an action's fields in prose, mirror a fenced JSON example and use only manifest-declared fields (e.g. `ui.wait_for` → `test_id`/`text`/`expected`/`visible`; `ui.screenshot` → `path`/`description`).

For each screenshot/video artifact, read the image/video itself before giving a
clean pass. Do not infer visual evidence from filename, recipe status, trace
status, fiber tree, DOM query, or controller assertions. If the caption or
coverage matrix claims a visible component, the component must be visibly
present in the artifact and backed by the shared recipe protocol:

- the preceding `ui.wait_for` for the target uses `visible` (with `ui.scroll`
  `scroll_into_view` when below the fold) when a user is supposed to see it;
- screenshot nodes carry a `description`, and "must (not) show" conditions are
  proven with `assert_json`/`assert_output` (e.g. absence of a misleading generic
  state such as empty funding banners);
- if the target is off-screen, the recipe scrolls/navigates first and reruns the
  capture instead of shipping a caveat.

## Debug Marker Guidance

Recommend temporary debug markers when evidence is ambiguous. Prefer, in order:

1. UI-state assertions;
2. UI-state debug markers;
3. local runtime state capture;
4. backend/network probes only when explicitly needed.

The marker should name where to add it and what ambiguity it resolves.
