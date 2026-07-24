# Evidence gate — setup (optional, Claude Code only)

`hooks/pr-evidence-gate.py` is an **optional** mechanical enforcement of the disciplines documented in [`evidence-trustworthiness.md`](./evidence-trustworthiness.md). It is a Claude Code `PreToolUse:Bash` hook: before an outward-facing `gh pr|issue edit|create|comment` runs, it scans the `--body`/`--body-file` for a validation-scoped claim that asserts a verdict, a runtime observation, or a deferral **without** a co-located inspectable artifact or tracker, and blocks the write if it finds one.

The hook is **Claude-Code-specific**. Other operators (Cursor, Codex, plain review) don't get the mechanical gate — for them the same disciplines apply as *documentation*, self-enforced by reading `evidence-trustworthiness.md`. The hook is not required to use the skill; it just moves the checklist from "remember to run it" to "runs automatically at emit time."

It **fails open**: anything it cannot parse (non-`gh` command, unreadable body, malformed JSON) is allowed through, so it never bricks unrelated Bash commands. It uses the Python 3 standard library only (`json`, `re`, `sys`) — no dependencies to install.

## Wire it up (Claude Code `settings.json`)

Add a `PreToolUse` hook with matcher `Bash` that runs the script with `python3`. Put this in your user `~/.claude/settings.json` or a project `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "python3 /absolute/path/to/pr-validate/hooks/pr-evidence-gate.py"
          }
        ]
      }
    ]
  }
}
```

Resolve the path to wherever `pr-validate` lives on disk. Note that `tools/install` copies only the `references`/`scripts`/`assets`/`adapters` bundles into `~/.claude/skills/mms-pr-validate/` — the `hooks/` directory is **not** part of the installed bundle. Point the `command` at your checked-out skills repo instead:

```
<skills-repo>/domains/pr-workflow/skills/pr-validate/hooks/pr-evidence-gate.py
```

**When it blocks:** the hook exits `2` and prints the reason (which claim, what artifact/tracker it needs) to stderr. Claude Code surfaces that to the model, which self-corrects — attaches the missing artifact/tracker or downgrades the verdict — and re-posts. No manual intervention needed.

## Two other setup requirements the skill needs

These are independent of the hook; the skill needs them whether or not you install the gate.

1. **`gh pr comment` must be permitted — pick a grant model.** pr-validate posts its evidence bundle as a PR review comment (`gh pr edit` if publishing into your own PR body). Four options, in descending order of standing safety:

   | Model | How | Tradeoff |
   |---|---|---|
   | **`ask` (recommended)** | `"Bash(gh pr comment:*)"` in `permissions.ask` | Per-post confirmation prompt. Combined with this hook (content gate) and a draft-confirm habit, that's three independent layers. |
   | **`allow` + hook** | same pattern in `permissions.allow`, hook wired | Frictionless posting; safety rests entirely on the hook and your draft discipline. Only sensible where the hook is actually installed — not for operators without hook support. |
   | **Allowlisted wrapper** | keep raw `gh pr comment` denied; allowlist a small script that takes `--repo`/`--pr`/`--body-file`, checks preconditions (canonical header present), and is the only sanctioned path | Tightest scoping — the raw verb stays blocked; costs a script to maintain. |
   | **No grant — manual post** | the model prepares the body file; you run `gh pr comment <n> --repo <owner/repo> --body-file <file>` yourself | Zero standing grant; you are the bottleneck. The universal fallback, and the only option on operators with no permission system. |

   Avoid a bare **deny** on the comment verbs if you use this skill: it hard-blocks the publish step with no prompt, which reads as a mysterious failure mid-run.

2. **Image re-hosting needs your own public evidence repo.** Screenshots and recordings captured locally must be re-hosted to a public URL before a reviewer can see them (see items 8–9 in `evidence-trustworthiness.md`). This repo is **yours to provide** — set it to a public repo you control, referenced here as `<your-evidence-host-repo>`. There is no shared/default host: parameterize it in your own configuration and push captures there, then reference the resulting raw URLs in the PR comment. Do not hardcode someone else's host.
