---
title: MetaMask
slug: metamask
picker_description: 'MetaMask brand: OLED black, white Inter type, fox-orange accent, rounded stepped-grey surfaces.'
font_sources:
  - embedded in style.css (Inter variable 400-700, JetBrains Mono 400/500, latin subset)
assets:
  - fox.svg (official refreshed fox, unmodified)
  - fox.ts (same artwork as animatable facets: foxMark, assembleFox)
  - wordmark-white.svg + wordmark.ts (official stacked wordmark, single path)
mood: [confident, modern, friendly, product-led, crisp]
good_for:
  - MetaMask engineering walkthroughs and PR explainers
  - Internal demos that should look like the product
  - Flow and data-shape diagrams with a few coloured categories
bad_for:
  - Dense blueprint-style annotation (use motion-engineering)
  - Dense maths / LaTeX equations
tags: [metamask, brand, dark-mode, rounded, product]
references: [MetaMask mobile dark theme, MetaMask 2026 rebrand, design-system token docs]
---

# MetaMask — STYLE.md

## Identity

The video should look like it was screen-recorded from the MetaMask app after the 2026 refresh: pure black canvas, white Inter type, stepped-grey rounded cards, and one hit of fox orange per scene. Confident and friendly rather than technical-blueprint.

Load [brand.md](brand.md) for the exact token sources. `style.css` (tokens plus embedded fonts) is the only thing a timeline imports.

## Layout principles

- **Black canvas, soft glow.** `style.css` paints the canvas and a soft orange glow (top-right) behind every `stage()`, under all content; the check ignores it. Do not build glows or grids in segments. `data-vw-decor` is a rare escape hatch for a one-off decorative element that must sit in the content tree.
- **Cards fill 80–90% of the frame.** Rounded (`--radius-md`, 20px), `--color-surface` fill, 1px `--color-border`. Nested rows use `--color-surface-2`.
- **Generous padding.** 32–40px inside cards, 24–32px gaps.
- **Safe area.** All content sits in `.vw-safe` (from `kit/kit.ts` `stage()`): 96px from the sides, 152px from the top (clear of the lockup), 176px from the bottom (clear of captions). Lay out with `.vw-stack` / `.vw-row` / `.vw-grid`, never absolute pixel positions. `scripts/render/vw.ts --check` fails on anything outside it or overlapping.
- **Left-aligned headlines.** Size text with a type role (below), never a pixel size.
- **Chips and pills** (`--radius-pill`) for labels, file names, and statuses. A scene header is a small orange pill + a big title, not a CAD label.
- **Bottom strip** is a captions pill (`.vw-captions`), centered, `--captions-bg`, body-md-medium, 20px radius.
- **Brand lockup, top-left of every scene:** the fox (48px, `foxMark(48)`) followed by the official stacked wordmark (44px tall, white, `wordmark(44)` from `wordmark.ts`).
- **Hero fox** (~220px, top-right, beside the title) on the opening and closing scenes only. It assembles with `assembleFox` and sits in front of the theme's glow.

## Type roles

The roles are the design system's large-screen (`l`) scale from `@metamask/design-tokens` 13.0.0, multiplied by **1.75** for the 1920x1080 canvas (a 16px body becomes 28px; the smallest role, body-xs, is 21px). Weights, line heights and letter spacing come from the tokens unchanged. Give an element a class (`.vw-heading-lg`) or use the variables (`var(--typography-heading-lg-font-size)` and `-line-height`, `-font-weight`, `-letter-spacing`). Never write a pixel font size in a segment.

| Role | Size / line | Weight | Use |
|---|---|---|---|
| `display-xl`, `display-lg` | 105 / 131 | 500 | One hero line on a title or closing scene. |
| `display-md` | 84 / 98 | 500 | Scene titles (`.vw-title` uses it). |
| `heading-lg` | 56 / 70 | 600 | A second-level headline, big stat labels. |
| `heading-md` | 42 / 56 | 600 | Section headings inside a scene. |
| `heading-sm` | 35 / 42 | 600 | Card titles (`.vw-card-title`). |
| `body-lg` | 35 / 42 | 500 | Subtitles and lead sentences (`.vw-subtitle`). |
| `body-md` (+`-medium`, `-bold`) | 28 / 42 | 400 / 500 / 600 | Card and body copy (`.vw-body`), captions (medium). |
| `body-sm` (+`-medium`, `-bold`) | 24.5 / 38.5 | 400 / 500 / 600 | Code, chips, secondary notes. |
| `body-xs` (+`-medium`) | 21 / 35, +0.025em | 400 / 500 | Labels, file-path headers, footnotes. Nothing smaller. |

Display roles are 500 in the design system, not 700; keep them that way. Mono (JetBrains Mono) uses the same roles: add `font-family: var(--font-mono)`.

## Colour application

