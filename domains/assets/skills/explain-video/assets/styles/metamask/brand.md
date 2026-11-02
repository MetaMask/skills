# MetaMask — Brand

Values come from the `@metamask/design-tokens` package in
[MetaMask/metamask-design-system](https://github.com/MetaMask/metamask-design-system)
(`packages/design-tokens/src/css`), after the September 2026 brand-palette refresh
(PR #1496 "update brand accent colors", PR #1489 "replace Geist with Inter").

## Color

| Token | Value | Source token | Use |
|---|---|---|---|
| `--color-bg` | `#000000` | `background-default` (dark) | Canvas. OLED black, not charcoal. |
| `--color-surface` | `#18181b` | `background-section` | Cards, panels. |
| `--color-surface-2` | `#222226` | `background-subsection` | Nested rows, code blocks. |
| `--color-fg` | `#ffffff` | `text-default` | Headlines and body. |
| `--color-muted` | `#a3a4a7` | `text-alternative` | Secondary copy. |
| `--color-accent` / `--mm-orange` | `#fa4b00` | `orange400` (was `#ff5c16`) | The brand signal: key word, active item, glow. |
| `--mm-blue` | `#8b99ff` | `primary-default` | Interactive/primary things, links, "the flow". |
| `--mm-lime` | `#b9f302` | `success-default` | Success, "after", added lines. |
| `--mm-purple` | `#c66ef5` | `purple300` | Third category colour. |
| `--mm-red` | `#ff7584` | `error-default` | Removed lines, errors. Sparingly. |
| `--mm-yellow` | `#f0b034` | `warning-default` | Warnings. |

Rule of thumb: **one orange moment per scene**, blue for structure, lime for "good".

## Typography

- **Inter** for display and body (design-system default since PR #1489). **Display face is in flux:** the Brand Migration plan (Confluence, 2026-09-03) says display moves to **Oswald** with Inter for body, and open design-system PRs #1499 (Oswald) and #1581 (Grotzec Cond) are still deciding. Revisit `--font-display` when one merges. Display is 700 with
  tight tracking (-0.03em); body is 400/500.
- MetaMask's `MMSans` (accent) and `MMPoly` (hero) are the proprietary brand faces. They are
  not licensed for this repo, so they are *not* embedded. Two open PRs
  (#1499, #1581) are still deciding their replacement — revisit when one merges.
- **JetBrains Mono** for code and identifiers. Inferred: the tokens define no mono face.

## Shape and surface

Rounded everywhere (12 / 20 / 28px, pills for chips). Dark surfaces are stepped greys with a
1px cool-tinted hairline (`#e2e2ff` at 15%), echoing the app's elevation model. No hard
corners, no blueprint grid.

## Logo and fox

`fox.svg` is the **refreshed fox, unmodified**, from
[`metamask-mobile/app/images/fox.svg`](https://github.com/MetaMask/metamask-mobile/blob/main/app/images/fox.svg)
(palette `#FA4B00` / `#FF7A42` / `#CC3D00` / `#571A00` / `#F5F5F5`). `fox.ts` holds the same
paths as facets so they can be animated (`foxMark`, `assembleFox`).

- The fox is a ConsenSys trademark and the source file is © ConsenSys. This is fine for MetaMask-internal
  and team videos; check with brand before using a video externally.
- Do not recolour, reshape, outline, or add effects to the mark itself. Glow goes *behind* it.
- `metamask.io/assets` still lists the pre-refresh palette (orange `#FF5C16`), so it is not
  the source for colours. The design-system tokens are.
- The official Lottie/Rive fox animations in `metamask-mobile/app/animations/` were not used:
  the Lottie files are 5-6 MB each and predate the refresh, and Rive needs a runtime. The
  built-in assemble animation uses the current artwork and renders deterministically.
- `wordmark-white.svg` is the official stacked "Meta / Mask" wordmark, unmodified, from the
  MetaMask logo pack linked on metamask.io/assets (`MetaMask/MetaMask-logo-white.svg`). `wordmark.ts`
  inlines the same path as `wordmark(height, fill)`. It is single-colour and palette-neutral, so
  Use it white on black; do not tint, outline, or animate it.
- **Not the rebrand wordmark.** The pack file is dated 2024. The Brand Migration Implementation Plan
  (Confluence, DS space, 2026-09-03) says the new wordmark is a separate asset the brand team is still
  iterating on (stacked vs horizontal undecided). This is the *current published* wordmark; swap it when
  the new one lands (`wordmark-white.svg` + `wordmark.ts`).
- The same pack's fox is the **pre-refresh** palette (`#FF5C16`, `#E34807`), so the fox comes
  from metamask-mobile instead. Only take the wordmark from the pack.
