# Critique Examples

## Weak Critique

Bad:

```text
Verdict: pass-with-gaps. Add better waits and more artifacts.
```

Why it fails: it does not identify the missing proof target, the exact node, or the next edit.

## Strong Critique

Good:

```text
Verdict: fail. PT-2 is not proven because the recipe can pass after tapping Continue without verifying the error cleared.

Coverage Gaps
- must-fix: PT-2 needs an assertion after `enter-valid`. Add `assert_json` or a manifest-declared state assertion for `send.amount.validState` expecting `{ "errorVisible": false, "continueEnabled": true }`.

Graph / Flow Issues
- should-fix: `capture` runs immediately after `enter-valid`. Insert `ui.wait_for` or the state assertion before the screenshot.

Evidence Mismatches
- must-fix: `screenshots/after.png` is labeled as the settled valid screen, but no trace node proves the screen settled before capture. Link it to the new assertion node.

Suggested Fixes
1. Add the missing valid-state assertion.
2. Move screenshot capture after the assertion.
3. Add `index_artifacts` with the screenshot and trace linked to PT-2.
```

## Evidence Verdict Examples

Use `pass` only when the recipe and artifacts prove the claims.

Use `pass-with-gaps` when the core claim is likely proven but a non-blocking gap remains, such as missing manifest metadata or an unimportant artifact label.

Use `fail` when a claim is unproven, the graph can pass unconditionally, the runner did not execute the relevant path, or the evidence contradicts the recipe.
