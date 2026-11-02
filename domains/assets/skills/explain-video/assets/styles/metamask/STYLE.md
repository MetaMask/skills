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

- **Black canvas, soft glow.** `--color-bg` everywhere. Put one large blurred radial glow (`--glow-orange` or `--glow-blue`) behind the hero element, at most one per scene, never full-frame.
- **Cards fill 80–90% of the frame.** Rounded (`--radius-md`, 20px), `--color-surface` fill, 1px `--color-border`. Nested rows use `--color-surface-2`.
- **Generous padding.** 32–40px inside cards, 24–32px gaps. Safe margin `--safe-x` / `--safe-y`.
- **Left-aligned headlines, big.** Title 88–112px / 700 / -0.03em. Subheads 36px. Body 28px. Mono 20px+.
- **Chips and pills** (`--radius-pill`) for labels, file names, and statuses. A scene header is a small orange pill + a big title, not a CAD label.
- **Bottom strip** is a captions pill, centered, `rgba(24,24,27,0.92)`, 30px Inter 500, 20px radius.
- **Brand lockup, top-left of every scene:** the fox (48px, `foxMark(48)`) followed by the official stacked wordmark (44px tall, white, `wordmark(44)` from `wordmark.ts`).
- **Hero fox** (~220px, top-right, beside the title) on the opening and closing scenes only. It assembles with `assembleFox` and sits in front of the orange glow.

## Colour application

- Orange (`--mm-orange`) = the one thing to look at: the key word, the active node, the changed value, the glow.
- Blue (`--mm-blue`) = flow, structure, links, arrows.
- Lime (`--mm-lime`) = success, "after", added lines. Red (`--mm-red`) = removed lines or errors, sparingly.
- Purple (`--mm-purple`) = a third category only when blue and orange are taken.
- Orange on black passes contrast for large text. For small text use `--mm-orange-soft` or white.
- Orange-filled buttons/pills take **black** text, not white.

## Type rules

- **Inter** everywhere. Display 700, body 400/500. Tight tracking on big sizes, normal on body.
- **JetBrains Mono** for code, paths, identifiers. Code blocks sit in `--color-surface-2`, 20px radius, 24px+ font.
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
| **Title** | Orange glow behind the title; hero fox assembling top-right; small orange pill (`PR WALKTHROUGH`, `OVERVIEW`); title in 700; subtitle in muted. |
| **Flow** | 3–4 rounded cards in a row, blue arrows drawn between them; the card being narrated turns orange-bordered. |
| **Before / After** | Two cards side by side. Left in muted grey with strikethrough values; right with lime border and the new values. |
| **Swatches / tokens** | Rows of colour chips (rounded 12px) with mono hex labels; old → new with an arrow. |
| **Stat** | One very large number in white, orange unit or delta pill beside it, caption in muted. |
| **Code** | Rounded surface-2 block with a mono file-path header (blue-soft), max 10 lines. Changed lines get a 5px left bar and 10% tint: lime for `+`, red for `-`; context lines in muted. Use `-` then `+` pairs. Pair it with a short chip or card for the "why". |
| **CTA / Summary** | One sentence, large, with one word in orange; three recap chips below; hero fox assembling top-right. |

## Pitfalls

- Don't mix in Motion Engineering elements (grid, corner ticks, crosshairs, amber).
- Don't use more than one orange element per beat; if everything is orange nothing is.
- Don't draw or redraw the fox. Use `fox.ts` / `fox.svg` as published, unrecoloured, and keep it away from busy content.
- Don't use pure-white card fills; the canvas is black and cards are stepped greys.