- Orange (`--mm-orange`) = the one thing to look at: the key word, the active node, the changed value.
- Blue (`--mm-blue`) = flow, structure, links, arrows.
- Lime (`--mm-lime`) = success, "after", added lines. Red (`--mm-red`) = removed lines or errors, sparingly.
- Purple (`--mm-purple`) = a third category only when blue and orange are taken.
- Colours come from the design system's **dark theme** (`--color-*`, generated into `style.css`). The theme names map onto them:

  | Theme variable | Design-system token | Value |
  |---|---|---|
  | `--surface-0` / `--color-bg` | `background-default` | `#000000` |
  | `--surface-1` / `--color-surface` | `background-section` | `#18181b` |
  | `--surface-2` / `--color-surface-2` | `background-subsection` | `#222226` |
  | `--text` / `--color-fg` | `text-default` | `#ffffff` |
  | `--text-muted` / `--color-muted` | `text-alternative` | `#a3a4a7` |
  | `--text-dim` / `--color-muted-dim` | brand `grey400` | `#949596` |
  | `--line` / `--color-border` | `border-muted` | `#e2e2ff26` |
  | `--accent`, `--mm-orange` | `accent01-normal` | `#fa4b00` |
  | `--mm-blue` | `primary-default` | `#8b99ff` |
  | `--mm-lime` | `success-default` | `#b9f302` |
  | `--mm-yellow` | `warning-default` | `#f0b034` |
  | `--mm-red` | `error-default` | `#ff7584` |

- Every text variable above passes WCAG AA (4.5:1) on every surface; `scripts/tests/test_design_tokens.py` enforces it. Orange text under 24px on `--surface-2` is borderline (4.58:1); prefer `--mm-orange-soft` there.
- **Do not use `--color-text-muted` (`#66676a`) for text.** In the dark theme it is 2.8–3.7:1 on every surface, so it fails AA. It is for disabled icons in the app. Use `--text-dim` instead.
- Orange-filled buttons/pills take **black** text (`--text-on-accent`), never white (3.46:1 fails).
- Never set dark text (`#000`, `#111`, `--color-bg`, grey900…) on any surface, and no raw hex/rgb in segments.

## Type rules

- **Inter** everywhere, at the weights the type roles set (display 500, headings 600, body 400/500). No extra tracking.
- **JetBrains Mono** for code, paths, identifiers. Code blocks sit in `--color-surface-2`, 20px radius, `body-sm` or larger.
- No serifs, no second display face. Do not bundle MMSans / MMPoly.

## Motion principles

- **Slide up and settle.** Elements enter with `translateY(24px) → 0` plus `opacity 0 → 1`, 420–560ms, `--ease-out`. Cards may also scale `0.97 → 1`.
- **Stagger 60ms** between siblings.
- **Fox assemble (signature move):** the fox's facets fly in from just outside the head, nose first and ears last (45ms stagger, 640ms each), lock together, then the eyes blink once. Use it on the first scene and the last scene, never mid-video. Import from `styles/metamask/fox.ts`. One hero fox per scene, never looped.
- **Arrows and connectors draw** (scaleX / stroke) in 400–600ms, blue.
- **Highlights**: the active card gets an orange 1px border and a soft orange glow, animated in 300ms, not looping.
- **Scene transition:** fade-through-black, 300ms. No wipes.
- **Forbidden:** bounce, spring overshoot, spinning, `iterations: Infinity` (freezes under headless render), hard-edged blueprint ticks, centred crosshairs.

## Pacing

Calm and confident. 4–6s per beat. Let each card land before the next. Reveal on `ctx.waitForNext()` beats from the narration.

## Per-scene recipes

| Scene | Recipe |
|---|---|
| **Title** | Hero fox assembling top-right; small orange pill (`PR WALKTHROUGH`, `OVERVIEW`); title in `display-md` (or `display-lg`); subtitle in `body-lg`, muted. |
| **Flow** | 3–4 rounded cards in a row, blue arrows drawn between them; the card being narrated turns orange-bordered. |
| **Before / After** | Two cards side by side. Left in muted grey with strikethrough values; right with lime border and the new values. |
| **Swatches / tokens** | Rows of colour chips (rounded 12px) with mono hex labels; old → new with an arrow. |
| **Stat** | One `display-xl` number in white, orange unit or delta pill beside it, caption in muted. |
| **Code** | Rounded surface-2 block with a mono file-path header (blue-soft), max 10 lines. Changed lines get a 5px left bar and 10% tint: lime for `+`, red for `-`; context lines in muted. Use `-` then `+` pairs. Pair it with a short chip or card for the "why". |
| **CTA / Summary** | One sentence, large, with one word in orange; three recap chips below; hero fox assembling top-right. |

## Tailwind classes (opt-in)

An alternative to writing CSS variables in `style=""`: style scene elements with class names from a static sheet. Plain-CSS projects are unaffected.

- **Enable:** in `timeline.ts` import `./kit/tailwind.css` after `./kit/kit.css` (the file ships in `kit/`, already copied). Nothing to install or compile.
- **Check:** with the sheet imported, `--check` also reports every class that is not in `tailwind.css` or `kit.css`, with a fix: `unknown-class: text-gray-500 -> use text-alternative`. Fix it as you would an overlap.
- **Still use** `stage(content, lockup())` from `kit/kit.ts` for the lockup, safe area and captions. Inside `.vw-safe`, build with classes instead of `row`/`card`. Mixing them with `.vw-*` classes is fine.
- **Animation timing is unchanged:** WAAPI in `play()`, `--ease-out`, the same durations and staggers. There are no `animate-*`, `transition-*` or `duration-*` classes.
- **No** variants (`hover:`, `md:`, `dark:`), arbitrary values (`text-[13px]`, `bg-[#111]`), generic palette (`text-gray-500`, `bg-white`, `text-black`), Tailwind text sizes (`text-4xl`), `leading-*`, `tracking-*`, shadows or `space-x-*`. The sheet is dark only.

