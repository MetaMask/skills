# Publishing the evidence bundle to a PR body

How to take run artifacts + complementary evidence and write a clean, idempotent, reviewer-familiar section into the PR body — **matching AEP's own format** so a re-run replaces in place instead of stacking duplicates.

Canonical source for the format: `~/Code/metamask/metamask-autonomous-engineering-platform/packages/github/src/pr-body-builder.ts` (`upsertVisualValidationSection`). Mirror it.

> **Publishing is public and outward-facing. Always render the section and get explicit confirmation before writing the PR body. Use `publishEvidence: false` on the run; this manual flow is the only publish path.**

## Step 1 — Re-host images (artifacts are localhost)

Control-plane artifact URLs (`localhost:3000/v1/runs/:id/artifacts/:name`) won't render on GitHub. Re-host each artifact and link the hosted URL.

**Host: the S3 bucket `majorlift-artifacts-share`, prefix `public/`.**

```
s3://majorlift-artifacts-share/public/metamask/pr-<n>/<run-id>/<artifact-name>
https://majorlift-artifacts-share.s3.us-west-1.amazonaws.com/public/metamask/pr-<n>/<run-id>/<artifact-name>
```

Anonymous `GetObject` is allowed under `public/*`; bucket listing is not, so the prefix is not
browsable — link individual files, and don't promise readers an index.

**Do NOT re-host to `MajorLift/metamask-extension-skills`.** It is a **personal private** repo:
every raw link to it returns 404 for every reader but its owner. That was the previous target
here, and this file simultaneously said links to it were unreachable — guidance that instructed
you to publish dead links. Verified live in a published artifact.

The test is **audience-reachability, not public-vs-private.** A `MetaMask/*` org repo is private
but readable by colleagues, so an internal-audience link to one is fine. A `MajorLift/*` personal
repo is unreachable by colleagues *and* by the public, so it fails for every audience.

- Path convention: `pr-<n>/<run-id>/<artifact-name>` keeps runs from colliding.
- **Verify unauthenticated before shipping**: `curl -s -o /dev/null -w "%{http_code}"` on each
  published URL. A 200 from your own browser proves nothing — you are logged in.

```bash
RUN_ID=<id>; PR=<n>; CP=localhost:3000
BUCKET=majorlift-artifacts-share
BASE="https://$BUCKET.s3.us-west-1.amazonaws.com"
for name in <artifactName1> <artifactName2>; do
  curl -fsS "$CP/v1/runs/$RUN_ID/artifacts/$name" -o "/tmp/$name"
  key="public/metamask/pr-$PR/$RUN_ID/$name"
  aws s3 cp "/tmp/$name" "s3://$BUCKET/$key" --only-show-errors
  url="$BASE/$key"
  # the link is not shippable until it resolves WITHOUT credentials
  code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 25 "$url")
  [ "$code" = "200" ] || { echo "UNREACHABLE ($code): $url" >&2; exit 1; }
  echo "$url"
done
```

No base64 round-trip and no 1 MB contents-API ceiling — the ceiling silently truncated a
1.7 MB gif to **0 bytes** on one run, and the loop reported success. Size-check anything you
transfer by another route.

Files >1MB exceed `ARG_MAX` for an inline `-f content=` — use `gh api -F content=@<base64-file>` (write the base64 to a file first). For GIFs, re-host the same way.

## Step 2 — Build the section (canonical header + mirror AEP)

**Canonical header (2026-07-21):** every validation-run output — a PR comment *or* the PR-body section — leads with the exact literal `## 🧪 Validation Run`. Never reworded, never demoted to `###`: the constant string is the identifiability anchor, exactly like Copilot's fixed `## Pull request overview`. `hooks/pr-evidence-gate.py` blocks any `gh` write whose body has a validation/verification/evidence heading or AEP marker without this literal.

Marker pairs, used so re-runs replace idempotently:

- Whole section: `<!-- VALIDATION_RUN_START -->` … `<!-- VALIDATION_RUN_END -->`
- AEP status block (nested): `<!-- AEP_VISUAL_VALIDATION_START -->` … `<!-- AEP_VISUAL_VALIDATION_END -->`
- Screenshots block: `<!-- AEP_SCREENSHOTS_START -->` … `<!-- AEP_SCREENSHOTS_END -->`

