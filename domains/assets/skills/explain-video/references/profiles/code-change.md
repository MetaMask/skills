# Profile: code-change

For a pull request, branch, commit range, or a piece of code the user wants explained. This is the original behaviour of the skill, unchanged.

## Signals

A PR URL or number, `gh pr` output, a branch or diff, a path in a repo, "walk me through this change". Default audience: engineers reviewing or onboarding. Ask for the audience if it is someone else (e.g. a PM or leadership wanting the gist: use Overview and no code).

## Ingest

- Run `gh pr view <n> --json title,body,commits,files` and `gh pr diff <n>`.
- Filter out noisy and generated files: lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock`), changelogs, snapshots, API reports (`**/api-report.md`, `**/*.api.json`), generated reference docs, and anything marked `DO NOT EDIT`.
- Note the problem, approach, and key mechanisms. Ask only about what the PR cannot tell you, such as the audience or exact business facts.
- Facts: file paths, function names, version numbers, and anything quoted from the PR body come from the diff or description. Follow [../facts.md](../facts.md); for most code walkthroughs the ledger is short or empty.

## What matters

Triage every changed file per [../triage.md](../triage.md) into **Covered**, **Mentioned**, or **Skipped**. Group many similar changes into one scene. Order scenes to build understanding (define types before usage), not by file order.

## Depth

Default inferred from PR size. Scene count and length follow depth, not a fixed count.

- **Overview:** diagrams only, no code, ~60–90 seconds, 3–5 scenes. For a high-level picture.
- **Standard (default):** diagrams plus 2–4 short code snippets, ~2–3 minutes.
- **Deep dive:** annotated diffs, ~4–5 minutes, 8–10 scenes. Only when asked.

## Scenes and code rules

Diagrams and code snippets only, no paragraphs on screen. Show a real hunk only when the narration is about that code; max 10 lines per snippet and about 4 snippets in Standard; Overview shows no code. The narration explains why and what, names the file and function, and never reads code aloud. Details in [../triage.md](../triage.md) section 3.

## Defaults

Script style: Natural. Theme: Motion Engineering, or MetaMask Developer for MetaMask repos and engineer audiences, or MetaMask when the video is for a wider internal audience.

## Plan contents (shown at approval, in addition to the shared items)

- **Triage table:** Covered (scene number, file, function, snippet excerpt), Mentioned in one line, Skipped (files omitted and why).
- **On-screen snippets:** exact code hunks and source files.
- **Scene list:** one idea per scene.

## Verify after render

Every file or function named in the narration matches the diff. Run `scripts/verify_facts.py` if the ledger is non-empty.
