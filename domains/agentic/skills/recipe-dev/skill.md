---
name: recipe-dev
description: Build a MetaMask feature, investigation, or product change from a clear task/ticket with acceptance criteria and recipe-backed validation. Use when an agent should implement desired behavior without first reproducing an existing bug, prove the happy path in a live Mobile or Extension runtime when applicable, package evidence, and stop for human review.
maturity: experimental
---

# Recipe Dev

`/mms-recipe-dev` is the high-level workflow for feature/dev work that should end near a working fix plus reviewable proof.

## Runner Invocation Compatibility

Different agent runners expose installed skills differently:

- Claude/Cursor: use the slash-command form, for example `/mms-recipe-dev <task>`.
- Codex/OpenAI agents: use the skill trigger form, for example `$mms-recipe-dev <task>`.

If a human pasted the wrong runner-specific command shape and the runner rejects
it, immediately continue by translating to the correct equivalent command. Do
not stop or ask the human to re-run the command. Record the runner-specific
invocation correction in the evidence package and continue through the full
checklist.

Recommended Codex/OpenAI-agent invocation shape:

```text
$mms-recipe-dev <ticket-or-task-url-or-task-prompt>
```

## Live Checklist File Protocol

Before product edits, before implementation planning, and before telling the
human to go get coffee, create a live checklist file from the installed platform reference:

```bash
# Pick mobile or extension after identifying the target repo from cwd/task.
.agents/skills/mms-recipe-dev/scripts/init-checklist.sh --platform <mobile|extension> --slug <ticket-or-task-slug>
```

If the skill is installed somewhere else, run the same script from the installed
skill directory, or manually copy the matching reference checklist to:

```text
temp/tasks/<skill>/<timestamp>-<slug>/CHECKLIST.md
```

The copied `CHECKLIST.md` is the source of truth for progress. It must contain
`[ ]` checkboxes. After every gate:

1. edit `CHECKLIST.md` from `[ ]` to `[x]` for the completed gate;
2. add the artifact path, command, result, or blocker under that gate;
3. immediately continue to the next unchecked gate.

Do not rely on private scratch notes as the progress record. Do not final-answer
with unchecked required gates unless the remaining gates are explicitly marked
`BLOCKED: <concrete reason>` or `N/A: <reason>` in `CHECKLIST.md`. No
`SIGNAL.json` is required for interactive skill runs.


## Karpathy-Style Execution Discipline

Apply this discipline throughout the workflow:

- Think before coding: if task source, target surface, ACs, fixture state, or evidence requirement is ambiguous, record the ambiguity in `CHECKLIST.md` and ask once before product edits.
- Simplicity first: implement the smallest reversible change that satisfies the stated ACs. Do not add abstractions, generic actions, or speculative configuration unless the recipe proof requires it.
- Surgical changes: every changed product line must trace to an AC. Do not refactor adjacent code, move existing logic, or clean unrelated files.
- Goal-driven execution: each checklist gate must have a concrete verifier/path/result. Do not mark `[x]` from intent, code inspection, or tests that do not cover the gate.


## Clean Per-Run Branch Protocol

Every new validation loop must run on a clean, model-specific branch so the
human can compare Claude/Codex/Cursor diffs afterwards. Before product edits:

1. ensure the worktree has no unstaged product changes from a previous loop; if
   it does, stash them with a descriptive `adr58-validation-...` message and
   record the stash in `CHECKLIST.md`;
2. record the base branch and base SHA in `CHECKLIST.md`;
3. create or switch to a fresh branch named with the runner/model, skill, ticket
   or task slug, and run id. If the source is a Jira ticket, the branch name
   **must start with the lowercased Jira key followed by a hyphen** on both
   Mobile and Extension targets so regular MetaMask/Farmslot tooling can
   associate it, for example
   `tat-3216-adr58-codex-mms-recipe-dev-fresh2`. For non-Jira prompts, use a
   stable sanitized task slug such as `adr58-codex-mms-recipe-dev-demo-fresh1`;
4. keep all product edits for that loop on that branch only;
5. include branch name, base SHA, and `git diff --stat <base>...HEAD` in the
   final evidence package.

If the branch cannot be made clean, mark the branch gate `BLOCKED` before
implementation. Do not mix multiple model attempts on the same product branch.

## Clean Generated Harness State Protocol

