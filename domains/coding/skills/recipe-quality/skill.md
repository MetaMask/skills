---
name: recipe-quality
description: Critique per-PR validation recipes and their evidence. Use when an agent or reviewer needs a structured verdict on acceptance-criteria coverage, recipe graph quality, adapter independence, evidence fit, flake risk, and the highest-value fixes before trusting a recipe.
maturity: experimental
---

# Recipe Quality

`recipe-quality` is the review loop for executable validation recipes. Use it after `/cook`, after a recipe run, or whenever recipe evidence looks weak. The job is to decide whether the recipe actually proves the intended PR claims and to return concrete fixes, not generic QA advice.

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

### Coverage

Check that every acceptance criterion or proof target has:

- an executable path in the recipe;
- a clear assertion or observation;
- an artifact when reviewer-visible evidence is needed;
- an explicit note if it is manual, untestable, or environment-dependent.

### Graph Structure

Check that:

- v1 recipes include `schema_version: 1`, `title`, `description`, `validate.workflow.entry`, and `validate.workflow.nodes`;
- the entry node exists;
- every non-terminal node has `next`, `cases`, or `default`;
- transition targets exist;
- at least one terminal `end` node exists;
- setup/action/assert/teardown responsibilities are not mixed into one opaque node.

### Adapter Independence

Recipes may use project-specific actions, but the action contract must be explicit. Flag recipes that only work because the author had an undocumented local helper or an implicit skill loaded. If `wallet-control` appears, it should be an optional implementation detail for mobile wallet primitives, not the only description of what the recipe proves.

### Evidence Fit

Prefer user-facing UI evidence for user-facing behavior. Prefer local runtime state only when UI evidence is insufficient or the claim is internal. Avoid backend/network probes as the primary proof unless the user explicitly asks for backend-level validation.

Screenshots should come after a settle condition (`wait_for`, state assertion, or route assertion), not immediately after a click unless the click synchronously proves the state.

### Flake Risk

Flag:

- sleeps without a state condition;
- assertions against loading, empty, or transitional UI;
- hidden wallet/account/network prerequisites;
- commands that depend on unstated ports, devices, or branches;
- raw evals that bypass the user flow under validation;
- evidence paths that can be overwritten by repeated runs.

### Actionability

Each issue should end with a concrete next delta, such as:

- split proof target `PT-2` into two claims;
- add `wait_for` before `capture-after`;
- replace raw eval with existing action `eval_ref`;
- add an `artifact_index` node for screenshots and logs;
- add a teardown node to restore state;
- add a temporary UI marker distinguishing loading from settled empty state.

## Debug Marker Guidance

Recommend temporary debug markers when evidence is ambiguous. Prefer, in order:

1. UI-state assertions;
2. UI-state debug markers;
3. local runtime state capture;
4. backend/network probes only when explicitly needed.

The marker should name where to add it and what ambiguity it resolves.
