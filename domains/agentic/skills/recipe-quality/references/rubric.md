# Recipe Quality Rubric

Canonical protocol source of truth: `$FARMSLOT_ROOT/docs/RECIPE-PROTOCOL-V1.md`. This rubric judges recipe quality on top of that contract.

Use this rubric to produce findings, not a scorecard. Mark each issue as `must-fix`, `should-fix`, or `nit`.

## Coverage

Every acceptance criterion or proof target needs:

- an executable path;
- a clear assertion or observation;
- reviewer-visible evidence when the behavior is visible;
- an explicit note if it is manual, untestable, or environment-dependent.

`must-fix`: a named PR claim has no action path or no assertion.

## Graph Structure

For v1 recipes, check:

- `schema_version: 1`, `title`, `description`, `validate.workflow.entry`, and `validate.workflow.nodes`;
- entry node exists;
- every non-terminal node has `next`, `cases`, or `default`;
- transition targets exist;
- at least one terminal `end` node exists;
- `assert_exit_code` nodes use numeric `expected`, not ambiguous fields such as `code`;
- setup, action, assertion, evidence, and teardown are not collapsed into one opaque node.

`must-fix`: the graph cannot execute or can pass unconditionally.


## Composition and Start State

A production recipe should behave like a composed program:

- each AC maps to a focused proof flow;
- setup uses reusable parameterized idempotent `ensure_*` flows when available;
- the start state is explicit and parameterized;
- proof media starts at the relevant user interaction, not at generic setup;
- setup and start-state work still appear in trace/summary artifacts.

`must-fix`: the recipe depends on hidden wallet/account/network/provider/page state.

`should-fix`: the recipe duplicates unlock, navigation, provider selection, fixture setup, or positive/negative position variants that a published parameterized `ensure_*`/assert flow should own.

## Adapter and Reuse

Recipes may use project-specific actions, but the contract must be explicit. Flag:

- undocumented local helpers;
- implicit skill-only actions with no action intent;
- raw eval when a named project action exists;
- duplicated setup that existing fixtures or `ensure_*` flows already solve;
- `/recipe-wallet-control` used as a hard dependency instead of an optional mobile implementation layer.

`should-fix`: the recipe works only because the author knows hidden local context.

## Evidence Fit

Evidence must prove the claim:

- Use UI screenshots/videos for user-visible behavior.
- Use test reports, logs, state JSON, or metrics for internal behavior.
- Capture screenshots after settle conditions.
- Link every artifact to a node and proof target.
- Do not let success rely on an artifact whose content is never asserted.
- Negative log assertions must prove the watched log source was live. Prefer a benign marker or heartbeat after the baseline; otherwise record baseline/end offsets and treat `0` appended bytes as a gap, not clean proof.
- For portable recipes, do not fail an otherwise complete evidence package only because an in-graph `index_artifacts` omits runner-generated `summary.json` or `trace.json`; those files may be written after the manifest node. Do flag missing summary/trace files themselves.
- Before marking trace evidence missing, search runner output locations named by the runner, such as `.agent/recipe-runs/<timestamp>/summary.json` and `.agent/recipe-runs/<timestamp>/trace.json`. If trace exists outside the task artifact directory, use it as authoritative evidence instead of stdout-only counts.

`must-fix`: evidence exists but does not prove the acceptance criterion.

## Flake Risk

Flag:

- sleeps without state waits;
- long-running command nodes without `timeout_ms`;
- assertions against loading, empty, or transitional UI;
- hidden wallet/account/network/provider/page prerequisites;
- missing fixture reset or teardown;
- device, port, browser, or branch assumptions;
- raw eval that bypasses the user flow under validation;
- artifact paths overwritten by repeated runs.

`should-fix`: timing or environment assumptions make repeated runs unreliable.

## Actionability

Each finding should end with the next concrete edit, for example:

- split `PT-2` into two proof targets;
- add `ui.wait_for` before `capture-after`;
- replace raw eval with a manifest-declared state assertion;
- add an `index_artifacts` node for screenshots and logs;
- replace inline setup with a domain `ensure_*` flow;
- add teardown to reset wallet state;
- add a temporary UI marker that distinguishes loading from settled empty state.
