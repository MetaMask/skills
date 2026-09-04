#!/usr/bin/env python3
"""Does the CI rule separate restating a status from citing a measurement?

RESTATEMENT asserts something the Checks tab already shows. It is the reviewer's own data
read back to them, carries no information, and should be caught.

CITATION points at a specific run and job whose log or artifact IS the capture — a figure
the Checks tab does not show. `evidence-run.yml` exists to produce exactly this ("move the
measurement to CI, where the run URL is the capture"), so catching it means the package
forbids its own flagship output.

The rule originally matched a bare `actions/runs/N`, which conflated the two: five of its
six branches described a CLAIM about CI and one described a URL. This is the control that
keeps them apart.

It imports CI_RESTATEMENT from the hook rather than restating it, because a control that
tests its own copy of a pattern passes forever while the real one drifts.
"""
import importlib.util
import os
import sys

HOOK = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                    "hooks", "pr-evidence-gate.py")
spec = importlib.util.spec_from_file_location("_gate", HOOK)
gate = importlib.util.module_from_spec(spec)
try:
    spec.loader.exec_module(gate)
except SystemExit:
    pass
CI = gate.CI_RESTATEMENT

RESTATEMENT = {
    "green at head + run link": "Tests are green at head `7bfc16c` — https://github.com/o/r/actions/runs/123.",
    "checks tab": "See the Checks tab; everything passes.",
    "all jobs green": "All jobs green on this branch.",
    "counts": "Unit tests: 412 passing / 0 failing.",
    "CI is green": "CI is green, so the change is safe.",
}

CITATION = {
    "run+job is the capture":
        "The probe ran in CI: https://github.com/o/r/actions/runs/123/job/456 printed "
        "`identical=3 unrelated=1 inputChanged=6`.",
    "run link + artifact":
        "Measured in CI — https://github.com/o/r/actions/runs/123 — artifact "
        "`evidence-artifacts/recompute.json` attached there.",
    "two-arm result from a run":
        "Base arm failed and head arm passed in https://github.com/o/r/actions/runs/123/job/456; "
        "both logs are on that job.",
}

ok = True
print(f"  {'':<26}{'':<28}verdict")
for kind, cases, want_caught in (("restatement (want CAUGHT)", RESTATEMENT, True),
                                 ("citation (want ALLOWED)", CITATION, False)):
    for label, text in cases.items():
        caught = bool(CI.search(text))
        good = caught == want_caught
        ok &= good
        print(f"  {'ok ' if good else 'FAIL'} {kind:<26}{label:<28}"
              f"{'CAUGHT' if caught else 'allowed'}")

print("\nall arms behave" if ok else "\nCONTROL FAILED")
sys.exit(0 if ok else 1)