A clean product worktree is not enough. Generated, ignored harness/runtime
outputs can make a fresh run reuse stale recipe code or stale CDP metadata.
Before the proof plan or harness install gate, record and clean these generated
paths for the current target repo unless the caller explicitly asks to preserve
runtime state for debugging:

```bash
rm -rf temp/agentic/recipes .agent/recipe-harness/extension .agent/recipe-harness/mobile
rm -rf temp/tasks/<this-run>/harness
```

Then reinstall the lower-level harness from the currently installed skill. Do
not use `--force`; deleting known generated outputs first is the idempotent
refresh. Do not edit `.agents/skills/...`, `.claude/skills/...`, or harness
source files during product validation.

For Extension, prefer task-local harness output when writing new recipes so each
run is isolated from shared `temp/agentic/recipes` state:

```bash
.agents/skills/mms-recipe-harness/scripts/recipe-harness.sh extension install \
  --target . \
  --out temp/tasks/<this-run>/harness/recipes
```

Use the same task-local `validate-recipe.sh` path for dry-run and live recipe
runs. If an existing shared harness install must be reused, verify its manifest
and content hash in `CHECKLIST.md`; do not silently reuse stale ignored files.

## First Response to the Human

After creating `CHECKLIST.md`, immediately acknowledge the handoff with a short, friendly message that includes the checklist path the human can monitor. Use this exact spirit, adapted only if the user gave a stricter tone:

> Ok, relax and go get a coffee ☕. I’ll take this from task → implementation → recipe → evidence package. You can monitor live progress in `<CHECKLIST.md path>`, and I’ll report back when it is done or concretely blocked.

After that message, continue autonomously. Do not wait for the user after the
acknowledgement. If the task source cannot be fetched, ask for the missing task
text once; after the user pastes it, resume at checklist step 1 and continue to
the recipe/evidence gates.


## Runtime Startup Approval Gate

Before any command that can start or restart a live runtime, write the exact
command and approval state in `CHECKLIST.md`. This includes Mobile Metro,
simulator/app launch, bundle prewarm/cache-warming helpers, `recipe-harness
live`, Extension webpack/watch, Chrome/CDP launch, and any wrapper that would
prepare/build runtime artifacts.

Respect the caller/orchestrator policy for the lane. If the current goal,
checklist, or human says runtime startup needs explicit approval, do **not**
work around that by creating `manual-prewarm`, `nohup`, background tmux,
`sleep`/detached shell, ad-hoc cache-warming helpers, repo aliases such as
`yarn a:ios` / `yarn a:android`, or direct preflight/start scripts such as
`scripts/perps/agentic/start-metro.sh --launch`. Instead record `BLOCKED:
pending runtime-start approval` with the exact command you would run and
continue only after approval is provided.

When approval exists, prefer the installed harness delegate and cache/watch-first
commands. Do not run Mobile `auto`, `default`, `clean`, `rebuild-native`,
manual bundle prewarm/cache warming, Extension `--start-test-watch`, or
Extension prepare/build unless that heavier mode was explicitly approved.

## Portable Runtime Discovery Gate

Before choosing any runtime command or port, perform read-only discovery in this
order and record the result in `CHECKLIST.md`:

1. caller-provided runtime context: `RECIPE_RUNTIME_CONTEXT` JSON path,
   `RECIPE_SLOT_ID`, `RECIPE_CDP_PORT`, `CDP_PORT`, `RECIPE_METRO_PORT`,
   `METRO_PORT`, `RECIPE_WATCHER_PORT`, `WATCHER_PORT`, `IOS_SIMULATOR`,
   `SIMULATOR`, `ANDROID_SERIAL`, `ADB_SERIAL`, and comparable env vars;
2. repo-local generic runtime context: `temp/runtime/agentic-runtime.json`
   (and `temp/runtime/agentic-runtime.env` if you want to source it). If this
   file has `strict: true`, use only the recorded slot/port/device values and
   do not probe or fall back to other local runtimes. If it has
   `runtimeStart.approved: true` plus `runtimeStart.command`, pass recovery
   through `/mms-recipe-harness` launch/live/verify and let the harness run that
   approved command; outside Farmslot, any developer/tool may provide the same
   context or `RECIPE_RUNTIME_START_APPROVED=1` with `RECIPE_RUNTIME_START_CMD`;
