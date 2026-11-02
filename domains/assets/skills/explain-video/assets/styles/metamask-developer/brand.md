# MetaMask Developer — Brand

## Assets (all unmodified, from the logo pack linked on metamask.io/assets)

| File | Source in pack | Notes |
|---|---|---|
| `fox-developer.svg` | `MetaMask Developer/MetaMask-icon-fox-developer.svg` | Wireframe fox. Six paths: `#0A0A0A` body, `#FF5C16` orange ears, `#D075FF` purple cheeks (2 paths), `#89B0FF` blue chin, `#BAF24A` lime eyes + nose. |
| `wordmark-developer-white.svg` | `MetaMask Developer/MetaMask-logo-developer-white.svg` | Horizontal lockup "MetaMask Developer", single colour, viewBox 801×162. |

`developer.ts` inlines the same geometry as `foxDeveloperMark`, `developerWordmark`, `revealDeveloperFox`. The pack's `with-margins` fox and black wordmark are not needed for dark video.

## Status and caveats (checked 2026-10-11)

- The pack files are dated 2024-2025, i.e. **before the 2026 refresh**. The developer fox's four colours are exactly the *old* brand values that design-system PR #1496 replaced (`#FF5C16` → `#FA4B00`, `#D075FF` → `#C66EF5`, `#BAF24A` → `#B9F302`, `#89B0FF` → `#73A6FF`). No refreshed Developer fox was found in `metamask-mobile`, `metamask-design-system`, or the MetaMask GitHub org. If brand ships one, replace `fox-developer.svg` and the layers in `developer.ts`.
- The Brand Migration Implementation Plan (Confluence, DS space, 2026-09-03) says the **new wordmark** is a separate asset the brand team is still iterating on (stacked vs horizontal undecided), so the wordmarks bundled here are the *current published* ones, not the rebrand's.
- UI colours in `style.css` are the refreshed design-system values, so the video chrome matches the product even where the fox artwork is older.
- Trademark: the fox and wordmarks are ConsenSys / MetaMask marks. Fine for internal and team videos; check with brand before external use. Do not recolour, outline, restyle or animate the wordmark.
