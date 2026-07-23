#!/usr/bin/env python3
"""
Emit-time evidence gate (PreToolUse:Bash).

Blocks outward-facing `gh pr|issue edit|create|comment` whose body contains, in
a validation-scoped paragraph, either a VERDICT/measurement claim with no
co-located inspectable ARTIFACT, or a DEFERRAL ("remains pending" / "not yet
verified" / TODO) with no co-located TRACKER. Rationale: an unbacked
"confirmed / verified / proven / observed / ingested / ✅" launders an
unverified assertion as fact under the author's name, and an untracked
"remains pending" decays to never (see
references/evidence-trustworthiness.md for the disciplines this enforces).

The reference docs are the checklist; THIS is the trigger that runs it.

Contract: reads PreToolUse JSON on stdin. Exit 0 = allow. Exit 2 = block
(stderr shown to the model). Fails OPEN on anything it cannot parse, so it
never bricks unrelated Bash commands.
"""
import json
import re
import sys


def _out_allow():
    sys.exit(0)


def _block(msg):
    sys.stderr.write(msg)
    sys.exit(2)


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        _out_allow()

    if payload.get("tool_name") != "Bash":
        _out_allow()

    cmd = (payload.get("tool_input") or {}).get("command", "")
    # Outward-facing gh write surfaces: PR + issue, edit/create/comment. The
    # surface set is wider than `gh pr edit|create` because the same unbacked
    # verdict launders identically through a PR comment or an issue body.
    if not re.search(r"\bgh\s+(?:pr|issue)\s+(?:edit|create|comment)\b", cmd):
        _out_allow()
    if "--body" not in cmd:  # covers --body and --body-file
        _out_allow()

    body = _extract_body(cmd)
    if not body:
        _out_allow()  # can't read it -> don't block; nothing to scan

    violations = _scan(body)
    if not violations:
        _out_allow()

    lines = [
        "EVIDENCE GATE (PreToolUse) — blocked outward-facing "
        "`gh pr|issue edit|create|comment`.",
        "",
        "A VERDICT claim needs a co-located inspectable ARTIFACT (https:// permalink,",
        "actions/runs/<id>, /blob/, or a `file.test.ts` ref in the same block). A",
        "runtime OBSERVATION claim ('rendered', 'snapshot shows', 'byte-identical')",
        "needs an OBSERVATION artifact — screenshot/recording/log/JSON/permalink; a",
        "code /blob/ link witnesses code, not runtime behavior. A DEFERRAL ('remains",
        "pending' / 'not yet verified' / TODO) needs a co-located TRACKER (#issue,",
        "an issues/pull URL, 'triage', 'tracked in'). An unbacked verdict launders",
        "an unverified claim as fact; an untracked deferral decays to never. All",
        "are net-negative under your name. If the evidence exists on disk, BIND it:",
        "every collected artifact the claim rests on gets referenced or re-hosted.",
        "",
    ]
    for v in violations[:12]:
        kind = v.get("kind", "verdict")
        need = {
            "verdict": "ARTIFACT",
            "observation": "OBSERVATION ARTIFACT (screenshot/recording/log/"
                           "JSON/permalink — a code /blob/ link witnesses code,"
                           " not runtime behavior)",
            "deferral": "TRACKER",
        }.get(kind, "ARTIFACT")
        lines.append(f'  • [{kind}] "{v["token"]}" (needs {need}) in: {v["snippet"]}')
    lines += [
        "",
        "Fix each: attach the artifact/tracker in the SAME block, or downgrade the",
        "lane (⚠️ inconclusive / remove the claim). Then re-run.",
    ]
    _block("\n".join(lines) + "\n")