3. installed recipe-harness/delegate summaries or manifests in the current
   checkout that identify an already-owned runtime;
4. currently listening local CDP/device endpoints only as fallbacks, never as a
   reason to ignore caller-provided context.

Do not assume default ports such as `9222` when no context was supplied. Do not
turn missing runtime context into a raw product build (`yarn build:test`,
`start:test`, native rebuild, or direct Chrome/simulator launch). Use static
verify/no-start checks where useful, then record the missing runtime context or
needed harness command as the blocker.

## Harness Boundary Gate

This high-level skill owns product code, recipes, and evidence. It does **not**
own the lower-level harness implementation during a product/ticket run. Do not
edit installed delegate files such as `.agents/skills/mms-recipe-harness`,
`.claude/skills/mms-recipe-harness`, `.cursor/rules/mms-recipe-harness`,
`.agent/recipe-harness`, or copied harness adapter scripts while fixing a
product ticket or validating this high-level workflow.

If the harness fails, inspect only enough logs/summaries to classify the failure
and capture artifact paths. Rerun only with documented harness flags and the
discovered runtime context. If success would require changing harness code, stop
the runtime lane as `BLOCKED: harness defect` (or `PASS-WITH-GAPS` for product
code already checked) and report the exact summary/log path. Do not patch the
harness unless the explicit task is a harness-maintenance task.

## Delegate Recovery Decision Tree

When a live proof is blocked, escalate through the lower-level delegates before
using ad-hoc commands or packaging partial evidence:

1. **Runtime/CDP unavailable** — use `/mms-recipe-harness` (or the installed
   delegate path) to launch, live-verify, or recover the runtime with the
   caller-approved context/prepare command. The high-level skill should not run
   raw build/watch/Chrome/simulator commands when a harness path exists. If no
   runtime context or start approval exists, stop with `BLOCKED: missing runtime
   context` or `BLOCKED: pending runtime-start approval`.
2. **Wallet locked, wrong account, onboarding, route, or app-ready blocker** —
   use `/mms-recipe-wallet-control` (or the installed delegate path) for unlock,
   account, route, and wallet readiness primitives. Do not invent private aliases
   or mutate controller/store state to prove user-visible ACs.
3. **Stateful product setup unavailable** — use recipe/harness/wallet-control
   supported flows or documented pre-start fixtures. If no real flow/fixture
   exists, record a fixture/state setup blocker; do not manufacture the target
   state.
4. **Delegate cannot recover** — stop at the concrete blocker with command/log
   paths. Fix the delegate/runtime/root cause and restart from clean generated
   harness state rather than continuing to a partial evidence package, unless
   the human explicitly asks for partial packaging.

## CDP Bootstrap Failure Stop Gate

For Extension visual or mixed ACs, a live recipe that fails before CDP session
bootstrap (for example `ECONNREFUSED 127.0.0.1:<port>`, missing `/json/version`,
no extension target, or no `summary.json`/`trace.json` emitted) is not a
quality/evidence packaging condition. Stop the product validation lane, record
`BLOCKED: CDP bootstrap failed`, preserve the exact command/log path, and fix
the runtime/preflight root cause before restarting from a clean generated
harness state.

Only continue to recipe-quality/evidence packaging after either:

1. the live recipe emitted normal runtime artifacts (`summary.json`,
   `trace.json`, artifact manifest, screenshots/video where applicable); or
2. the human explicitly asks for a partial package despite the bootstrap
   blocker.

Do not convert pre-bootstrap CDP failure into `pass-with-gaps`. Do not keep
retrying inside the same dirty product run. Fix the root cause, clean generated
outputs, and restart.

## Task Source-of-Truth Gate

The Jira/task prompt or pasted task details are the source of truth. If Jira,
MCP, WebFetch, or browser access returns a login wall, timeout, permission
error, empty issue, or ambiguous page, ask the human for the task summary,
description, requirements, and acceptance criteria before coding. Do this even
if branch names, prior artifacts, local task folders, web search results, or
repo history look suggestive.

Do **not** infer or rewrite acceptance criteria from branch names, stale ADR58
artifacts, previous validation runs, or web search. Do **not** change the target
surface, gating condition, exact copy, or required state unless the task text
says so. If task details remain unavailable, stop before product edits and
report `BLOCKED: missing task source of truth`; do not implement a guessed
patch.

