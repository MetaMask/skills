---
name: fix-perps-bug
description: Debug and fix perps feature bugs
maturity: stable
---

# Fix Perps Bug

## When To Use

- Bug report involving perps UI (positions, orders, trading, margins, TP/SL)
- Formatting/decimal display issues in perps screens
- Stream data not updating (prices, positions, orders)
- Order submission or validation failures

## Workflow

1. **Identify affected screen.** Map the bug to a screen using the mobile-extension-map. Check if the screen exists on both repos or is missing on one.

2. **Locate the code.**
   - Find the component/hook for that screen (see file paths in repo-specific section)
   - Check if the bug involves a duplicated utility (see shared-package-analysis) -- if so, check both codebases

3. **Check formatting.** If the bug involves number display:
   - Read installed `knowledge/formatting-rules.md`
   - Fix must follow the sig-dig rules, not hardcode decimals

4. **Check stream hooks.** If the bug involves stale/missing data:
   - Verify the channel subscription is active and data transforms are correct

5. **Fix the bug.**
   - Make the minimal change
   - If fixing a duplicated utility, check the other repo's equivalent
   - If the fix belongs in `@metamask/perps-controller`, fix there (not in UI layer)

6. **Write tests.**
   - Unit test the fix
   - If formatting: test against the sig-dig table in formatting-rules

7. **Validate.**
   - Run repo-specific validation (see below)
   - Confirm the fix doesn't break the other repo's equivalent screen

## Common Pitfalls

| Pitfall | Rule |
|---|---|
| Adding `.toFixed(2)` on extension | Use `formatCurrencyWithMinThreshold` as interim, target `formatPerpsFiat` behavior |
| Fixing a util that exists in both repos | Check the other repo's copy too |
| Ignoring missing screens on extension | Flag as known gap, don't create stub implementations |
| Hardcoding testIDs | Use the repo's convention (PascalCase selectors on mobile, kebab-case on extension) |
