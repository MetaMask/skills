"""Which of the skill's non-negotiables does the machinery actually enforce?

The proposal was "every principle with a hook class becomes one line pointing at the
class". That assumes the class exists and fires. A check named after a principle is not
the same as a check that catches a violation of it, so this asks the only question that
decides what is safe to delete: construct a body that violates the principle and nothing
else, and see whether the gate blocks it.

A principle that survives here is enforced, and its prose can shrink to a pointer.
A principle that does not is the ONLY place the rule exists, and deleting it deletes
the rule.
"""
import json
import os
import subprocess
import sys
import tempfile

GATE = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
    os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "hooks", "pr-evidence-gate.py")
D = os.path.dirname(os.path.abspath(__file__))
PATH = os.path.join(tempfile.mkdtemp(), "case.md")
PUBLISH = " ".join(["gh", "pr", "comment", "45249", "--repo",
                    "MetaMask/metamask-extension", "--body-file"])

# A body that PASSES everything, so each case below differs by one violation only.
CLEAN = open(os.path.join(D, "principle-coverage-baseline.md")).read()
_A = "Measured 3 recomputations before and 1 after"
_L = "Not covered by this run: one fixture, one perturbed key; a selector unmoved here can still"

# Each: (principle, a body violating ONLY that principle)
CASES = {
    "1 artifact the reader can check": CLEAN.replace("![capture](https://github.com/user-attachments/assets/1f2e3d4c-aaaa-bbbb-cccc-ddddeeeeffff) — `evidence-artifacts/recompute.json`", "I ran it locally and it looked right."),
    "2 `proven` requires execution": CLEAN.replace(_A,
        "Reading the diff shows the selector now takes narrowed inputs, so this is proven."),
    "3 no 'what would close it'": CLEAN.replace(_L,
        "What would close this: add a test covering the pinned-accounts path, then re-run."),
    "4 write to the reviewer": CLEAN.replace(_A,
        "I first tried the profiler, then switched to reselect's counter, then re-ran twice."),
    "5 drop test-quality-only findings": CLEAN.replace(_L,
        "Finding: the test asserts the count but does not assert the returned value shape."),
    "6 route privacy/security findings": CLEAN.replace(_A,
        "Also noted: the vault key is logged in cleartext at startup, filed nowhere."),
    "7 measure the PR range": CLEAN.replace("Environment: head `7bfc16c`, node `v20.11.0`.",
        "Environment: head `7bfc16c`, node `v20.11.0`. Range measured: `7bfc16c^..7bfc16c`."),
    "8 the label on a number": CLEAN.replace(_A,
        "Renders: 3 before, 1 after. (The probe counted distinct values, not renders.)"),
    "9 instrument reports what it did": CLEAN.replace(_A,
        "Mutation applied: `--replace '/^[\\s\\S]{1,4096}$/u'` (as requested; not read back)."),
}


def run(body):
    with open(PATH, "w") as fh:
        fh.write(body)
    env = dict(os.environ)
    env["EVIDENCE_GATE_ARTIFACT_HOSTS"] = "majorlift-artifacts-share.s3.us-west-1.amazonaws.com"
    payload = {"tool_name": "Bash", "tool_input": {"command": f"{PUBLISH} {PATH}"}}
    r = subprocess.run([sys.executable, GATE], input=json.dumps(payload),
                       capture_output=True, text=True, env=env)
    classes = sorted({ln.split("[")[1].split("]")[0]
                      for ln in (r.stderr or "").splitlines() if "• [" in ln})
    return r.returncode, classes


rc, cls = run(CLEAN)
print(f"CONTROL (clean body, must be ALLOWED): {'ALLOWED' if rc == 0 else f'BLOCKED {cls}'}")
if rc != 0:
    print("  -> control does not pass; every result below is uninterpretable.")
print()

enforced, unenforced = [], []
for name, body in CASES.items():
    rc, cls = run(body)
    if rc != 0:
        enforced.append((name, cls))
        print(f"  ENFORCED    {name:<36} caught by {cls}")
    else:
        unenforced.append(name)
        print(f"  unenforced  {name:<36} publishes cleanly")

print(f"\n{len(enforced)}/{len(CASES)} enforced, {len(unenforced)}/{len(CASES)} exist only as prose")