Before editing product code, print the extracted AC matrix with the exact target
surface, state precondition, copy, styling, and proof requirement. If any field
is inferred rather than stated, label it `UNKNOWN` and ask for the missing task
text instead of proceeding.

It exists to steer the agent through the full loop. Lower-level recipe skills are proof tools; this skill makes the agent use them instead of stopping at a code diff, unit tests, or a confidence summary.

Use it when the task is broader than a bug fix: new feature work, exploratory implementation, investigation, or behavior changes that start from desired acceptance criteria rather than a known broken state. For pure bugs, prefer `/mms-recipe-fix-ticket` because bug-fix flow spends time reproducing or understanding the existing failure before patching.

Load only what applies:

- Runtime setup: `/mms-recipe-harness`
- Recipe authoring: `/mms-recipe-cook`
- Recipe critique: `/mms-recipe-quality`
- PR evidence formatting: `/mms-recipe-evidence`
- Wallet/app primitives: `/mms-recipe-wallet-control`
- Target-repo dev notes are appended below when installed.
- Target checklist reference: load only one of `references/metamask-mobile-checklist.md` or `references/metamask-extension-checklist.md`.

## Lower-Level Skill Invocation Contract

The lower-level recipe skills are required gates, not optional background
reading. For every delegate gate, do one of these explicitly:

1. invoke the named skill using the runner-specific command form (slash for Claude/Cursor, `$` for Codex) if the runner supports nested skill calls; or
2. if nested slash calls are unavailable, open the installed skill file and
   follow it as the delegate protocol:
   - `.claude/skills/mms-recipe-harness/SKILL.md`
   - `.claude/skills/mms-recipe-cook/SKILL.md`
   - `.claude/skills/mms-recipe-quality/SKILL.md`
   - `.claude/skills/mms-recipe-evidence/SKILL.md`
   - equivalent `.agents/skills/.../SKILL.md` or `.cursor/rules/.../RULE.md`
     when running under Codex/OpenAI agents or Cursor.

For each delegate, write `Invoking mms-recipe-...` in `CHECKLIST.md` and
record the delegate output path or blocker. Direct ad-hoc app scripts,
controller evals, DOM/fiber checks, screenshots, or unit tests do **not**
satisfy these gates unless they are wrapped into the recipe protocol with an
executable recipe path, exact command, `summary.json`, `trace.json`, artifact
manifest, recipe-quality critique, and evidence package.

Do **not** claim recipe tooling is absent just because a repo-root
`validate-recipe.js` or `scripts/recipe-*` file is missing. Before declaring a
recipe/harness blocker, inspect the installed delegate locations for the current
runner:

- `.claude/skills/mms-recipe-harness/SKILL.md` and `scripts/` / `adapters/`;
- `.agents/skills/mms-recipe-harness/SKILL.md` and `scripts/` / `adapters/`;
- `.cursor/rules/mms-recipe-harness/RULE.md` and copied references/scripts.

If the installed delegate exists, follow it. If no executable recipe run exists
(no `recipe.json` plus `summary.json` and `trace.json` from the harness), final
status for runtime/visual work is `FAIL` or `BLOCKED: no recipe protocol`, not
`PASS-WITH-GAPS`. Ad-hoc CDP probes, handwritten evidence packages, black
screenshots, or “human should visually confirm” instructions are supporting
notes only; they do not satisfy harness/cook/quality/evidence gates.

## No Manufactured Runtime State

Do **not** prove a user-visible AC by mutating app/UI/runtime state directly.
Forbidden proof setup includes `window.stateHooks`,
`stateHooks.submitRequestToBackground`, Redux/store writes, React/fiber
mutation, DOM injection, controller/provider state mutation, or any ad-hoc
helper that directly creates, closes, clears, seeds, or inserts the target
value/position/banner into the running app. These may be useful for diagnosis,
but they are not valid AC proof.

Valid proof must use one of:

- the real user flow encoded as a recipe;
- a documented fixture/profile loaded before app start by the harness; or
- an honest `BLOCKED`/`PASS-WITH-GAPS` verdict that names the missing fixture or
  runtime capability.

