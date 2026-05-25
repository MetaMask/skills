---
name: recipe-cook
description: Author, run, and refine executable per-PR validation recipes for MetaMask work. Use when an agent needs to turn acceptance criteria, changed behavior, or reviewer requests into a portable recipe graph with concrete proof targets, project-native actions, and reviewable artifacts. Recipes may use recipe-wallet-control when available, but must not depend on it.
maturity: stable
---

# Recipe Cook

`recipe-cook` turns PR claims into executable validation recipes: small graphs that map acceptance criteria to project-native actions, assertions, and reviewable artifacts.

Load only the files needed for the target repo:

- Recipe format: `references/recipe-v1.md`
- Mobile-first recipe examples and composition patterns: `references/examples.md`
- Evidence package shape: `references/evidence-package.md`
- Runtime harness: use `/recipe-harness` before claiming live Mobile or Extension recipe proof.
- Target-repo instructions are appended below when installed.


## Mobile-First Quick Example

For Mobile, start with a small proof-target map, then compose existing flows or actions:

- PT-1: app is reachable on the intended simulator/device.
- PT-2: the target screen can be opened through the UI/navigation layer.
- PT-3: the changed state is asserted after a real wait condition.
- PT-4: reviewer-visible evidence is captured after the assertion.

Minimal Mobile smoke recipe shape:

```json
{
  "schema_version": 1,
  "title": "Mobile smoke — wallet view is reachable",
  "description": "Proves the debug Mobile app is reachable and can execute a harmless UI adapter action.",
  "validate": {
    "workflow": {
      "pre_conditions": ["mm-4 or another intended simulator is booted", "debug app is installed"],
      "entry": "status",
      "nodes": {
        "status": {
          "action": "command",
          "description": "PT-1: read app status through the Mobile agentic script",
          "cmd": "bash scripts/perps/agentic/app-state.sh status",
          "timeout_ms": 30000,
          "stdout": "logs/status.json",
          "next": "assert-status"
        },
        "assert-status": {
          "action": "assert_json",
          "description": "PT-1: status reports a device, platform, and current route",
          "path": "logs/status.json",
          "equals": { "platform": "ios" },
          "next": "scroll"
        },
        "scroll": {
          "action": "command",
          "description": "PT-2: execute a harmless UI adapter scroll",
          "cmd": "bash scripts/perps/agentic/app-state.sh scroll --offset 40",
          "timeout_ms": 30000,
          "stdout": "logs/scroll.json",
          "next": "assert-scroll"
        },
        "assert-scroll": {
          "action": "assert_json",
          "description": "PT-2: scroll command reports ok=true",
          "path": "logs/scroll.json",
          "equals": { "ok": true },
          "next": "index-artifacts"
        },
        "index-artifacts": {
          "action": "artifact_index",
          "description": "Index status and scroll proof logs",
          "artifacts": ["logs/status.json", "logs/scroll.json"],
          "next": "done"
        },
        "done": { "action": "end", "status": "pass" }
      }
    }
  }
}
```

For product recipes, replace the smoke nodes with existing Mobile flows where possible: navigate first, wait for settled state, assert state/UI, then capture evidence. See `references/examples.md` for concrete Mobile composition patterns.

## When to Use

Use this skill for PRs that need runtime proof, reproducible evidence, or a repeatable reviewer flow. Skip recipe authoring only when the change is static-only and ordinary lint/type/unit checks fully prove it.

## Hard Rules

- Start from acceptance criteria or changed behavior, not from available tooling.
- Each proof target must have an action path, an assertion, and evidence when the result is reviewer-visible.
- User-visible UI claims need visual evidence. A recipe that only asserts state
  or passes unit tests is incomplete for a visible banner, modal, button, route,
  balance, form, or error-message claim unless the visual gap is explicitly
  marked blocked.
- Runtime proof is not complete until the run emits `summary.json`,
  `trace.json`, and an `artifact-manifest.json`/evidence manifest that indexes
  the screenshots, videos, logs, or state files used as proof.
- Prefer existing repo actions, fixtures, page objects, selectors, and test helpers.
- Recipes may use `/recipe-wallet-control` where installed, but must remain understandable without that skill.
- Do not include SRPs, private keys, bearer tokens, production account dumps, or private user data.
- Do not mark a recipe proven unless it was run or the unrun gap is explicit.

## Workflow

1. **Extract proof targets**
   - Read the PR/task, changed files, issue, and acceptance criteria.
   - Write 1-5 concrete proof targets: each should be observable, executable, and small enough to fail clearly.
   - Mark any manual or environment-only target explicitly; do not hide untestable claims.

2. **Choose the execution surface**
   - Prefer the project-native runner or existing scripts in the checkout.
   - Use the installed repo overlay below before inventing actions.
   - Use UI/mobile/browser actions only for user-facing behavior.
   - Use command and JSON assertions for backend, static, or artifact-only behavior.

3. **Author the recipe graph**
   - Use the v1 envelope in `references/recipe-v1.md`.
   - Keep setup/action/assert/teardown boundaries explicit.
   - Give every node a stable `id`, an `action`, and a human-readable `description`.
   - Every non-terminal node must transition with `next`, `cases`, or `default`.
   - Every assertion should point back to a proof target.
   - For `assert_exit_code`, use `"expected": 0` or another numeric expected code. Do not use `"code"`.
   - Add `timeout_ms` to commands that can hang, such as focused Jest, build, simulator, or browser checks.

4. **Run or dry-run what you can**
   - Execute non-destructive commands on the target device/session when available.
   - For historical commits or fresh checkouts, run `/recipe-harness install` and `/recipe-harness verify` before judging runner support.
   - Treat dry-run as schema validation only; a recipe is not proven until the run emits `summary.json`, `trace.json`, and the named artifacts.
   - Runtime proof must record the harness adapter, source/version, verification status, and artifact paths.
   - Save artifacts under `/tmp` or a repo-ignored evidence directory unless the user asks to commit them.
   - If a runner is missing, still produce the recipe plus the exact command or adapter work needed to run it.

5. **Package evidence**
   - Follow `references/evidence-package.md`.
   - Include screenshots/videos/logs/reports only when they prove a named target.

6. **Quality loop**
   - Use `/recipe-quality` before calling the recipe done.
   - Fix must-fix critique items, rerun if possible, then summarize remaining gaps honestly.
   - If the critique says visual evidence is missing for a visible UI claim,
     improve the recipe/evidence package or mark the proof target as blocked;
     do not downgrade the claim to unit-test-only proof.

## Output Format

When cooking, return:

1. `Proof Targets` — numbered claims and how each is proven.
2. `Recipe` — path plus important graph nodes, or the full JSON if short.
3. `Run Command` — exact command(s) used or needed.
4. `Artifacts` — paths and what each proves.
5. `Quality Loop` — critique verdict, improvement made, and rerun status.
6. `Gaps / Follow-ups` — only if something remains unrun, manual, flaky, or blocked.
