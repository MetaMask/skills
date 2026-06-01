---
name: recipe-fix-ticket
description: Fix a MetaMask bug from a Jira/GitHub ticket and prove it with a recipe. The human hands off a ticket and walks away; this drives ticket → repro → minimal fix → recipe proof → evidence package, then stops for review. Use when an agent must reproduce or understand an existing failure before fixing it. For new behavior with no bug to reproduce, use /mms-recipe-dev.
maturity: experimental
---

# Recipe Fix Ticket

A thin orchestrator over the recipe pipeline (`/mms-recipe-doctor` → `/mms-recipe-harness`
→ `/mms-recipe-cook` → `/mms-recipe-quality` → `/mms-recipe-evidence`). The human starts it
and leaves; you run autonomously to a finalized, reviewer-ready result. Unlike
`/mms-recipe-dev`, you reproduce or understand the failure before patching.

The proof, runtime, and recipe rules live in the lower skills. This wrapper only orders the
delegates, keeps the run honest, and stops with an evidence package. Do **not** re-derive
harness/recipe/runtime detail here — invoke or follow the named delegate instead.

## Handoff (do first)

1. Create the progress file the human monitors, then continue without waiting:
   ```bash
   .agents/skills/mms-recipe-fix-ticket/scripts/init-checklist.sh --platform <mobile|extension> --slug <ticket-slug>
   ```
   It prints the `CHECKLIST.md` path. Fallback: copy `references/metamask-<platform>-checklist.md`
   to `temp/tasks/<skill>/<timestamp>-<slug>/CHECKLIST.md`.
2. Reply once: *"Go get a coffee ☕ — I'll take it from ticket → fix → recipe → evidence and
   report back when it's done or concretely blocked. Live progress: `<path>`."* Then run
   autonomously; do not wait for the human after this.
3. `CHECKLIST.md` is the source of truth. Mark each gate `[x]` / `BLOCKED: <reason>` /
   `N/A: <reason>` with its artifact path as you go — not in one batch at the end.

## Source of truth

The ticket text or pasted details are authoritative. If Jira/MCP/web returns a login wall,
empty issue, or ambiguous page, ask the human once for the summary + acceptance criteria,
then continue. Never infer or rewrite ACs from branch names, stale artifacts, or prior runs.
Before editing product code, print the numbered AC matrix: target surface, state
precondition, exact copy, and proof mode (`state` / `visual` / `mixed`). Label any inferred
field `UNKNOWN` and ask rather than guess.

## Delegate chain (in order)

Each gate must actually invoke or follow the named skill; ad-hoc scripts, controller evals,
or screenshots do not satisfy it. Record the delegate output path or blocker in `CHECKLIST.md`.

1. `/mms-recipe-doctor` — setup/fixture readiness. A malformed fixture or missing tool/harness
   is `BLOCKED`; fix before product edits.
2. `/mms-recipe-harness` — install/verify the runtime when live proof applies.
3. `/mms-recipe-cook` — author the baseline/no-state recipe that captures the failure first,
   then the after/with-state recipe that proves the fix. recipe-cook owns recipe format, proof
   modes, reuse, and the no-fake-state rule.
4. Implement the **smallest** fix that satisfies the ACs (every changed line traces to an AC;
   no adjacent refactors). Run focused lint/type/unit checks — passing only unlocks proof, it
   is not a stop point.
5. Run the recipe live and read the screenshots yourself before trusting `status: pass`.
6. `/mms-recipe-quality` — critique against the AC matrix; apply one improve/rerun cycle or
   record that none is needed.
7. `/mms-recipe-evidence` — PR-ready package: product diff, recipe path, run command,
   `summary.json`, `trace.json`, artifact manifest, screenshots, quality verdict, gaps.

## Safety invariants

- **Runtime start is approval-gated.** Do not start or restart Metro, a simulator, webpack,
  or Chrome/CDP — including wrappers, aliases, `nohup`, or background tmux that do — without
  approval. Missing approval → record `BLOCKED: pending runtime-start approval` with the exact
  command and wait. With approval, drive starts through `/mms-recipe-harness`, not raw builds.
- **No manufactured state.** Do not prove a user-visible AC by injecting state (`stateHooks`,
  Redux/store writes, fiber/DOM mutation, controller/background calls). Valid proof is a real
  UI-flow recipe or a harness-loaded pre-start fixture; otherwise mark the AC
  `BLOCKED`/`PASS-WITH-GAPS` and name the missing fixture.
- **Fallback screenshots are not clean visual proof.** A PNG marked DOM-fallback /
  native-capture-blank, or a `trace.json` `fallbackReason`, keeps that visual AC at
  `PASS-WITH-GAPS` even when `summary.json` says pass.

## Honest verdict

Final verdict is `PASS` only when every AC proof target passed. Any unrun, blocked, or
fallback-only AC ⇒ `PASS-WITH-GAPS` or `BLOCKED`, listed by AC number. Never claim "all ACs
met" or "ready" from a code diff or unit tests alone. For visual/mixed ACs, "code-proven" is
not a valid status.

## Ordered checklist

`init-checklist.sh` copies the platform checklist into `CHECKLIST.md` **for the human to
follow** — it is their live progress view while they wait. Execute it in order and flip each
box `[ ]` → `[x]` (or `BLOCKED`/`N/A`) with its artifact path the moment that gate completes,
so the human watching the file always sees the true current state. The canonical sequence:

```markdown
- [ ] 0. Coffee handoff sent.
- [ ] 1. Ticket captured: URL or pasted text, summary, ACs.
- [ ] 2. AC matrix: each AC numbered with proof mode (state/visual/mixed).
- [ ] 3. Target runtime selected (Mobile/Extension + env).
- [ ] 4. Repro/baseline plan written before product edits.
- [ ] 5. /mms-recipe-doctor setup status recorded.
- [ ] 6. /mms-recipe-harness install/verify; manifest path recorded.
- [ ] 7. /mms-recipe-cook baseline/no-state recipe + command (or baseline BLOCKED with reason).
- [ ] 8. Baseline recipe run, or explicitly blocked.
- [ ] 9. Minimal fix implemented.
- [ ] 10. Focused checks run (type/jest/lint).
- [ ] 11. /mms-recipe-cook after/with-state recipe + command.
- [ ] 12. Recipe run live; summary.json/trace.json/manifest paths recorded.
- [ ] 13. Screenshots read; claimed UI visible (not hidden/offscreen/wrong tab).
- [ ] 14. /mms-recipe-quality critique against AC matrix + artifacts.
- [ ] 15. One improve/rerun cycle, or quality says none needed.
- [ ] 16. /mms-recipe-evidence PR-ready package produced.
- [ ] 17. Final report: fix, tests, recipe evidence, gaps. Offer PR on consent.
```

Steps 1–4 precede behavior edits (except a tiny locator-only `testID` add needed to make
baseline evidence executable). A runtime blocker is valid only after step 6 or the relevant
recipe run was actually attempted and the exact failure recorded.

## Finish

Ask whether to clean up runtime resources (Metro port, simulator/device, webpack/CDP, tmux
pane) now or leave them for review. Once evidence is packaged, ask whether to open a PR; if
yes, use `/mms-recipe-evidence` "Create PR + upload" (owner via `gh api user`, consent-gate
every outward step). Then return:

1. `Root Cause` — concise explanation.
2. `Fix` — files changed and why.
3. `Tests` — commands run and result.
4. `Recipe Evidence` — recipe path, artifacts, verdict.
5. `Remaining Risk` — only if something is unproven.
