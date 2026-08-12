# Phase 0 — what each check catches

Generated from the checks in `mms-evidence/scripts/attest-gate.sh`; that script is the
authority. Each entry exists because a run shipped without it.

| # | check | run mode | diligence mode |
|---|---|---|---|
| 1 | marker pair | ✓ | ✓ |
| 2 | canonical header | ✓ | ✓ |
| 3 | verdict line | ✓ | ✓ |
| 4 | citations pinned | ✓ | ✓ |
| 5 | captured artifact | ✓ | ✓ |
| 6 | no prescriptions | ✓ | ✓ |
| 7 | no process narration | ✓ | ✓ |
| 8 | verdict is earned | ✓ | ✓ |
| 9 | verdict matches artifact | ✓ | ✓ |
| 10 | floats something for review | ✓ | ✓ |
| 11 | disclaimer present and early | ✓ | ✓ |
| 12 | destination is open | ✓ | ✓ |
| 13 | figures trace to an exhibit | ✓ | ✓ |

Checks 1–4 differ by mode: in `--diligence` they test that contract's own marker pair, its
header, and that citations are pinned to a tag or SHA rather than a branch head, and the
verdict-line check reports SKIP because a diligence artifact renders none. Checks 8 and 9 SKIP
for the same reason. Everything from 5 down is shared, because those defects are shared.

**Check 5 is the one that matters, and it asks for a medium.** Every earlier version tested a
property of the plaintext — does it carry a marker, does the command contain a placeholder — and
each caught one defect and missed the next, because every property of plaintext is forgeable by
whatever emits the plaintext. Four runs shipped that way. A `/blob/` permalink is a citation and
does not satisfy it: it witnesses a line in a file, never a run.

**Check 12 tests the destination**, which no property of the text reveals. Across one register of
published runs, 22 of 27 comments went to pull requests that had already merged — median 22 days
after the merge, gate-clean every time.