If a recipe uses state injection or controller/background calls to create or
clear the exact condition being asserted (for example injecting or closing a BTC
Perps position, mutating a controller value, inserting a banner/form value, or
changing a DOM node), the corresponding stateful AC is **not clean proof**. It
may be included as diagnostic/supporting evidence only; keep the affected AC at
`PASS-WITH-GAPS`/`BLOCKED` until a real UI flow or documented harness-owned
pre-start fixture proves the state. Do not call it `code-proven`, `visually
proven`, or `all ACs met`; classify it as a fixture/recipe gap and feed that
back to `/mms-recipe-cook`.

## Default Contract

Do not stop at a code diff when the change is user-visible, stateful, or acceptance-criteria-driven. Unlike `/mms-recipe-fix-ticket`, this flow does **not** spend time reproducing an existing failure unless the task asks for it; it starts from desired behavior and clear acceptance criteria.

A final response is forbidden until one of these is true:

1. The implementation checks passed, a recipe was authored/run when runtime proof applies, screenshots/artifacts were reviewed, and an evidence package was produced; or
2. runtime proof was attempted through `/mms-recipe-harness`, failed for a concrete external reason, and the response clearly labels recipe proof as `BLOCKED` rather than claiming the acceptance criteria are proven.

Passing typecheck/Jest is not a stop gate. It only unlocks recipe/evidence steps.
If any acceptance criterion remains unrun, blocked, or covered only by weaker
fallback proof, the final verdict is `PASS-WITH-GAPS` or `PARTIAL`, not
`complete`, `all ACs met`, or `ready`. DOM-rendered fallback screenshots
created because native screenshot capture timed out/blank count as weaker
fallback proof for visual ACs: package them, read them, and keep the gap in the
final verdict unless a native screenshot/video (or explicitly accepted alternate
artifact) also exists. Evidence packaging must preserve the gap
by AC number.

For visual or mixed ACs, "code-proven" is not a valid proof status. Code review
can prove minimality or placement intent, but visible copy/color/layout/ordering
remain unproved until a live runtime recipe produces screenshot/video evidence
that the runner reads visually. If CDP/browser is unavailable, mark those ACs
`BLOCKED: no runtime visual evidence`.

Do not ask the human whether to proceed with recipe/harness validation. The
answer is already yes for this skill. If the app, simulator, Metro, browser, or
CDP is not currently running, check the Runtime Startup Approval Gate above. If
runtime-start approval exists, invoke `/mms-recipe-harness` and let its
verify/preflight path start or recover the runtime. If approval is required and
absent, run static/no-start harness checks, record `BLOCKED: pending
runtime-start approval` with the exact command, and wait. Only declare
`BLOCKED` for a concrete external failure after the harness or recipe command
was actually attempted with approval.

Honor runtime environment variables first. If `RECIPE_RUNTIME_CONTEXT`, `RECIPE_SLOT_ID`, `CDP_PORT`, `RECIPE_CDP_PORT`,
`ADB_SERIAL`, simulator/device, or equivalent caller-provided runtime variables
are present, use those values in harness verify and recipe commands before
probing default ports. Do
not claim "no CDP/browser/device" until the env-provided target was attempted
and its failure artifact was recorded. If the env-provided runtime fails but a
fallback port works, record both; if only fallback probing was done, the runtime
gate is incomplete.

Do not ask to commit, create a PR, or package the work as done while any required
recipe gate is incomplete. If the product diff and implementation checks are
done but the recipe package is missing, the only valid next action is to invoke
the next lower-level recipe skill or mark that specific gate `BLOCKED` with the
attempted command and failure artifact.

## Runtime Failure Recovery Gate

A failed live recipe node is not automatically a final blocker. Before final
packaging, inspect the failed node in `summary.json`/`trace.json`, read any
failure screenshot or last-screen artifact, and decide whether the failure is a
recipe/action sequencing issue that can be fixed locally. Typical fixable cases
include wrong route, below-the-fold or obscured target, unstable click/press,
missing wait for hydration, stale selector, wrong browser context, or a broad
shared flow landing on the wrong screen.

If the failure is plausibly recipe/action quality, patch the recipe or shared
flow with the smallest navigation/wait/scroll/stable-click correction and rerun
the smallest meaningful recipe segment or the full recipe. Do this before
returning a final summary. Only mark the proof target `BLOCKED` after concrete
retry attempts still fail, and then report the exact failed node, command,
artifact paths, observed screen, and the recipe/harness improvement needed.

