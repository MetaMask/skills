---
name: recipe-evidence
description: Format recipe run outputs into concise PR-ready validation evidence for MetaMask reviewers. Use when an agent has recipe artifacts, screenshots, logs, or trace output and needs a clear PR comment or description section.
maturity: experimental
---

# Recipe Evidence

`recipe-evidence` turns recipe outputs into reviewer-facing text. It does not invent proof. If artifacts are missing or weak, say so and call `/mms-recipe-quality`.

Load only what applies:

- Evidence examples: `references/examples.md`
- Target-repo evidence notes are appended below when installed.

## Inputs

Use available files:

- `recipe.json`
- `summary.json`
- `trace.json`
- `artifact-manifest.json`
- screenshots, videos, logs, reports
- `.agent/recipe-harness/<adapter>/manifest.json` and verify artifacts when runtime proof is claimed
- command output
- PR acceptance criteria or proof targets

## Rules

- Keep it brief.
- Link each artifact to the claim it proves.
- Separate passed proof from unrun gaps.
- Include the harness verify artifact path when runtime proof is claimed.
- Include `summary.json`, `trace.json`, and
  `artifact-manifest.json`/evidence-manifest paths for every recipe run used as
  proof.
- For reviewer-visible UI claims, include screenshot/video paths. If they are
  missing, the evidence section must say the visual claim is unproven.
- Do not paste long logs.
- Redact secrets and private account data.
- Never claim a recipe passed if the run did not complete.
- Never claim Mobile or Extension runtime proof without a passing `/mms-recipe-harness verify`; report missing harness proof as a gap.

## Output

Always create a reviewer-copyable package directory under the task folder:

```bash
.agents/skills/mms-recipe-evidence/scripts/package-pr-evidence.js \
  --task temp/tasks/<skill>/<run-slug>
```

The package must contain:

- `pr-package/pr-desc.md` — GitHub PR description draft with explicit
  drag/drop image markers. This draft must be based on the target repo's
  `.github/pull-request-template.md` / `.github/pull_request_template.md`
  when that file exists; only use the generic fallback if no repo template is
  present.
- `pr-package/images/` — copied screenshot evidence with short,
  stable, reviewer-friendly filenames such as
  `01-ac1-no-btc-position-banner-absent.png`.
- `pr-package/evidence.md` — full evidence block copied from
  `PR-READY-EVIDENCE.md` when present.
- `pr-package/recipe-quality.md` — quality verdict when present.
- `pr-package/checklist.md` — checklist snapshot when present.
- `pr-package/package-manifest.json` — machine-readable package index.
- `pr-package/final-report.md` — human summary with the task path and package
  path.

If the script cannot infer enough context, still write `pr-desc.md` with TODO
markers rather than skipping the package. Do not put generated task artifacts in
the product PR diff; the package is for copy/paste and drag/drop only.

The final response from the high-level skill must print:

- `Task path: <task-dir>`
- `PR package path: <task-dir>/pr-package`
- `PR description draft: <task-dir>/pr-package/pr-desc.md`
- `Evidence images folder: <task-dir>/pr-package/images`

```md
### Recipe validation

Verdict: pass-with-gaps

Proved:
- PT-1: Send amount error appears for insufficient balance.
- PT-2: Error clears after valid amount entry.

Artifacts:
- `summary.json` — run status and environment.
- `trace.json` — node execution trace.
- `screenshots/send-valid-amount.png` — settled valid amount screen.

Gaps:
- Android not run.
```

- Treat blank/black screenshots as missing visual evidence unless the artifact includes an explicit explanation and alternate reviewer-visible proof.
- DOM-rendered screenshot fallbacks are acceptable when native CDP/Playwright screenshots are blank or time out, but label them as fallbacks and keep the original blank-capture gap visible.