def _extract_body(cmd):
    # 1) --body-file <path>
    m = re.search(r"--body-file[=\s]+(?:'([^']+)'|\"([^\"]+)\"|(\S+))", cmd)
    if m:
        path = m.group(1) or m.group(2) or m.group(3)
        try:
            with open(path, "r", encoding="utf-8") as fh:
                return fh.read()
        except Exception:
            return ""
    # 2) --body "$(cat <<'EOF' ... EOF)" heredoc
    m = re.search(r"<<-?'?EOF'?\s*\n(.*?)\n\s*EOF", cmd, re.DOTALL)
    if m:
        return m.group(1)
    # 3) --body '...' / --body "..."
    m = re.search(r"--body[=\s]+'((?:[^']|'\\'')*)'", cmd, re.DOTALL)
    if m:
        return m.group(1)
    m = re.search(r'--body[=\s]+"(.*?)"', cmd, re.DOTALL)
    if m:
        return m.group(1)
    return ""


# Measurement/verdict tokens that assert a result was achieved/observed.
VERDICT = re.compile(
    r"(?i)(?:\bcapture[ds]?\s+confirm\w*|\bconfirm(?:s|ed)\b|\bverif(?:y|ies|ied)\b"
    r"|\bproven\b|\bobserved\b|\bingested\b|\bdemonstrat(?:e|es|ed)\b"
    r"|does not drop\b|✅)"
)
# Inspectable artifact references: a URL/run-id/blob, or a genuine TEST/SPEC
# file reference (optional `:line`). Deliberately NOT arbitrary `*.js`/`*.ts`
# code tokens — a backticked transaction name like `/service-worker.js` is not
# evidence and must not mask a bare claim.
ARTIFACT = re.compile(
    r"(?i)(?:https?://\S+|actions/runs/\d+|/blob/|\bjob/\d+"
    r"|`?[\w./-]*\.(?:test|spec)\.[tj]sx?(?::\d+)?`?)"
)
# Runtime-OBSERVATION claims: assert something was *seen happening* in a live
# run (a render, a repro, a state snapshot). A code permalink (/blob/) witnesses
# code structure, NOT runtime behavior — so these get their own artifact class
# and are NOT excused by ARTIFACT. Added 2026-07-21 (PR #44610 postmortem: a
# validation comment shipped "rendered the toast byte-identically" + "snapshot
# shows X and Y simultaneously" with a full evidence bundle collected on disk
# and zero artifacts referenced; the old VERDICT vocabulary missed it).
OBSERVATION = re.compile(
    r"(?i)(?:\brendered\b|byte-identical(?:ly)?|\bsnapshot\s+shows?\b"
    r"|\bscreenshots?\s+show\w*|\breproduc(?:ed|es)\b"
    r"|\bstill\s+(?:shown|shows|fails|failing|raises)\b"
    r"|\bin\s+a\s+(?:real|live)\s+browser\b|\blive\s+test\s+build\b"
    r"|\bin\s+two\s+independent\s+runs\b|\bworks\s+as\s+described\b)"
)
# What witnesses a runtime observation: an image/recording embed or host, a
# log/HAR/JSON dump, a Sentry permalink, or a CI-run artifact. A named capture
# file (e.g. `flag-on-failure-state.json`) counts at draft time — the
# functional-links rule still requires re-hosting before the reader sees it.
OBS_ARTIFACT = re.compile(
    r"(?i)(?:!\[|user-images\.githubusercontent|user-attachments"
    r"|gist\.github|sentry\.io/\S+|actions/runs/\d+"
    r"|\b[\w./-]+\.(?:png|jpe?g|gif|mp4|webm|har|log|json)\b)"
)
# Deferral/disclosure tokens: an honest "not done yet" —
# "disclosure is not discharge". Excused only by a co-located TRACKER — an
# artifact does not discharge a pending item; a tracked follow-up does. Kept
# tight (no bare "to do") and scope-gated so normal prose does not trip it.
DEFERRAL = re.compile(
    r"(?i)(?:remains?\s+pending\b|still\s+pending\b|not\s+yet\s+verif\w*"
    r"|not\s+yet\s+captur\w*|\bTODO\b"
    r"|(?:capture|end-to-end|live|e2e)[^.\n]{0,40}\bpending\b)"
)
TRACKER = re.compile(
    r"(?i)(?:#\d+|https?://\S*(?:issues|pull)/\d+|\btriage\b|follow-?up|tracked\s+in)"
)