Do not loop indefinitely on native rebuilds, Metro/CDP reconnects, or simulator
launch churn. After one harness/preflight recovery plus one targeted rerun, cap
the lane as `BLOCKED_RUNTIME` if CDP/Metro remains unstable, and package the
transcript plus runtime logs instead of spending unbounded time rebuilding.

For stateful setup flows, branch on the observed state. If the recipe wants to
open a BTC position but the account already has BTC, do not wait for an
open-long button that is correctly absent; either route directly to the
open-position visual AC, or first close/clear via the documented real UI/harness
flow and then rerun the no-state lane. Existing-state branching must be recorded
in the recipe notes and verdict.

Unit tests, DOM/fiber/controller assertions, or a manual screenshot suggestion
do not replace the missing live recipe proof. They may support the code diff,
but visual/mixed ACs with a failed runtime node remain `PASS-WITH-GAPS`,
`PARTIAL`, or `BLOCKED` by AC number.

## Runtime Precondition Recovery Gate

A recipe that fails before the first workflow node because preconditions are not
ready is not a final package yet. If `summary.json`/`failure.json` reports
`wallet.unlocked`, `Login`, `perps.ready_to_trade`,
`perps.sufficient_balance`, `CLIENT_NOT_INITIALIZED`, no CDP target, or a
stopped simulator/browser, check runtime-start approval before attempting
recovery:

- **If runtime-start approval has not been granted**, do not run
  prepare/watch/launch/simulator-boot or any command that starts or restarts a
  runtime process. Run static/no-start harness checks if useful, record
  `BLOCKED: pending runtime-start approval` with the exact command that would be
  needed, and wait for explicit approval.
- **If runtime-start approval exists**, invoke/follow `/mms-recipe-harness`
  verify/preflight for the platform, using the provided `RECIPE_RUNTIME_CONTEXT`, `RECIPE_SLOT_ID`, `CDP_PORT`,
  `RECIPE_CDP_PORT`, `IOS_SIMULATOR`, `SIMULATOR`, `ADB_SERIAL`,
  `ANDROID_SERIAL`, `WATCHER_PORT`, `METRO_PORT`, or equivalent caller-provided
  env vars first;
- for wallet/login readiness, invoke/follow `/mms-recipe-wallet-control` or the
  repo harness wallet setup/unlock command rather than asking the human to run a
  private alias;
- record the exact recovery command, output artifact, app-state/status result,
  and whether it reached a route/account/perps-ready state;
- rerun the same recipe command after recovery, or explain the concrete external
  reason recovery could not run.

Static-only harness verification plus a failed live precondition attempt is a
useful artifact, but it is not enough to close a stateful/visual proof lane when
the target runtime env was available. If recovery still leaves the app on the
login screen or `CLIENT_NOT_INITIALIZED`, package the lane as
`PASS-WITH-GAPS`/`BLOCKED_PRECONDITIONS` and name the missing runtime setup
explicitly.

## Stateful AC Setup Gate

For acceptance criteria that depend on a required app state, the recipe must
explicitly create or verify that state before asserting the UI. Do not rely on
whatever state happens to be present in the active browser, simulator, wallet,
or prior validation run. For example, a ticket with both `no BTC position` and
`open BTC position` ACs needs separate no-state and with-state setup paths:
close/clear through a real UI/harness flow, open/create through a real
UI/harness flow, or load a documented harness-owned pre-start fixture.

A read-only observation recipe is acceptable only for investigation or for an
AC whose required state is already the subject being observed and cannot be
changed safely; in that case the affected AC must be labelled
`PASS-WITH-GAPS`/`BLOCKED` with the missing setup flow named. If existing shared
flows or platform fixtures can attempt the setup, try them before final
packaging. Unit tests may support the code path but do not substitute for
runtime setup of stateful visual ACs.

## Fallback Screenshot Verdict Gate

Treat screenshot artifact metadata as part of the proof, not just the visible
bitmap. If a PNG says `DOM-rendered fallback evidence`, `native browser
screenshot timed out/blank`, or `trace.json` records a screenshot
`fallbackReason`, then native visual capture failed for that AC. Read and
package the fallback PNG, but a visual/mixed AC proven only by that fallback is
not a clean visual pass. The final verdict must remain `PASS-WITH-GAPS` (or
`PARTIAL`/`BLOCKED` if the fallback does not show the claim), even when
`summary.json` says `status: pass` and DOM/viewport assertions passed.