AEP prefers to inject screenshots into the PR template's `### **After**` section (replacing the `<!-- [screenshots/recordings] -->` placeholder), falling back to a `### Screenshots` block inside the status block when there's no After scaffold. Do the same.

Section shape:

```markdown
<!-- VALIDATION_RUN_START -->
## 🧪 Validation Run

**Verdict:** ✅ proven — **Claim:** <one-line falsifiable behavior under test>
head `<sha>` · <YYYY-MM-DD> · lanes: <e2e A/B, unit falsifier, Sentry, AEP visual, …>

<claim → artifact table or per-lane bullets, every claim binding its artifact>

<!-- AEP_VISUAL_VALIDATION_START -->
### AEP Visual Validation

**✅ Passed**

<one-line headline — the agent's verdict, first sentence>

<details><summary>Validation details</summary>

<full narrative + per-check "**<name>** — <status>. <summary>" lines>

</details>

Run `<run-id>` · [LangSmith trace](<url>)
<!-- AEP_VISUAL_VALIDATION_END -->
<!-- VALIDATION_RUN_END -->
```

Verdict icon: `✅` Passed, `❌` Failed, `ℹ️` otherwise. For perf, retitle the nested block `### AEP Perf Validation` and put `M/M assertions proven` in the headline. When AEP's *service* publishes its own `## AEP Visual Validation` block (publishEvidence:true, not the local flow), leave that block's heading alone — the demotion to `###` applies to hand-assembled bundles under the canonical header.

Screenshots block (injected into `### After`, or appended under `### Screenshots`):

```markdown
<!-- AEP_SCREENSHOTS_START -->
<details open><summary><artifact-name></summary>

<img alt="<artifact-name>" src="<raw.githubusercontent URL>" width="420" />

[Open full-size image](<raw URL>)

</details>
<!-- AEP_SCREENSHOTS_END -->
```

`<details open>` so reviewers see evidence without a click. One block per image; before/after read top-to-bottom.

## Step 3 — Choose the surface by ownership, then publish

**Publish surface depends on my relationship to the PR** (see exogram
`evidence-publish-surface-by-ownership`). Determine it FIRST:

```bash
PR=<n>; REPO=MetaMask/metamask-extension
SURFACE=$(gh pr view "$PR" --repo "$REPO" --json author,commits --jq '
  if .author.login=="MajorLift" then "body"
  elif ([.commits[] | select(.authors[].login=="MajorLift")
         | select([.authors[].login] | map(select(.!="MajorLift" and .!="Copilot" and (test("claude|anthropic")|not))) | length == 0)] | length) > 0
  then "comment" else "skip" end')
```

- `body` — I authored the PR → upsert into the PR body (below). Validation is
  part of my own claim.
- `comment` — not author but I have a solo commit (no HUMAN co-author) → post a
  `gh pr comment` under the canonical `## 🧪 Validation Run` header. Never edit
  someone else's PR body.
- `skip` — my only commits are co-authored with a human (review/pairing) OR I
  have no commits → **do not publish**. Not my PR to validate outward.

### Publish the script that produced a computed artifact, next to the artifact

Any number you derived rather than read off a tool — a hash comparison, a count, a delta, a
statistic — is only as trustworthy as the reader's ability to re-run it. **A prose `method:` field
is not provenance.** Reviewers discount computed figures from an agent by default, and correctly:
on extension#45024 a reviewer dismissed a policy-identity check as *"we know LLMs are really bad at
this"*. It had in fact been a deterministic `sha256`, not the model counting — but the script lived
in a throwaway `python3 - <<'PY'` heredoc, so nothing could show that. The objection was
unanswerable because of how the evidence was packaged, not because of what it said.

So:

- **Write the script to a file, never an inline heredoc**, when its output will be published. The
  heredoc survives only in the transcript, which the reader does not have.
- **Publish the script alongside its output**, and cross-reference: the artifact carries
  `provenance: { script, script_sha256, command }`; the comment links the artifact.
- **Include the exact command** with its inputs (PR ref, head SHA), so the run is reproducible
  rather than merely described.
- **Verify the round trip** — fetch the published script anonymously, hash it, and confirm it
  matches `script_sha256`. A link that 200s is not proof the bytes are the ones you ran.
- Prefer a script that takes arguments and is re-runnable against a different PR. A one-off that
  only works on your paths is weak provenance even when published.

