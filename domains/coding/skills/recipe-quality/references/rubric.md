# Recipe Quality Rubric

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
- setup, action, assertion, evidence, and teardown are not collapsed into one opaque node.

`must-fix`: the graph cannot execute or can pass unconditionally.

## Adapter and Reuse

Recipes may use project-specific actions, but the contract must be explicit. Flag:

- undocumented local helpers;
- implicit skill-only actions with no action intent;
- raw eval when a named project action exists;
- duplicated setup that existing fixtures already solve;
- `/recipe-wallet-control` used as a hard dependency instead of an optional mobile implementation layer.

`should-fix`: the recipe works only because the author knows hidden local context.

## Evidence Fit

Evidence must prove the claim:

- Use UI screenshots/videos for user-visible behavior.
- Use test reports, logs, state JSON, or metrics for internal behavior.
- Capture screenshots after settle conditions.
- Link every artifact to a node and proof target.
- Do not let success rely on an artifact whose content is never asserted.

`must-fix`: evidence exists but does not prove the acceptance criterion.

## Flake Risk

Flag:

- sleeps without state waits;
- assertions against loading, empty, or transitional UI;
- hidden wallet/account/network prerequisites;
- missing fixture reset or teardown;
- device, port, browser, or branch assumptions;
- raw eval that bypasses the user flow under validation;
- artifact paths overwritten by repeated runs.

`should-fix`: timing or environment assumptions make repeated runs unreliable.

## Actionability

Each finding should end with the next concrete edit, for example:

- split `PT-2` into two proof targets;
- add `wait_for` before `capture-after`;
- replace raw eval with `eval_ref`;
- add an `artifact_index` node for screenshots and logs;
- add teardown to reset wallet state;
- add a temporary UI marker that distinguishes loading from settled empty state.
