---
name: recipe-cook
description: Author, run, and refine executable per-PR validation recipes for MetaMask work. Use when an agent needs to turn acceptance criteria, changed behavior, or reviewer requests into a portable recipe graph with concrete proof targets, project-native actions, and reviewable artifacts. Recipes may use recipe-wallet-control when available, but must not depend on it.
maturity: experimental
---

# Recipe Cook

`recipe-cook` turns PR claims into executable validation recipes: small graphs that map acceptance criteria to project-native actions, assertions, and reviewable artifacts.

Load only the files needed for the target repo:

- Recipe format: `references/recipe-v1.md`
- Good and bad examples: `references/examples.md`
- Evidence package shape: `references/evidence-package.md`
- Target-repo instructions are appended below when installed.

## When to Use

Use this skill for PRs that need runtime proof, reproducible evidence, or a repeatable reviewer flow. Skip recipe authoring only when the change is static-only and ordinary lint/type/unit checks fully prove it.

## Hard Rules

- Start from acceptance criteria or changed behavior, not from available tooling.
- Each proof target must have an action path, an assertion, and evidence when the result is reviewer-visible.
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

4. **Run or dry-run what you can**
   - Execute non-destructive commands on the target device/session when available.
   - Save artifacts under `/tmp` or a repo-ignored evidence directory unless the user asks to commit them.
   - If a runner is missing, still produce the recipe plus the exact command or adapter work needed to run it.

5. **Package evidence**
   - Follow `references/evidence-package.md`.
   - Include screenshots/videos/logs/reports only when they prove a named target.

6. **Quality loop**
   - Use `/recipe-quality` before calling the recipe done.
   - Fix must-fix critique items, rerun if possible, then summarize remaining gaps honestly.

## Output Format

When cooking, return:

1. `Proof Targets` — numbered claims and how each is proven.
2. `Recipe` — path plus important graph nodes, or the full JSON if short.
3. `Run Command` — exact command(s) used or needed.
4. `Artifacts` — paths and what each proves.
5. `Gaps / Follow-ups` — only if something remains unrun, manual, flaky, or blocked.