| Need | Classes |
|---|---|
| Type role (sets size, line height, weight, tracking) | `text-display-xl/lg/md`, `text-heading-lg/md/sm`, `text-body-lg`, `text-body-md/sm` (+`-medium`, `-bold`), `text-body-xs` (+`-medium`) |
| Font | `font-sans` (Inter), `font-mono` (code, paths, ids), `font-regular/medium/bold` |
| Text colour | `text-default` (white), `text-alternative` (muted grey), `text-primary-default` (blue), `text-success-default` (lime), `text-warning-default`, `text-error-default`, `text-accent01-normal` (orange), `text-accent0N-light/normal` |
| Text on a filled pill | `bg-primary-default text-primary-inverse` (likewise `success`, `warning`, `error`, `info`); orange: `bg-accent01-normal text-primary-inverse` |
| Surface | `bg-default` (canvas), `bg-section` (card), `bg-subsection` (nested card, code), `bg-muted`; tinted: `bg-success-muted`, `bg-error-muted`, `bg-primary-muted`, `bg-warning-muted` |
| Border | `border` (1px, `border-muted` by default), `border-2`, `border-l-4`; colour `border-muted`, `border-default`, `border-accent01-normal`, `border-success-default`, `border-error-default` |
| Layout | `flex`, `flex-row`, `flex-col`, `flex-1`, `flex-wrap`, `grid`, `grid-cols-1..12`, `col-span-N`, `items-*`, `justify-*`, `self-*`, `place-items-center` |
| Spacing (4px scale: `p-8` = 32px) | `gap-*`, `gap-x-*`, `gap-y-*`, `p-*`, `px-*`, `py-*`, `pt/pr/pb/pl-*`, `m-*`, `mx-*`, `my-*`, `mt/mr/mb/ml-*` (margins also `-auto`). Steps: `0`, `px`, `0.5`, `1`, `1.5`, `2`, `2.5`, `3`, `3.5`, `4`–`12`, `14`, `16`, `20`, `24`, `28`, `32`, `36`, `40`, `44`, `48`, `52`, `56`, `60`, `64`, `72`, `80`, `96`. No negative margins. |
| Position | `relative`, `absolute`, `static`, `inset-0`, `top-0`, `right-0`, `bottom-0`, `left-0`, `z-0/10/20/30`. No other inset steps: place with flex/grid, not offsets. |
| Size | `w-*`, `h-*`, `size-*` on the spacing steps above, plus `1/2`, `1/3`, `2/3`, `1/4`, `2/4`, `3/4`, `1/5`–`4/5`, `1/6`, `5/6`, `full`, `auto`, `fit`, `min`, `max`; `min-w-0`, `min-w-full`, `min-h-0`, `min-h-full`, `max-w-full`, `max-w-none`, `max-h-full`, `max-h-none`; `aspect-square/video/auto`; `object-contain/cover/fill/none`; `grow`, `shrink-0`, `basis-0`, `basis-full` |
| Shape | `rounded-sm/md/lg` (theme radii: 12/20/28px here, 8/14/20px in Developer), `rounded-full` (pills), `overflow-hidden` |
| Text layout | `text-left/center/right`, `whitespace-nowrap`, `whitespace-pre` (code lines), `uppercase`, `line-through`, `tabular-nums` |

Recipe: a card is `flex flex-col gap-4 rounded-md border border-muted bg-section p-8`; a pill is `self-start rounded-full bg-subsection px-4 py-1 font-mono text-body-sm text-default`; a diff line is `whitespace-pre px-4 border-l-4 border-success-default bg-success-muted text-default`. Text colours in the sheet all pass AA on `bg-default`, `bg-section` and `bg-subsection`; `text-muted` and `text-*-muted` are not in it, by design.

**Screenshots that fit.** Let the row take the leftover height and the image panel fill it, instead of giving grid children a fixed height: the row is `flex min-h-0 flex-1 flex-row gap-8`, the image panel `vw-frame h-full min-h-0 flex-1` (or `image()` from `kit.ts`), the side card a normal `flex flex-col` card. `vw-frame` scales the image with `object-fit: contain`, so it never pushes the title or captions out of the safe area. Plain CSS: `.vw-row.vw-fill` with `image()`.

## Pitfalls

- Don't mix in Motion Engineering elements (grid, corner ticks, crosshairs, amber).
- Don't use more than one orange element per beat; if everything is orange nothing is.
- Don't draw or redraw the fox. Use `fox.ts` / `fox.svg` as published, unrecoloured, and keep it away from busy content.
- Don't use pure-white card fills; the canvas is black and cards are stepped greys.
