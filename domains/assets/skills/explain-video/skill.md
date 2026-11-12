---
name: explain-video
description: >-
  Turns a PR, branch, technical doc, ADR, PRD, strategy doc, or a Jira, Confluence, or
  Google Doc into a short narrated explainer video with a local Kokoro voice. Infers the
  content profile from the source (code-change, technical-doc, product-doc), then picks
  depth (Overview, Standard, Deep dive), script style (Natural default or Strict STE100),
  and theme (Motion Engineering, MetaMask, or MetaMask Developer), rendered by a small bundled
  Videowright-derived renderer with no npm install. Traces every on-screen number, date, and
  name to the source in a facts ledger and checks it, keeps on-screen spelling in
  `display` and speech in `spoken`, runs local pronunciation scripts, asks for missing
  facts, shows the plan for approval, and keeps the file local until the user names a
  destination. For engineers, PMs, EMs, designers, and leaders.
maturity: experimental
---

# Explain as a short video

Do not install packages, write scene files, render, commit, push, upload, or edit a pull request until the user approves the plan in [Approval](#approval).

## When to use

- "Make a video of this PR / branch / diff" — a short narrated walkthrough for reviewers.
- "Explain this ADR / RFC / design doc / runbook as a video."
- "Turn this PRD / strategy / roadmap / epic / readout into a video" for an audience that will not read the whole doc.
- Any request for an explainer, walkthrough, or readout video of a code change or a document.

Skip it for trivial changes and when the user only wants text; the profiles' triage rules decide what to leave out.

## How this skill is organized

`skill.md` is the router and the shared pipeline. What changes with the *kind of source* lives in a profile:

| Profile | For | Read |
|---|---|---|
| **code-change** | PR, branch, diff, code | [references/profiles/code-change.md](references/profiles/code-change.md) |
| **technical-doc** | ADR, RFC, design doc, API/SDK docs, runbook, postmortem | [references/profiles/technical-doc.md](references/profiles/technical-doc.md) |
| **product-doc** | PRD, strategy, roadmap, readout, brief, Jira epic, Google Doc | [references/profiles/product-doc.md](references/profiles/product-doc.md) |

Shared by all: [references/facts.md](references/facts.md) (nothing is invented), [references/script-style.md](references/script-style.md), [references/lexicon.json](references/lexicon.json), the themes under [assets/styles/](assets/styles/), the bundled renderer [scripts/render/vw.ts](scripts/render/vw.ts), and the production steps below. Depth (Overview / Standard / Deep dive) is a separate axis from profile; each profile says what each depth means for its material.

## Pick the profile

Infer it from the source. Do not ask the user to choose a persona; the author's role does not predict the source or the audience.

| Signal | Profile |
|---|---|
| PR URL or number, branch, commit range, diff, a path in a repo | code-change |
| ADR, RFC, design doc, tech spec, API/SDK docs, runbook, postmortem; or a doc that describes how a system works or why a technical option was chosen | technical-doc |
| PRD, one-pager, strategy, roadmap, research readout, brief, epic, or a Google Doc / Confluence / Notion page about product intent, users, metrics, or timing | product-doc |
| Several sources | The one that carries the most of the story is primary; the others supply evidence. Say so in the plan |
| Unclear, or a topic with no source | Ask one question: "Is this mainly about a code change, how a system works, or a product plan?" |

State the inference in the plan as one correctable line: `Reading this as: <profile> · for <audience> · <depth> · <theme>`. If the user corrects it, switch profiles.

## Ask first

`scenes.json` in the explainer folder is the only script. Each line has `display` (real on-screen spelling) and `spoken` (what the voice says). Write `spoken` already expanded: `onAfterChange` → "on after change", `API` → "A P I", `.ts` → "dot T S", `==` → "equals equals". `spoken` must not contain camelCase, snake_case, symbols, paths, digits glued to identifiers, or all-caps tokens. Give each scene two spoken lines of about 20 words or more; very short lines are merged into one chunk and lose a visual beat. Captions are the `display` text timed to the voice, so `display` and `spoken` must carry the same words and differ only in spelling (`V1` vs "version one", `$41.25M` vs "forty one point two five million dollars"). Do not drop or add words in one of them (for example a leading "Meanwhile," that is spoken but not shown); the caption for that phrase will start early or late.

Read [references/lexicon.json](references/lexicon.json). Its entries win over [scripts/speak_prep.py](scripts/speak_prep.py). A `phonemes` field is Misaki's own symbols, written `[term](/phonemes/)`, not IPA. Misaki drops symbols it does not know. `id`, `ID`, and an `Id` suffix are the abbreviation eye-dee: Misaki `ˌIˈdi`, which is `/ˌaɪˈdiː/` (`a` and `ː` are not Misaki symbols). Listen once with [scripts/audition.py](scripts/audition.py) before keeping an override. That audition is a one-time setup check, not part of every video.

Read the source first, as the profile says. Ask only what is still unknown. One round of questions, then the plan:

1. Topic, who it is for, and the one thing they should understand at the end. Infer topic from the source; ask for the audience if it is not obvious (the profile lists its audience options).
2. Facts that must be exact: names, numbers, dates, paths, ticket ids. Do not invent these. If a fact is missing, ask. Do not guess. Follow [references/facts.md](references/facts.md) and write `facts.json`.
3. Depth, with the default from the profile and the source size: **Overview**, **Standard**, or **Deep dive**. Scene count and length follow depth, not a fixed count.
4. Script style: **Natural (default)** or **Strict STE100** (see [references/script-style.md](references/script-style.md)).
5. Theme (HTML/TypeScript/WAAPI segments rendered by the bundled renderer [scripts/render/vw.ts](scripts/render/vw.ts); the profile suggests one):
   - **Motion Engineering (default)** — aerospace HUD, blueprint CAD, crisp systems diagrams, code terminals, telemetry. Bundled at [assets/styles/motion-engineering/](assets/styles/motion-engineering/STYLE.md).
   - **MetaMask** — OLED black, Inter, fox-orange accent, rounded cards. Bundled at [assets/styles/metamask/](assets/styles/metamask/STYLE.md). Use for MetaMask product topics and any audience wider than engineers.
   - **MetaMask Developer** — `#0A0A0A` canvas, wireframe four-colour fox, horizontal "MetaMask Developer" lockup, code-first and mono-led. Bundled at [assets/styles/metamask-developer/](assets/styles/metamask-developer/STYLE.md). Prefer it for SDK, API, docs, tooling, token, or code-heavy topics aimed at engineers.
6. Pronunciations are not a question. Ask only about a person's name. Do not ask how to say an identifier, acronym, or id.
7. Where the finished file goes:
   - **Keep local (default).** Ask for a folder. Default `~/Videos/explainers/<topic-slug>/`. Do not `git add` the video or the source material.
   - **A pull request description,** a chat message, or another place the user names. Ask which. Do not commit the mp4. Do not push.

## Approval

Prepare the plan in this order: read the source per the profile, build the facts ledger, run `python3 scripts/verify_facts.py <scenes.json> --facts <facts.json>` on the draft script, and fix what it reports. Then show this and wait for a yes:

- **Reading this as:** profile · audience · depth and estimated length · theme · script style
- **Source stamp:** what you read (title, owner, status, as-of date, how much of it) — for documents
- **The profile's plan contents** (triage table for code; narrative outline, omitted sections, and confidential-content list for docs)
- **Scene list:** one idea per scene
- **Facts ledger** and **discrepancies** from [references/facts.md](references/facts.md): every number, date, and name that will appear, its source, and any conflict with the proposed resolution. Ask the user to confirm or correct. A discrepancy with no resolution blocks the render.
- **Spoken lines**, written per [references/script-style.md](references/script-style.md). `spoken` is already expanded.
- **Unknowns table** from `python3 scripts/speak_prep.py <scenes.json>`. Correct a row in this yes if the spoken form is wrong. Do not paste a longer list than the report.
- **Destination:** local path (default), or the place the user named

## Production

After approval, follow these steps in this order. Do not skip or reorder them.

Run [scripts/setup.sh](scripts/setup.sh) once if `~/.venvs/explain-video` is not yet set up (Kokoro 82M, Misaki, and Whisper).
Always use the **local Kokoro 82M voice** (`af_heart`, 24 kHz). The voice runs on your machine. Do not use a cloud voice. Do not clone a person's voice.

Videos are built with [scripts/render/vw.ts](scripts/render/vw.ts), a single-file renderer for HTML/TypeScript/Web Animations segments: a copy of <https://github.com/Prithpal-Sooriya/tiny-video-renderer> at `v0.2.3` (sha256 `4311f02377511163984bd222024d2f09e08377102ca91230b1edf80c039b7d51`), derived from Videowright (MIT), plus a local layout and contrast check (`--check`, `scripts/render/layout-check.js`) that is not upstream yet. It needs **no npm install, no `package.json` and no `node_modules`**: Node 22.18+ (verified on 24), Chrome, and ffmpeg. To update it, re-download a newer tag, verify its hash as that repo's README describes, and re-apply the `--check` changes; do not edit it otherwise.

1. **Project structure & Config:**
   In the explainer folder (e.g. `~/Videos/explainers/<topic-slug>/`):
   - Set `defaultStyle` in `videowright.config.ts` to the chosen theme slug: `'motion-engineering'` or `'metamask'`.
   - **MetaMask Developer:** copy [assets/styles/metamask-developer/](assets/styles/metamask-developer/) to `<explainer>/styles/metamask-developer/` and import `styles/metamask-developer/style.css` (tokens and fonts in one file), set `defaultStyle` and `meta.style` to `'metamask-developer'`, and read `styles/metamask-developer/STYLE.md` (it lists only what differs from MetaMask, so read `styles/metamask/STYLE.md` too). Lockup: `foxDeveloperMark` + `developerWordmark` from `styles/metamask-developer/developer.ts`; hero: `revealDeveloperFox` on the first and last scene.
   - **Motion Engineering:** its CSS comes from the renderer repo, pinned like `vw.ts`. From the explainer folder run:
     ```bash
     mkdir -p styles/motion-engineering
     curl -fsSL https://raw.githubusercontent.com/Prithpal-Sooriya/tiny-video-renderer/v0.2.3/example/styles/motion-engineering/style.css -o styles/motion-engineering/style.css
     echo "c2f5f7e9daf7d11718f954c2f1afbe891e0204a12421ec6d2ee7565fff26d17b  styles/motion-engineering/style.css" | (sha256sum -c - 2>/dev/null || shasum -a 256 -c -)
     cp <skill>/assets/styles/motion-engineering/STYLE.md styles/motion-engineering/
     ```
     and import `./styles/motion-engineering/style.css`, then `./styles/motion-engineering/tokens.css` (safe area and readable text tokens; copy it from the skill too), in `timeline.ts`. It is one self-contained file (tokens, embedded fonts, blueprint grid). It also defines `.tvr-*` layout classes you can ignore; they never collide with your own class names.
   - **MetaMask:** copy [assets/styles/metamask/](assets/styles/metamask/) (including `fox.ts`, `fox.svg`, `wordmark.ts`, `wordmark-white.svg`) to `<explainer>/styles/metamask/` and import `styles/metamask/style.css` (tokens and fonts in one file) in `timeline.ts`. Read `styles/metamask/STYLE.md` and `brand.md` before authoring segments, and follow them instead of the Motion Engineering HUD rules below (same for MetaMask Developer). Set `meta.style: 'metamask'`. Show the lockup (fox + official wordmark via `foxMark` and `wordmark`) on every scene, and assemble the hero fox (`assembleFox` from `styles/metamask/fox.ts`) on the first and last scene.
   - **Layout kit (every theme):** copy [assets/kit/](assets/kit/) to `<explainer>/kit/` and import `./kit/kit.css` in `timeline.ts` after the theme CSS. See **Layout & Contrast Rules** below.
   - **Tailwind classes (optional, MetaMask and MetaMask Developer only):** to style scenes with class names such as `flex gap-8 rounded-md bg-section p-8 text-heading-sm text-default`, also import `./kit/tailwind.css` after `./kit/kit.css`. It is a static, dark-only sheet generated from the design tokens; no install, no build step. The class list is in `styles/metamask/STYLE.md` under **Tailwind classes**; `--check` then rejects any class not in it, with a fix. Animation is still WAAPI in `play()`, with unchanged timing.
   - Organize segments under `segments/<segment-id>/index.ts`. The project root is the folder holding `videowright.config.ts` (`export default defineConfig({ projectStructure: "v1", defaultStyle, defaults: { resolution: [1920, 1080], fps: 60 } })`); `timeline.ts` sits at or below it. Import `defineSegment`, `defineConfig` and transitions from `"videowright"`; that resolves to the bundled runtime.

2. **Audio, Beat Timestamps & Captions:**
   - Prepare speech, if `scenes.json` changed since approval: `python3 scripts/speak_prep.py <scenes.json>`. Read only that report.
   - Synthesize with the venv Python: `~/.venvs/explain-video/bin/python scripts/synth.py <scenes.json> --out <explainer>`. It writes audio, `durations.json`, and `audio/tracks/v1/track.ts`.
   - The track's field is `length_s`, and `timing.perSegment` values are cumulative advance times (for example `[3.425, 8.225]`). Copy each segment `voiceover` and those advances into `defineSegment`. Do not keep a second script.
   - Generate the segment data with `python3 scripts/build_segment_data.py <explainer>`. It writes `timing.ts` (`advances`, `voiceover`) and `captions.ts` (`cues`, scene-relative) from `durations.json` and `captions.json`. Import them in the segments instead of copying numbers by hand.
   - Verify with `~/.venvs/explain-video/bin/python scripts/verify_audio.py <scenes.json> --out <explainer>`. Read only its report. Captions are the `display` text in `captions.json` from that same Whisper pass. Each display word is aligned to the words Whisper heard (numbers and hyphenated words expand to several spoken words), then grouped by pauses, so caption text follows the voice even on long deep-dive lines.
   - For each flagged token, run `verify_audio.py --repair` once. That tries one respelling or one Misaki phoneme override and re-checks only the flagged chunks. If it is still flagged, stop and name the token. After approval, append a fix that worked to [references/lexicon.json](references/lexicon.json). Do not loop.

3. **Visual Standards & Code Scenes** (the canvas, type, and HUD bullets below are for Motion Engineering; with the MetaMask themes follow `styles/metamask/STYLE.md` or `styles/metamask-developer/STYLE.md` for those and keep Layout Discipline. The code-scene rules apply to profiles that show code; product-doc scenes show no code, see the profile's scene list):
   - **Canvas & Palette:** 1920×1080 canvas. Charcoal background (`var(--color-bg)`: `#0e141a`), 64px blueprint grid lines, slate borders (`#1e2a36`).
   - **Type:** Space Grotesk (display & body) and JetBrains Mono (telemetry, coordinates, code terminals). Sized for 1080p display (display titles 72–96px, subheadings 32–38px, body 24–28px, mono readouts 12–16px).
   - **HUD Elements:** Use corner brackets (ticks), reticle crosshairs, dimension lines with centered pixel callouts, and bottom telemetry bars.
   - **Layout Discipline:** Containers must fill 80–90% of the safe area. Keep generous padding and distinct modular cards. Follow **Layout & Contrast Rules** below.
   - **Code Scenes (Standard & Deep dive):**
     - Show a real diff hunk or code excerpt only when narration is about that code.
     - Maximum 10 lines per snippet and about 4 snippets per video in Standard. Trim the hunk to relevant lines and highlight changed lines.
     - The narration explains why the change was made and what it does. It never reads code aloud, but names the file and function.
     - Overview mode shows no code at all.

4. **Layout & Contrast Rules** (all themes; the check in step 6 enforces them):
   - Build every scene with `stage(content, lockup)` from `kit/kit.ts`. It gives a `.vw-lockup` (top-left), a `.vw-safe` content box and a `.vw-captions` pill (`data-cap`). Put all content inside `.vw-safe`; never position content with `position: absolute` and pixel `left`/`top` outside it. Safe area: 96px left/right, 152px top (below the lockup), 176px bottom (above captions); tokens `--safe-left`, `--safe-top`, `--safe-right`, `--safe-bottom`.
   - Lay out with flow, not coordinates: `stack`, `row`, `grid(cols, ...)`, `card`, `pill`, `code`, `image` from `kit/kit.ts` (classes `.vw-stack`, `.vw-row`, `.vw-grid`, `.vw-card`, `.vw-pill`, `.vw-code`, `.vw-frame`). They never overlap. If content does not fit, cut content or split the scene; do not shrink text below 20px or let it overflow.
   - Text size (MetaMask and MetaMask Developer): give every text element a type role class from `kit/kit.css`: `.vw-display-xl/lg/md`, `.vw-heading-lg/md/sm`, `.vw-body-lg/md/sm/xs` (plus `-medium`/`-bold`). With `kit/tailwind.css` the same roles are `text-display-md`, `text-heading-sm`, `text-body-md`, …, and colours and surfaces are classes (`text-alternative`, `bg-section`) instead of variables. They are the design system's roles scaled 1.75x for 1080p (see the theme's STYLE.md). Never write `font-size` in pixels in a segment; if text does not fit, step down one role or cut words.
   - Images go through `image(src, alt)` (`.vw-frame`, `object-fit: contain`). Never give an image a fixed size larger than its box. To fit a screenshot beside a card, give the row the leftover height (`.vw-row.vw-fill`, or Tailwind `flex min-h-0 flex-1`) and the image panel `h-full min-h-0`, instead of fixed-height grid children.
   - Colors: text uses only `--text`, `--text-muted`, `--text-dim`, `--accent` or theme palette tokens (`--mm-*`, `--dev-*`, `--cyan`, …); surfaces use only `--surface-0/1/2`. In the MetaMask themes these alias the design system's dark-theme tokens (`--color-text-default`, `--color-background-section`, …), which you may also use, except `--color-text-muted`: it fails contrast on every dark surface. Text on an accent fill uses `--text-on-accent` (black). No raw hex/rgb in segments, and never set text to a dark color: every surface is dark.
   - Each theme paints its own canvas decoration (glow, dot grid, blueprint grid, corner ticks) behind every `stage()`; the check never sees it, so do not build it in segments. Layering on purpose (a badge over an avatar, an arrow over a card) needs `data-vw-allow-overlap` on the overlapping element. `data-vw-decor` is a rare escape hatch for a one-off decorative element inside the content tree. Do not use either to silence a real collision.

5. **Segment Authoring & Render-Safety Rules:**
   - Define segments with `defineSegment({ id, advances, voiceover, mount, play, unmount })`.
   - Use WAAPI (`element.animate(...)`) with `fill: "forwards"` and `cubic-bezier(0.2, 0.8, 0.2, 1)`.
   - **Never use `iterations: Infinity`** in WAAPI animations; looping animations freeze under headless rendering. Use finite durations matching the beat window. Do not use CSS `animation` or `transition`; only WAAPI and `ctx.hold` run on the renderer's virtual clock.
   - Segment code is **erasable TypeScript** (no `enum`, `namespace`, parameter properties or decorators; `import type` for types) and imports only relative files or `"videowright"` (`defineSegment`, `defineConfig`, `fade`, `cut`). There is no bundler and no node_modules. Query the DOM through the element given to `mount(el)`, never `document`: during a transition the previous segment is still in the page.
   - Synchronize visual reveals with audio beats using `await ctx.waitForNext()`.
   - Ensure clean unmount: clear host references and cancel active timers.

6. **Render & Verification:**
   - Validate first, in about a second: `node scripts/render/vw.ts render <timeline.ts> --dry-run`. It loads every segment and checks the timeline and advances.
   - **Mandatory layout check** before any preview or final render: `node scripts/render/vw.ts render <timeline.ts> --check --frames check-frames/`. In about a second per scene it stops at each beat, waits until images have decoded and animations have finished (up to 5s), and reports overlapping text/images/cards, anything off canvas or outside the safe area, anything covering the lockup or captions, clipped or spilling text, and text below WCAG AA contrast (4.5:1, or 3:1 at 24px+ / 18.66px bold). It exits 1 on any finding; every line is a bug (`<segment> beat N/M: <problem>: <element> "<text>" <numbers>`). Fix them all and re-run until it prints `layout check: OK`. After the summary it may print `note <segment> beat N/M: …` lines (cards nearly touching, text too close to its card's edge, a large empty area, content bunched on one side, lines too long to read). Notes never fail the check; fix them when the fix is cheap. `--frames` saves one PNG per beat, named `NN-<segment>-beat<N>[-FAIL].png`, with failing boxes outlined in red; look at them. Preview and final renders run the same check and exit 1 after writing the file.
   - Check layout cheaply: `node scripts/render/vw.ts render <timeline.ts> --fps 6 --output preview.mp4`, extract frames, fix, then render the final: `node scripts/render/vw.ts render <timeline.ts> --output <output-path>.mp4`. Throughput is about 15 frames per second at 1080p.
   - Treat every `Warning:` line as a bug to fix, especially `a scheduled beat had no pending waitForNext()`. A segment that throws fails the render immediately with its message.
   - Extract a frame from each scene with `ffmpeg`.
   - Verify that:
     - `--check` printed `layout check: OK`, and the `--frames` PNGs show no overlap or clipping it cannot see (text drawn into images or canvases, text over screenshots).
     - Every fact on screen or in the narration matches the ledger; run `scripts/verify_facts.py <scenes.json> --facts <facts.json> --also segments/*/index.ts` and fix every error. For code, every file or function named matches the diff.
     - Nothing says more than its fact's kind allows (a hypothesis is not shown as a result).
     - Total duration is within the target range for the chosen depth.
   - Fix layout clipping or discrepancies and re-render once.

---

If the user corrects a spoken form, or `--repair` clears a token, add that term to [references/lexicon.json](references/lexicon.json) after approval. Do not add a row the normalizer already speaks.

## Cost

Read script reports only. Do not paste audio, a full transcript, or an uncut token list into context. Re-run flagged chunks, not the whole video. Do not call a subagent or another model for pronunciation.

## After the render

**Local (default).** Give the mp4 path. Stop. Do not upload, attach, or paste the video, the source text, or the ledger anywhere the user has not named.

**Pull request description.** Read the current body. Put the video in an existing Screenshots/Recordings section, or add a Video section. Do not delete existing text.

Add a one-line note under the video that says the walkthrough is AI-generated. A synthetic voice can feel uncanny when the reviewer does not expect it. Use this note, or a close variant:

> 🤖 AI-generated walkthrough — script, animation, and voice made by an agent

The description plays a video only from a GitHub-hosted attachment URL — a bare `https://github.com/user-attachments/assets/<id>` on its own line renders as an inline player; links hosted anywhere else do not. Attach it with the GitHub CLI in one step: reference the file in the body where the player should appear, alone in its own paragraph with the AI-generated note directly under it:

```markdown
![Walkthrough](./video.mp4)
```

Then upload from the directory that contains the video:

```bash
REAL_GH="$(which -a gh | tail -n 1)"   # last match = the real gh; harness shims prepend themselves to PATH
env -i HOME="$HOME" PATH="$PATH" TERM=xterm "$REAL_GH" pr edit <pr-num> -R <owner>/<repo> --body-file body.md --attach ./video.mp4
```

`gh` rewrites the reference to the bare asset URL, which renders as a player. The sanitized environment plus the resolved real-gh path bypass agent-harness `gh` shims (e.g. Kandev's), which inject a fine-grained PAT the upload endpoint rejects. Prerequisites: a browser-flow `gh auth login` (`gho_` token with `repo` scope) in secure storage, and a video under 10 MB.

A description edit is not a commit. If any step needs a commit, stop and ask the user to sign it. Do not push an unsigned commit. Do not pass `--no-gpg-sign`.