# A paragraph is policed only if it is a validation CLAIM, not design prose:
#   - it sits under an evidence/verification/validation heading, OR
#   - it carries a status verdict emoji (✅ ❌ ⚠️), OR
#   - it is about a capture/falsifier/ingestion.
# This keeps casual "verified"/"confirms" in Reviewer-notes / Description out.
SCOPE_HEADING = re.compile(r"(?i)\b(validation|verification|evidence)\b")
SCOPE_PARA = re.compile(
    r"(?i)(?:[✅❌⚠️]|\bcaptur|\bfalsif|\bingest"
    # distinctive observation markers — generic "rendered" alone does NOT put
    # a paragraph in scope, so refactor prose stays unpoliced
    r"|\bsnapshot\b|\bscreenshot|byte-identical|\bworks\s+as\s+described\b"
    r"|\bin\s+two\s+independent\s+runs\b|\bin\s+a\s+(?:real|live)\s+browser\b)"
)


def _scan(body):
    # Strip bot-generated summary block — not our claim.
    body = re.sub(r"<!--\s*CURSOR_SUMMARY\s*-->.*?<!--\s*/CURSOR_SUMMARY\s*-->",
                  "", body, flags=re.DOTALL)
    violations = []
    section = ""
    for block in re.split(r"(?m)^(?=\s*#{1,6}\s)", body):
        hm = re.match(r"\s*#{1,6}\s*(.+)", block)
        if hm:
            section = hm.group(1)
        section_in_scope = bool(SCOPE_HEADING.search(section))
        for para in re.split(r"\n\s*\n", block):
            scan_lines = []
            for ln in para.splitlines():
                s = ln.strip()
                if re.match(r"-\s*\[[ xX]\]", s):   # checklist item
                    continue
                if s.startswith(">"):                # blockquote (bot NOTE)
                    continue
                if s.startswith("_Status key"):      # legend
                    continue
                if s.startswith("#"):                # heading line
                    continue
                scan_lines.append(ln)
            chunk = "\n".join(scan_lines)
            if not chunk.strip():
                continue
            if not (section_in_scope or SCOPE_PARA.search(chunk)):
                continue
            # A markdown table row is its own claim unit — scan each row so an
            # artifact two rows down cannot excuse a bare row.
            units = chunk.splitlines() if chunk.lstrip().startswith("|") else [chunk]
            for unit in units:
                snip = re.sub(r"\s+", " ", unit.strip())[:120]
                # VERDICT claim: excused by a co-located inspectable artifact.
                if not ARTIFACT.search(unit):
                    for m in VERDICT.finditer(unit):
                        if _negated(unit, m.start()):
                            continue  # "not verified" / "unproven" is not a claim
                        violations.append(
                            {"token": m.group(0), "snippet": snip, "kind": "verdict"})
                        break
                # OBSERVATION claim: needs an observation-class artifact
                # (screenshot/recording/log/JSON/Sentry or run permalink).
                # A /blob/ code permalink does NOT excuse it.
                if not OBS_ARTIFACT.search(unit):
                    for m in OBSERVATION.finditer(unit):
                        if _negated(unit, m.start()):
                            continue
                        violations.append(
                            {"token": m.group(0), "snippet": snip,
                             "kind": "observation"})
                        break
                # DEFERRAL: excused by a co-located tracker, NOT by an artifact —
                # a link to the thing doesn't discharge "haven't done it yet".
                if not TRACKER.search(unit):
                    dm = DEFERRAL.search(unit)
                    if dm:
                        violations.append(
                            {"token": dm.group(0), "snippet": snip, "kind": "deferral"})
    return violations


def _negated(text, pos):
    """A verdict token preceded by a negator is a hedge, not a claim."""
    pre = text[max(0, pos - 16):pos].lower()
    if re.search(r"\b(not|never|no|isn't|aren't|cannot|can't|without|un|yet)\s*$", pre):
        return True
    # 'unverified' / 'unproven' — negator fused onto the token
    if pre.endswith("un"):
        return True
    return False


if __name__ == "__main__":
    main()