Before writing the final verdict or `recipe-quality`, scan `trace.json`,
screenshot captions, and the PNG header/body for fallback labels. The scan must
be explicit in the notes, for example `Fallback audit: trace fallbackReason=<n>,
PNG DOM fallback labels=<n>`. If any visual AC depends on fallback evidence,
list the affected AC numbers and the native screenshot/video gap. Do not let a
later successful rerun or unit test overwrite this proof-strength classification
unless it produced native screenshot/video or another explicitly accepted
non-fallback artifact. If `recipe-quality` or the final summary says `native
screenshot`, `no fallback`, or clean visual `PASS` while `trace.json` or a PNG
shows fallback metadata, the quality gate is incomplete; correct the verdict to
`PASS-WITH-GAPS` and rewrite the evidence package before final response.

## Final Package Barrier

A recipe `PASS` is **not** the end of this skill. After the runtime recipe run,
continue through these gates before showing an idle prompt or final response:

1. open `summary.json`, `trace.json`, run log, issue review, and the artifact
   manifest/evidence manifest;
2. read every recipe-produced PNG/video, not only ad-hoc screenshots captured
   before the recipe;
3. invoke or follow `/mms-recipe-quality` and record its verdict;
4. apply one recipe/evidence improvement and rerun, or record the quality
   verdict that no rerun is needed;
5. invoke/follow `/mms-recipe-evidence` and write a PR-ready evidence block/file
   (for example `PR-READY-EVIDENCE.md`) with task, diff, commands, artifact
   paths, screenshot notes, quality verdict, fallback audit, and remaining gaps;
6. run `.agents/skills/mms-recipe-evidence/scripts/package-pr-evidence.js --task <task-dir>`
   (or the runner-equivalent installed path) so the task contains
   `pr-package/pr-desc.md`, `pr-package/images/` with easy-to-copy filenames,
   `pr-package/package-manifest.json`, and `pr-package/final-report.md`.
   The `pr-desc.md` draft must follow the target repo's
   `.github/pull-request-template.md` / `.github/pull_request_template.md`
   when present.
   A JSON manifest alone is not a PR-ready evidence package.

If you find yourself at the model prompt with quality/evidence/package gates
unchecked, that is a workflow failure. Continue immediately from the earliest
unchecked gate; do not wait for the human to say "continue".

If `/mms-recipe-quality` returns `pass-with-gaps`, finish the evidence package
but keep the final verdict as `PASS-WITH-GAPS`. Do not say the workflow is fully
complete unless every required AC proof target passed or is explicitly outside
the requested scope.

## Ordered Checklist Protocol

Maintain the copied `CHECKLIST.md` file and execute it in order. Load the Mobile or Extension checklist reference installed with this skill (for example `.agents/skills/mms-recipe-dev/references/metamask-mobile-checklist.md` or `.agents/skills/mms-recipe-dev/references/metamask-extension-checklist.md`; Claude/Cursor installs may expose the same files under their runner-specific skill directories). Do not search only for a repo-root `references/` folder and declare the checklist absent. Mark every step `[x]`, `BLOCKED`, or `N/A: <reason>`. After each step, write the artifact/path/result, then immediately continue to the next unchecked step.

`CHECKLIST.md` must exist before editing product behavior. Update it after every gate, not only at the end. If you realize you skipped an earlier
gate, stop, backfill the missing gate honestly, and continue from the earliest
unchecked required step. Do not silently replace this workflow with an
implementation/test-only workflow.

Optimization rule: use lower-level skills as focused delegates instead of manually re-deriving their protocols. Call `/mms-recipe-harness` for setup, `/mms-recipe-cook` for recipe authoring, `/mms-recipe-quality` for critique, and `/mms-recipe-evidence` for PR-ready packaging. If the runner supports subagents/tasks, use a subagent for independent recipe-quality review and evidence-package critique. Do not delegate product code editing unless the user explicitly asked for multi-agent implementation.

Hard gates:

- AC matrix and proof plan happen before implementation.
- Clean per-run branch gate happens before implementation.
- Harness/cook/quality/evidence gates must explicitly invoke or follow the
  corresponding lower-level skill; ad-hoc screenshots or helper scripts alone
  are insufficient.
