---
name: visual-regression-collect
description: >-
  Captures Storybook before/after screenshots for MetaMask Design System
  (MMDS) UI work, expands to every visual dependent (not only files in the
  diff), crops tightly, and attaches PNGs as GitHub media with gh --attach.
  Use when creating or updating an MMDS UI PR, when asked for screenshots,
  before/after, visual assets, or Storybook captures, or when existing PR
  screenshots need refreshing. Never post Cursor artifact URLs.
maturity: stable
---

# Visual regression collect (MMDS)

Capture Storybook before/after PNGs for visual UI work and attach them to the
PR with GitHub CLI. Chromatic stays the React pixel merge gate; this skill is
GitHub-visible evidence for React and React Native web.

## When to use

Run when any of these is true:

1. A PR's diff includes visual UI (platform packages, design tokens, or the
   Storybook apps).
2. Someone asks for screenshots, before/after, visual assets, or Storybook
   captures, even before a PR exists.
3. UI changed after screenshots were posted, or someone asks for a refresh.

Skip changelog-only, types-only, tests-only, docs-only, CI, and non-visual
refactors.

## Critical rules

- Never put a Cursor-hosted image URL in a PR, issue, or comment.
- Never push a screenshots branch or `raw.githubusercontent.com` image links.
- Attach local PNGs with `gh --attach` (check `gh pr create --help` lists
  `--attach`; upgrade `gh` if not). GitHub rewrites the local Markdown paths
  to `user-attachments` URLs.
- Capture every surface the change visually affects, on both platforms, not
  only files in the diff.
- Never commit sandbox or showcase stories, or PNGs.
- Crop tightly to the changed UI.
- React Native captures use web Storybook, not simulators.

## Workflow

1. Expand to dependents.
2. Decide how many shots.
3. Capture before and after with headless Playwright.
4. Crop, attach, and write the Screenshots section.

### 1. Expand to dependents

Primitive and token changes leak into other components. A radius change on a
base button primitive also changes `Button` and every other control built on
it.

1. Start from changed implementation files (component `.tsx`, token CSS or
   TS). Ignore tests, README, constants-only, and Code Connect files unless
   they are the only signal.
2. For each changed component, find importers in the same package and in the
   sibling platform package:

   ```bash
   rg -l "from ['\"].*/<ComponentName>" <react package src> <react-native package src>
   ```

3. Include both platforms when the primitive exists on both.
4. Include stories that show opt-outs, so reviewers see what did not change.
5. For token or global style changes, pick representative stories per token
   category (color, radius, typography). Do not capture the whole Storybook.

### 2. How many shots

Use stories that already exist by default. Do not write a sandbox story for
one component or a few dependents; opening a few iframes is cheaper.

| Situation | Capture |
| --- | --- |
| 1–5 affected components with stories | Those stories (Default, plus the prop that changed). Light and dark for color or token changes |
| 6+ dependents, a shared primitive or token where the blast radius is the point, or a request for one composed shot | One temporary showcase grid per platform (identical on before and after), plus 1–2 detail shots of the primitive and any opt-out |
| An affected component has no story | A temporary sandbox for it only, or after-only if the component is new on the PR |

A showcase story is uncommitted, so it is not on the hosted Storybook. For a
showcase:

1. Save the current branch name.
2. Check out the PR base, write the sandbox story, start local Storybook, and
   capture before.
3. Check out the PR head, write the same sandbox story (same layout and
   props), and capture after.
4. Delete the sandbox, restore the branch, and confirm a clean tree.

Detail shots of stories that exist on `main` can still use hosted `main` for
before.

### 3. Capture sources

Do not wait for PR Storybook CI.

| Pass | Source | When |
| --- | --- | --- |
| Before, existing stories | Hosted `main` iframe | The story id is in the hosted `index.json` |
| Before, sandbox or showcase | Local Storybook on the base branch with the sandbox written | Showcases, or a story not on hosted `main` |
| After | The PR preview, only if the PR already has a Storybook links comment and the story is in that build | Existing stories, when the preview is live |
| After, default or sandbox | Local Storybook on the PR branch | Default; required for showcases |