State plainly what the script does and does not do (`no model judgement; not a count of '+'
characters`) — that sentence is what actually retires the reviewer's prior.

### Before any of the commands below: show the body in the response

Every publish path here uses `--body-file`, so the **permission prompt displays a file path, not
the content**. The user is then asked to authorize publishing something under their name that they
cannot read, and the correct answer to that is no.

**Paste the complete body inline in the response first, then run the command.** For an edit, also
say what changed relative to what is currently live. "I've drafted it, shall I post?" with a path
instead of the text is incomplete — pointing at `/tmp/validation-run.md` is the same failure as the
prompt itself. If the body is too long to show comfortably, that is a signal to trim it.
(Three consecutive denials on extension#45024, 2026-07-30, all from this.)

### body surface (I own the PR)
```bash
gh pr view "$PR" --json body -q .body > /tmp/pr-body.md
# Replace the region between VALIDATION_RUN markers if present, else append.
# (Legacy bodies: replace the AEP_VISUAL_VALIDATION region and re-wrap it under
# the canonical "## 🧪 Validation Run" header + VALIDATION_RUN markers.)
# Replace the region between AEP_SCREENSHOTS markers if present, else inject after
# the "### **After**" heading (replacing the [screenshots/recordings] placeholder).
# ...edit /tmp/pr-body.md...
gh pr edit "$PR" --body-file /tmp/pr-body.md
```

### comment surface (I contributed but don't own)
```bash
# Same canonical "## 🧪 Validation Run" header + bundle; post as a comment.
gh pr comment "$PR" --repo "$REPO" --body-file /tmp/validation-run.md
```

Idempotency: because both regions are marker-delimited, re-running replaces them — never append a second copy. If the markers are absent (human-authored body), append the status block at the end and inject screenshots into `### After` when that heading exists.

## Step 4 — Privacy scrub (before writing)

Failure summaries and agent narratives leak the dev environment. Before publishing, strip:

- Absolute local paths (`/Users/<username>/…`, `~/Code/…`) → describe the surface, not the path.
- The username anywhere it appears.
- `localhost` / `127.0.0.1` URLs → must be re-hosted public URLs only.
- Internal hostnames, JFrog/registry URLs, tokens.

A failed run still must not publish raw — either omit the section or publish a scrubbed `❌ Failed` summary, with confirmation.

## Recordings → GIF (for flows/motion a still can't prove)

The platform can't collect video (artifact regex = png/jpg/log/txt). Capture out-of-band:

1. In a **built** PR checkout (mm's fixture infra is required — a bare `dist/chrome` won't boot), write a preload `/tmp/patch-record.mjs` that monkey-patches `playwright-core`'s `chromium.launchPersistentContext` to inject `recordVideo: { dir }`. Resolve the module via `createRequire(<worktree>/package.json)` so the patch hits the same module instance the `mm` daemon uses.
2. `NODE_OPTIONS="--import /tmp/patch-record.mjs" npx mm launch --state onboarding` → drive the flow (or let it sit) → `npx mm stop` flushes the `.webm`. States: `default | onboarding | custom`.
3. Convert with `ffmpeg` two-pass palette (better color than single-pass):
   ```bash
   ffmpeg -i in.webm -vf "fps=12,scale=480:-1:flags=lanczos,palettegen" -y /tmp/pal.png
   ffmpeg -i in.webm -i /tmp/pal.png -lavfi "fps=12,scale=480:-1:flags=lanczos[x];[x][1:v]paletteuse" -y out.gif
   ```
   webm/mp4 don't render inline in GitHub PR bodies; GIF does.
4. Re-host the GIF (Step 1) and embed like a screenshot.

**Same-window app + DevTools (lane C8):** when the claim needs UI + console/network in one frame (e.g. "no toast *while* the log shows the silent path ran"), skip `recordVideo` entirely — it can't see DevTools. Use the OS-level region capture in [evidence-catalog C8](evidence-catalog.md): dock tab DevTools with `--auto-open-devtools-for-tabs`, tile the SW inspector window via `osascript`/CDP `Browser.setWindowBounds`, then `screencapture -v -V <sec> -R<x,y,w,h>` → same ffmpeg GIF recipe. Publish the GIF + one full-res PNG + the CDP console text dump (GIF downscale makes log lines illegible on their own).

## Re-validation runs: delta-first presentation, every verdict re-earned (2026-07-21)

The common loop — a run refutes a claim, the author pushes a fix, `/evidence` re-runs at the new head — gets a **delta report**, not a second full bundle:

- **Presentation is delta-only.** Full exhibits only for lanes whose outcome changed (flipped verdict / new lane / new residual). Unchanged lanes collapse to a `Prior run | This run` ledger, each row with a fresh run-log link from the new head plus one link to the prior run's comment for the full exhibits — and say so ("unchanged rows re-run at `<head>`; full exhibits in the prior run").
- **Evidence is never delta.** Evidence is head-pinned: re-run every automated lane at the new head and re-earn every verdict with a fresh artifact. "Unchanged" is a conclusion from the re-run, never a carried-over assumption (the stale-baseline trap at report level). Re-running is cheap — the falsifier harness already exists from the first run.
- Same canonical header + markers; the meta line names the fix commit and links the prior run. Comments: one per run, chronological, each linking its predecessor. PR-body section: replaced in place via markers.
- New head → **new hosted artifact directory keyed to the fix commit** (`pr-<n>/fix-<sha>/`), commit-pinned raw URLs; never overwrite a prior run's published files.
- Residuals the fix intentionally leaves get their own row/section — don't round a fixed-with-residual claim up to fully proven.

Source of truth: `exogram-core/memory/evidence-revalidation-delta-reports.md`.

## Lead with a lane-status ledger (no silent absence)

The published section must **enumerate every lane the claim type calls for and give each an explicit status** — never render only the lanes you happen to have and let the rest be silently absent. An unmarked gap is indistinguishable from a lane that ran and came back empty; the reader (and you, on the next pass) can't tell "no evidence because none needed" from "no evidence because not done." This is the vacuous-pass trap at the publish layer — carry the run's `✅/❌/⚠️` verdict into the PR body, don't leave it in the internal report-back.

Open the evidence section with a ledger:

```markdown
| Lane | Status | Evidence |
|---|---|---|
| B3 falsifying test | ✅ proven | 32/32 head, 3/32 reverted |
| E1 Sentry before/after | ✅ proven | [discover](…) — distinct trace ids |
| A1 visual | ➖ N/A | background change, no UI surface |
| C6 CDP netlog | ⏳ not-captured | — |
```

Status vocabulary: `✅ proven` (link) · `⚠️ inconclusive` (name what's missing) · `➖ N/A` (reason) · `⏳ not-captured`. Mirror the `N/A — <reason>` convention the `### Screenshots` block already uses for no-UI PRs. Never upgrade a `⏳`/`⚠️` to a pass by omission.

**Sibling-PR parity:** when a set of PRs shares a claim shape (same program, same author, "root the X traces"), their ledgers must match lane-for-lane. A lane present on one and absent on another is either added or explicitly marked `➖ N/A — <reason>` — a bar that silently drifts between siblings is a finding (postmortem 2026-07-17, #43929/#43930).

## Non-visual & multi-lane evidence

Screenshots are only one lane. Most claims (perf, telemetry, state, build) publish as **text/links/tables**, not images. Put them in the same verdict-first section so a reviewer sees one coherent bundle, not scattered comments.

Per-lane rendering:

- **Sentry / Tempo (E1/E2):** a markdown link to the discover/trace query with the before/after window baked in, plus the headline numbers inline (`errors: 1.2% → 0.0% over 24h post-release`). Link, not screenshot — reviewers re-run it.
- **Benchmark / web-vitals / TBT (C2/C3/C5):** a small before/after table (metric · base · head · Δ · threshold). State it's a **paired A/B** if the stored baseline was bypassed.
- **Migration (F1):** the `changedKeys` set + a before/after state-shape snippet, and a link to the migration-test run.
- **Bundle / chunk / LavaMoat / manifest (D1–D4):** the diff or size delta in a fenced block; for policy/manifest, the actual `git diff` (or "diff empty — no new capability").
- **Trace artifacts (B2):** link the Playwright trace-viewer report / attach the `trace.zip`; don't paste raw.

Multi-claim PRs get one sub-block per claim under the status section, each with its own ✅/❌/⚠️ verdict — mirror the Claim Cards. Keep the visual block (markers + `### After` injection) for the image lanes; render the rest as text beneath it.

### One comment per evidence *kind*, not one comment per PR (2026-07-30)

Sub-blocks are for several claims **of the same kind**. When a PR draws two different
kinds — say an executed Validation Run *and* a read-level capability triage — they get
**separate comments**, each with its own header, its own marker pair, and its own format.

| | Validation Run | LavaMoat policy diligence |
|---|---|---|
| header | `## 🧪 Validation Run` | `## 🔒 LavaMoat Grants — <pkg> <old> → <new>` |
| markers | `VALIDATION_RUN_*` | `LAVAMOAT_DILIGENCE_*` |
| opens on | `**Verdict:** ✅/⚠️/❌` | the finding; **no verdict at all** |
| body | lane ledger, artifacts per lane | deny candidates, enumeration folded |
| audience | whoever owns the PR's claim | whoever owns the policy |

Merging them forces one frame onto both. A read-level triage has no run to verdict, so it
would land as `⚠️ inconclusive` on a header promising a run; and a `⏳ not-captured` lane
needs a tracker it does not have. The marker pairs also collide — a re-run replacing the
`VALIDATION_RUN` region would silently eat the diligence output sharing it.

**So: choose the format from the evidence kind, not from this document's default.** The
canonical `## 🧪 Validation Run` header applies when a run produced artifacts. An engine
skill that defines its own output contract (`lavamoat-policy`) publishes in that
contract. `hooks/pr-evidence-gate.py` enforces the canonical literal only on bodies that
*claim* validation/evidence framing — a diligence comment that renders no verdict does not
trip it, which is the tell that the two are different artifacts rather than one with a
different skin.

**Per-scenario presentation (2026-07-21):** the same applies one level down — when the evidence spans multiple test scenarios (flag-on vs flag-off, control vs treatment in an A/B falsifier, numbered manual-testing steps), give each scenario its **own sub-section**: a heading naming the scenario in observation terms, one line on what it tests plus its verdict, and that scenario's artifacts co-located under it. Never bunch all scenarios' artifacts into one large evidence dump — the reviewer verifies "under condition X, artifact shows Y" one condition at a time, and a merged block destroys that mapping even when every artifact is real. For long artifact sets use a `<details>` block *per scenario*, not a merge. (Preference: exogram-core `memory/evidence-present-scenarios-separately.md`; instance #44610.)

## Artifact contract (ADR-0058 alignment)

To stay interoperable with the recipe-based verification system (MetaMask/decisions#173), shape the bundle like its reviewer-visible contract where practical: a `summary.json` (claim → verdict → evidence refs), a `trace.json` (the run/assertion log), and an artifact manifest (names + media types), with screenshots/video as the confidence layer. Publishing then becomes "render `summary.json` into the PR section." This keeps evidence's output and a recipe's output the same shape — see [lane-assertions.md](lane-assertions.md). Don't hand-roll a divergent format.

## Checklist before you publish

- [ ] Section opens with a **lane-status ledger** — every claim-required lane marked `✅`/`⚠️`/`➖ N/A`/`⏳`; no lane silently absent (and sibling PRs' ledgers match lane-for-lane)
- [ ] `evidenceBundle.artifactRefs` non-empty with expected media (not a vacuous pass)
- [ ] Each lane passed the [trustworthiness gate](evidence-trustworthiness.md) (shows the claimed surface, signal &gt; noise, could-have-failed)
- [ ] Multi-scenario evidence rendered **per scenario** (own heading + verdict + co-located artifacts), not bunched into one block
- [ ] **Automated-process voice, no first person** — published validation output never says "I ran/captured/verified"; attribute to the process ("Automated validation ran…", "the harness captured…") so readers know the evidence is machine-generated, not a manual account under the author's name
- [ ] Every image/GIF re-hosted to `majorlift-artifacts-share/public/…`; no localhost/local-path URLs in the body
- [ ] **Every published link curl'd unauthenticated and returning 200** — never a personal private repo
- [ ] Work cited by **PR link** rather than tracking-ticket id, unless the ticket's own content (an RCA, a spec) is the referent
- [ ] Narrative scrubbed of username/paths/internal hosts
- [ ] Marker pairs present so the upsert is idempotent
- [ ] Section rendered and **confirmed by the user**