- Implementation checks are not a stopping point.
- Surgical diff audit must happen after product edits and before final evidence packaging.
- Visual evidence must come from the recipe artifact package when runtime proof
  applies; miscellaneous screenshots may be supporting evidence only.
- Visual or mixed ACs require screenshot/video evidence tied to that AC.
- State-only assertions cannot prove visible copy/color/layout claims.
- Schema warnings on screenshot nodes are quality failures for visual tasks. Add
  `note` and `claims` to screenshots, then rerun validation instead of treating
  warning-only schema output as clean.
- The evidence package must contain `artifact-manifest.json` from the harness or
  an explicit evidence manifest you create that lists `summary.json`,
  `trace.json`, logs, screenshots/videos, quality verdict, and recipe path.
- After final artifacts are captured, ask the human whether they want runtime
  resources cleaned up now. Name the concrete resources (for example Metro
  port, simulator/device, webpack/dev server, browser/CDP process, tmux pane)
  and only stop/release them after confirmation, unless the user already asked
  for cleanup.
- If runtime proof is `N/A` or `BLOCKED`, the final response must say exactly why and must not claim runtime proof.
- If a recipe step fails, inspect any failure screenshot before classifying the
  blocker. A screenshot that visibly proves the target UI usually means the
  recipe assertion/selector is wrong; fix the recipe and rerun instead of
  reporting a product/runtime blocker.

## Workflow

1. Create the live `CHECKLIST.md` from the embedded platform checklist, then send the coffee handoff message with its path.
2. Read the task/ticket and extract clear acceptance criteria. If the task description is too vague to prove, ask once for sharper criteria; when the user supplies it, continue without stopping.
3. Select the target repo/platform and load the matching checklist reference.
4. Write the AC matrix and proof modes before implementation.
5. Write the proof plan, including whether before evidence is meaningful or `Baseline: N/A`.
6. Call `/mms-recipe-harness` for install/verify when runtime proof applies.
7. Call `/mms-recipe-cook` to draft the recipe before or alongside implementation planning.
8. Make the smallest product change.
9. Run focused implementation checks.
10. Run the live recipe when applicable and save artifacts.
11. Read screenshot PNGs for visual/mixed ACs; rerun if evidence is weak.
12. Call `/mms-recipe-quality` or a recipe-quality subagent on recipe + artifacts.
13. Improve once and rerun from the smallest meaningful point, unless quality says no rerun needed.
14. Call `/mms-recipe-evidence` or package equivalent PR-ready evidence.
15. Ask whether to clean up runtime resources such as Metro/simulator/webpack/CDP now, or record that they were intentionally left running for review.
16. Return a PR-ready summary and stop for human validation unless asked to open a PR.

For every visual or mixed acceptance criterion, the recipe must use the shared
visual assertion protocol before screenshot evidence:

```json
{
  "action": "wait_for",
  "test_id": "target-test-id",
  "visibility": "viewport",
  "scroll": { "strategy": "into_view", "settle_ms": 300 },
  "timeout_ms": 10000,
  "poll_ms": 500
}
```

Then the `screenshot` node must declare what the image is supposed to prove:

```json
{
  "action": "screenshot",
  "filename": "after-ac1-target-visible.png",
  "note": "AC1: target component is visible with the expected text",
  "claims": {
    "must_show": [{ "test_id": "target-test-id", "visibility": "viewport" }],
    "must_not_show": [{ "text_contains": "Fund your wallet" }]
  }
}
```

Do not treat `wait_for` fiber-tree/DOM presence, `eval_sync`, controller state,
or a passing recipe as proof that a user can see the element. Visual claims need
viewport visibility plus screenshot claims, followed by human/quality review of
the PNG/video.

The evidence package should include: task URL or prompt, product diff summary, harness verify path, recipe path, exact run command, `summary.json`, `trace.json`, `artifact-manifest.json`, screenshots/video for UI claims, quality critique, and explicit gaps.

If runtime state cannot be created, report the gap. Do not claim success from code inspection alone.

## Output

1. `Change` — files changed and why.
2. `Recipe` — path and run command.
3. `Evidence` — artifacts and verdict.
4. `Quality Loop` — critique, fix/rerun, or why first pass is enough.
5. `Human Check` — what still needs reviewer/product validation.
