---
name: recipe-evidence
description: Format recipe run outputs into concise PR-ready validation evidence for MetaMask reviewers. Use when an agent has recipe artifacts, screenshots, logs, or trace output and needs a clear PR comment or description section.
maturity: stable
---

# Recipe Evidence

`recipe-evidence` turns recipe outputs into reviewer-facing text. It does not invent proof. If artifacts are missing or weak, say so and call `/recipe-quality`.

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
- Never claim Mobile or Extension runtime proof without a passing `/recipe-harness verify`; report missing harness proof as a gap.

## Output

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
