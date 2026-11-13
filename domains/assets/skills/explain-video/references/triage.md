# PR Walkthrough Triage and Code Rules

Before drafting the narration and scene layout, triage every file changed in the PR and plan how it will be represented.

## 1. Importance Triage

Rank every changed file and diff hunk into one of three categories:

| Category | Criteria | Presentation |
| --- | --- | --- |
| **Covered** | Changes that alter runtime behaviour, control flow, data shape, a public API, error handling, concurrency, or security. | Featured in dedicated scenes with a diagram or code snippet. |
| **Mentioned** | Renames, import/export changes, formatting, mechanical refactors, test updates, boilerplate, and config churn. | Collapsed into one spoken line (e.g. *"The rest of the PR covers test updates and re-exports"*). No dedicated scene. |
| **Skipped** | Generated files (`api-report.md`, `*.api.json`), lockfiles (`package-lock.json`, `pnpm-lock.yaml`, `bun.lock`), changelogs, snapshots, generated reference docs, and anything marked `DO NOT EDIT`. | Omitted entirely from visual scenes and spoken narration. |

### Grouping Rule
When changes across multiple files are many and similar (for example, adding the same error parameter across six API handlers), group them into one scene instead of dedicating one scene to each file.

### Narrative Ordering
Order scenes to build understanding, not by git commit or alphabetical file order. For example, introduce and define a new type or interface before showing the functions where it is used.

## 2. Walkthrough Depth & Sizing

Depth determines pacing, visual format, and snippet limits. Infer the default depth from PR size:

- **Overview:** 60–90 seconds, 3–5 scenes. High-level architecture diagrams only. **No code on screen.** Best for high-level summaries and non-technical stakeholders.
- **Standard (Default):** 2–3 minutes, 4–7 scenes. Architecture diagrams plus 2–4 short code snippets. Best for standard code reviews.
- **Deep dive:** 4–5 minutes, 8–10 scenes. Detailed walkthrough with annotated diffs across all featured changes. Use only when explicitly requested.

Scene count and video length follow the chosen depth and PR size; do not use a fixed 4–6 scenes.

## 3. Code-Scene Presentation Rules

Applies to Standard and Deep dive modes:

1. **Anchored visuals:** Show a real diff hunk or code excerpt only when the narration is directly explaining that code.
2. **Snippet limits (Standard):** Maximum 10 lines per snippet and about 4 snippets total across the video. Trim the hunk to the relevant lines and highlight changed lines.
3. **Narration explains "why" and "what":**
   - The narration explains why the change was made and what it does.
   - **Never read code aloud** line-by-line or character-by-character.
   - Always name the file and function so the viewer connects the narration to the code on screen.
4. **Captions & Spelling:** Subtitles use the one Whisper pass from `scripts/verify_audio.py`, grouped in chunks of 5–7 words and broken on pauses (>450 ms). Caption text is the line's `display` spelling (`onAfterChange`, not `on after change`).
