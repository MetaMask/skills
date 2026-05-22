---
name: cook
description: Author, run, and refine executable per-PR validation recipes for MetaMask work. Use when an agent needs to turn acceptance criteria, changed behavior, or reviewer requests into a portable recipe graph with concrete proof targets, project-native actions, and reviewable artifacts. Recipes may use wallet-control when available, but must not depend on it.
maturity: experimental
---

# Cook

`cook` turns a PR claim into an executable validation recipe. A recipe is not prose-only QA documentation: it is a small graph that maps acceptance criteria to project-native actions, assertions, and artifacts a reviewer can inspect.

Recipes are adapter-neutral. A node may call shell commands, project runners, Playwright, Maestro, Detox, XCTest, CDP/Hermes helpers, or wallet action primitives if installed. Do not make a recipe depend on `wallet-control`; treat it as an optional mobile action layer that can implement actions such as `navigate`, `press`, `set_input`, `scroll`, `screenshot`, and `eval_ref` when the target repo has it.

## When to Use

Use this skill for PRs that need runtime proof, reproducible evidence, or a repeatable reviewer flow. Skip recipe authoring only when the change is static-only and ordinary lint/type/unit checks fully prove it.

## Workflow

1. **Extract proof targets**
   - Read the PR/task, changed files, issue, and acceptance criteria.
   - Write 1-5 concrete proof targets: each should be observable, executable, and small enough to fail clearly.
   - Mark any manual or environment-only target explicitly; do not hide untestable claims.

2. **Choose the execution surface**
   - Prefer the project-native runner or existing scripts in the checkout.
   - Use portable core actions for commands and artifact indexing.
   - Use UI/mobile/browser adapter actions only for real user-facing flows.
   - If `wallet-control` is installed, it may implement mobile wallet primitives; the recipe should still describe the action intent and remain understandable without that skill.

3. **Author the recipe graph**
   - Use the v1 envelope below.
   - Keep setup/action/assert/teardown boundaries explicit.
   - Give every node a stable `id`, an `action`, and a human-readable `description`.
   - Every non-terminal node must transition with `next`, `cases`, or `default`.
   - Every assertion should point back to a proof target.

4. **Run or dry-run what you can**
   - Execute non-destructive commands on the target device/session when available.
   - Save artifacts under `/tmp` or a repo-ignored evidence directory unless the user asks to commit them.
   - If a runner is missing, still produce the recipe plus the exact command or adapter work needed to run it.

5. **Package evidence**
   - Prefer `summary.json`, `trace.json`, `artifact-manifest.json`, and the resolved `recipe.json`.
   - Include screenshots/videos/logs/reports only when they prove a named target.
   - Never include production secrets, SRPs, private keys, bearer tokens, or raw account dumps.

6. **Quality loop**
   - Use `/recipe-quality` before calling the recipe done.
   - Fix must-fix critique items, rerun if possible, then summarize remaining gaps honestly.

## v1 Recipe Envelope

```json
{
  "schema_version": 1,
  "title": "Human-readable validation title",
  "description": "What this recipe proves",
  "inputs": {},
  "validate": {
    "workflow": {
      "pre_conditions": [],
      "setup": [],
      "entry": "start",
      "nodes": {
        "start": {
          "action": "command",
          "description": "Run a project-native check",
          "cmd": "yarn test --runInBand path/to/test",
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      },
      "teardown": [],
      "playback": { "mode": "off", "slow_ms": 2000 }
    }
  }
}
```

Minimum fields: `schema_version: 1`, `title`, `description`, `validate.workflow.entry`, and non-empty `validate.workflow.nodes`.

## Action Vocabulary

Action names are owned by the runner/adapter. Prefer these conventional classes:

- **Portable core:** `command`, `wait`, `assert_json`, `assert_file`, `assert_exit_code`, `artifact_index`, `log`, `end`.
- **UI adapter:** `navigate`, `press`, `set_input`, `scroll`, `wait_for`, `screenshot`, `playwright`, `maestro`, `detox`, `xcode_test`, `adb_shell`.
- **Project adapter:** `eval_ref`, `eval_sync`, `eval_async`, `service_worker`, or other project-owned names validated by that repo.

Avoid raw eval when a named project action exists. If raw eval is unavoidable, label it as inspection/setup and avoid using it to fabricate final user-facing state.

## Artifact Manifest Shape

```json
{
  "version": 1,
  "runStatus": "pass",
  "artifacts": [
    {
      "path": "screenshots/after.png",
      "type": "screenshot",
      "label": "After submitting the form",
      "nodeId": "capture-after",
      "mimeType": "image/png"
    }
  ]
}
```

Use relative paths inside the artifact directory. Useful `type` values include `screenshot`, `video`, `log`, `trace`, `summary`, `json`, `report`, `metric`, `diff`, and `recipe`.

## Output Format

When cooking, return:

1. `Proof Targets` — numbered claims and how each is proven.
2. `Recipe` — path plus important graph nodes, or the full JSON if short.
3. `Run Command` — exact command(s) used or needed.
4. `Artifacts` — paths and what each proves.
5. `Gaps / Follow-ups` — only if something remains unrun, manual, flaky, or blocked.