Resolve story ids from `index.json` (hosted or local). Do not invent them.
Pass control values as iframe args (`&args=<prop>:<value>`) when the shot must
show one.

A story that exists only on the PR branch (not a sandbox) is after-only,
labeled "new story". Never post a broken before image. If the before/after
pixel diff is empty, leave that story out of the PR body.

#### Headless Playwright

Capture the iframe only (no Storybook chrome) with headless Chromium from the
repository root so `playwright` resolves. Do not drive the user's visible
browser or an IDE browser panel; use one only when the user asks to see the
page, or to debug a failed headless capture, and say so first.

```bash
node --input-type=module << 'EOF'
import { chromium } from 'playwright';

const url = 'http://localhost:6006/iframe.html?id=<storyId>&viewMode=story';
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 900, height: 1400 } });
await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
await page.waitForSelector('#storybook-root > *', { timeout: 20000 });
await page.evaluate(() => document.fonts.ready);
const box = await page.locator('#storybook-root > :first-child').boundingBox();
if (!box) throw new Error('Story root has no box');
const pad = 12;
await page.screenshot({
  path: '/tmp/vr/after/<name>.png',
  clip: {
    x: Math.max(0, box.x - pad),
    y: Math.max(0, box.y - pad),
    width: box.width + pad * 2,
    height: box.height + pad * 2,
  },
});
await browser.close();
EOF
```

Keep `headless: true`. If Chromium is missing, install it with
`yarn playwright install chromium` from a Storybook app workspace and retry.

### 4. Tight crop

Reviewers must see a 2px radius or 1px border change.

- Capture the component bounding box plus 8–16px, not the viewport or the
  whole canvas. Use `locator.screenshot()` when the node hugs its content;
  otherwise clip the page screenshot to the content box.
- Keep before and after the same size and origin.
- For a showcase, crop to the grid plus the same padding.
- Never include Storybook sidebar, toolbar, or a large empty canvas, and do
  not scale down until the change disappears.
- If a story's layout is a large padded canvas, wrap the instance in a
  hug-contents container in a sandbox, or clip at capture. Delete the sandbox.

### Attach with GitHub CLI

`--attach` needs a user OAuth token or PAT with repo write access. A GitHub
App token (`ghs_`) cannot upload. If attach fails, keep the PNGs and say so;
still no Cursor URLs.

Reference local paths in the Markdown, and pass the same files to `--attach`:

```markdown
## **Screenshots/Recordings**

Every component this change visually affects. Existing stories: before =
hosted `main`, after = this branch. Showcases: before and after = local
Storybook on base and on this branch, same temporary story.

![Before React consumers](/tmp/vr/before/web-consumers.png)
![After React consumers](/tmp/vr/after/web-consumers.png)
```

```bash
gh pr create --title "..." --body-file pr-body.md --draft \
  --attach '/tmp/vr/before/web-consumers.png#Before React consumers' \
  --attach '/tmp/vr/after/web-consumers.png#After React consumers'

gh pr edit --body-file pr-body.md --attach '...'   # refresh an existing PR
```

Prefer the PR body's Screenshots section. Use `gh pr comment --attach` only
for a refresh comment, and never `gh api` review comments for images. On a
refresh, recapture, rewrite the section, and re-attach so the body shows only
the latest set.

If no PR exists yet, capture into `/tmp/vr/` and attach when the PR is
created; recapture first if the UI changed.

## Checklist

- [ ] Dependents on both platforms identified, including opt-outs.
- [ ] Existing stories used unless a showcase is warranted.
- [ ] Showcase before captured locally on the base branch, never from hosted
      `main`.
- [ ] Tight, matching crops.
- [ ] PNGs attached with `gh --attach`; no Cursor URLs; sandboxes deleted;
      clean tree.
