---
title: MetaMask Developer
slug: metamask-developer
picker_description: 'MetaMask Developer brand: #0A0A0A canvas, wireframe four-colour fox, code-first layouts, mono-forward.'
font_sources:
  - embedded in style.css (Inter variable 400-700, JetBrains Mono 400/500, latin subset)
assets:
  - fox-developer.svg (official wireframe developer fox, unmodified)
  - wordmark-developer-white.svg (official horizontal "MetaMask Developer" lockup, unmodified)
  - developer.ts (foxDeveloperMark, developerWordmark, revealDeveloperFox)
mood: [precise, builder-friendly, technical, crisp, confident]
good_for:
  - SDK, API, docs, tooling and token walkthroughs aimed at engineers
  - Code-heavy PR explainers
  - Anything that would sit on the MetaMask developer docs
bad_for:
  - Consumer-product explainers (use metamask)
  - Blueprint/HUD annotation (use motion-engineering)
tags: [metamask, developer, brand, dark-mode, code, wireframe]
references: [MetaMask Developer logo pack, MetaMask 2026 rebrand, design-system token docs]
---

# MetaMask Developer — STYLE.md

The developer-facing sibling of [the MetaMask style](../metamask/STYLE.md). Read that first: it owns motion principles, card shapes, type rules and the per-scene recipes. This file only lists what is **different** for the Developer variant. Colours and radii come from `style.css` here, and `brand.md` has the asset provenance.

## What changes

| | MetaMask (consumer) | MetaMask Developer |
|---|---|---|
| Canvas | `#000000` + top-right orange glow | `#0A0A0A` + the same glow + a faint 48px dot grid. `style.css` paints both behind every `stage()`; do not build them. Cards use the same design-system surfaces (`#18181b`, `#222226`). |
| Lockup (top-left) | fox + stacked wordmark | **wireframe developer fox** (`foxDeveloperMark(52)`) + **horizontal "MetaMask Developer" wordmark** (`developerWordmark(40)`) |
| Hero fox | solid fox, facets assemble | wireframe fox, **layers wipe on** (`revealDeveloperFox`): body, orange ears, purple cheeks, blue chin, lime eyes + nose, one lime pulse |
| Accent | one orange moment per scene | the same: one orange focus per scene; blue for file paths and flow; lime/red only on diff lines |
| Radius | 20px cards | 14px cards, 8px chips |
| Type emphasis | Inter-led | Mono-led: kickers, labels, numbers, file paths and tags in JetBrains Mono; Inter for titles and prose. Same type roles (`.vw-body-sm`, …); add `font-family: var(--font-mono)`. |
| Content | cards, stats, flows | **Code first**: at least half the scenes carry a real snippet or config; cards are annotations around code |

## Rules

- Code blocks: surface-2, mono at `body-sm` (the `.vw-code` default), max 10 lines, filename header in `--dev-blue-soft`. Diff lines get the lime/red left bar from the MetaMask code recipe.
- Never recolour the developer fox. It is published in the older palette (`#FF5C16`, `#D075FF`, `#BAF24A`, `#89B0FF`); that small mismatch with the refreshed UI tokens is expected.
- Use the developer wordmark only in white on `#0A0A0A`. Do not use the consumer stacked wordmark in the same frame.
- Everything else (safe area, text/surface tokens, forbidden motions, finite WAAPI only, 4-6s pacing, bottom caption pill) is inherited from the MetaMask style. Run `scripts/render/vw.ts --check`; every finding is a bug.

## Tailwind classes (opt-in)

Same as [the MetaMask style](../metamask/STYLE.md#tailwind-classes-opt-in): import `./kit/tailwind.css` after `./kit/kit.css` and use that table. Differences here: `rounded-sm/md/lg` follow this theme (8/14/20px); use `font-mono` for kickers, labels, numbers and paths; code stays on `bg-subsection` with `text-default`, and only diff lines get a tint (`bg-success-muted`, `bg-error-muted`). Animation timing is unchanged.

## Pitfalls

- Don't mix the solid consumer fox and the wireframe developer fox in one video.
- Don't tint code tokens or code backgrounds by category (orange/purple "syntax tones"); one focus colour per scene. No yellow or red except for warning / removed lines.
- Don't fill the frame with prose. If a scene has no code or config, ask whether it should be a card scene in the consumer style instead.
