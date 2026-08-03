#!/usr/bin/env python3
"""
Emit-time evidence gate (PreToolUse:Bash).

Blocks outward-facing `gh pr|issue edit|create|comment` — and `gh api` body
writes, which bypass the porcelain — whose body contains, in a validation-scoped
paragraph, a claim that the trustworthiness gate would reject. Rationale: an
unbacked "confirmed / verified / proven / observed / ingested / ✅" launders an
unverified assertion as fact under the author's name, and an untracked "remains
pending" decays to never.

The trustworthiness gate is the checklist; THIS is the trigger that runs it.
Each class below implements a numbered item of `references/evidence-trustworthiness.md`.

Contract: reads PreToolUse JSON on stdin. Exit 0 = allow. Exit 2 = block
(stderr shown to the model). Fails OPEN on anything it cannot parse, so it
never bricks unrelated Bash commands.
"""
import json
import os
import re
import sys


def _out_allow():
    sys.exit(0)


def _block(msg):
    sys.stderr.write(msg)
    sys.exit(2)


# Outward-facing gh write surfaces. The porcelain set is wider than
# `gh pr edit|create` because the same unbacked verdict launders identically
# through a PR comment or an issue body. `gh api` is included because a PATCH
# to .../comments/<id> is the same publish with a different spelling — a gate
# that cannot see the write it is meant to police is not a gate.
GH_PORCELAIN = re.compile(r"\bgh\s+(?:pr|issue)\s+(?:edit|create|comment)\b")
GH_API = re.compile(r"\bgh\s+api\b")


def main():
    try:
        payload = json.load(sys.stdin)
    except Exception:
        _out_allow()

    if payload.get("tool_name") != "Bash":
        _out_allow()

    cmd = (payload.get("tool_input") or {}).get("command", "")

    is_porcelain = bool(GH_PORCELAIN.search(cmd))
    is_api = bool(GH_API.search(cmd)) and re.search(r"(?:-F|-f|--field|--raw-field)\s+body=|--input\b", cmd)
    if not (is_porcelain or is_api):
        _out_allow()
    if is_porcelain and "--body" not in cmd:  # covers --body and --body-file
        _out_allow()

    body = _extract_body(cmd)
    if not body:
        _out_allow()  # can't read it -> don't block; nothing to scan

    violations = _scan(body)
    if not violations:
        _out_allow()

    lines = [
        "EVIDENCE GATE (PreToolUse) — blocked outward-facing GitHub write.",
        "",
        "Each finding names the trustworthiness-gate item it violates. Fix by",
        "attaching the missing artifact in the SAME block, or by downgrading the",
        "claim (⚠️ inconclusive / remove it). Do not rephrase around the check.",
        "",
    ]
    for v in violations[:12]:
        need = NEEDS.get(v.get("kind", "verdict"), "ARTIFACT")
        lines.append(f'  • [{v["kind"]}] "{v["token"]}"')
        lines.append(f'      needs: {need}')
        lines.append(f'      in:    {v["snippet"]}')
    if len(violations) > 12:
        lines.append(f"  … and {len(violations) - 12} more.")
    lines += [
        "",
        "If the evidence exists on disk, BIND it: every collected artifact the",
        "claim rests on gets referenced or re-hosted before the write.",
    ]
    _block("\n".join(lines) + "\n")


NEEDS = {
    "verdict": "an inspectable ARTIFACT (https:// permalink, /blob/<sha>/, or a *.test.ts ref)",
    "observation": "an OBSERVATION artifact (screenshot/recording/log/JSON/permalink) — "
                   "a /blob/ code link witnesses code, not runtime behavior",
    "deferral": "a co-located TRACKER (#issue, issues/pull URL, 'triage', 'tracked in')",
    "ci-restatement": "removal — a validation surface carries zero CI references. "
                      "The Checks tab already shows them; cite CI only as the revert "
                      "lane's outcome, never as 'green at head'",
    "inflated-verdict": "a downgraded verdict — 'live-proven' co-located with "
                        "'not exercised' is inflated; borrowed evidence never "
                        "upgrades an uncaptured lane",
    "bare-identifier": "a resolving link for the id (permalink or absolute-windowed "
                       "query) OR the re-hosted capture showing it",
    "truncated-identifier": "the FULL identifier, quoted verbatim — an ellipsized id "
                            "cannot be grepped against any artifact, and a co-located "
                            "resolver does not excuse it",
    "mutable-ref": "a commit-pinned permalink (/blob/<sha>/…#Lx-Ly) — a branch ref "
                   "can be rewritten after review",
    "dump-resolver": "a reader-native exhibit — a live link or a visual. A raw "
                     "log/JSON/HAR dump is appendix-only, never the exhibit a claim rests on",
    "link-only-exhibit": "an embedded visual of the linked view ALONGSIDE the permalink — "
                         "link-only defers validation behind click + auth + query rendering",
    "data-only-exhibit": "an in-environment capture (the resolving UI with its query, "
                         "project/environment selectors and time window in-frame) — "
                         "quoted data alone carries no liveness provenance",
    "step-waiver": "a per-step ⏳ + tracker whose blocker is that step's OWN unmet "
                   "precondition — an impossibility argument is not a discharge",
}


def _extract_body(cmd):
    # 1) --body-file <path> / --input <path>
    m = re.search(r"--(?:body-file|input)[=\s]+(?:'([^']+)'|\"([^\"]+)\"|(\S+))", cmd)
    if m:
        path = m.group(1) or m.group(2) or m.group(3)
        try:
            with open(os.path.expanduser(path), "r", encoding="utf-8") as fh:
                raw = fh.read()
        except Exception:
            return ""
        # `gh api --input` takes a JSON file; pull .body out of it.
        try:
            obj = json.loads(raw)
            if isinstance(obj, dict) and isinstance(obj.get("body"), str):
                return obj["body"]
        except Exception:
            pass
        return raw
    # 2) gh api -F body=@<path> / --field body=@<path>
    m = re.search(r"(?:-F|--field|--raw-field)\s+body=@(?:'([^']+)'|\"([^\"]+)\"|(\S+))", cmd)
    if m:
        path = m.group(1) or m.group(2) or m.group(3)
        try:
            with open(os.path.expanduser(path), "r", encoding="utf-8") as fh:
                return fh.read()
        except Exception:
            return ""
    # 3) --body "$(cat <<'EOF' ... EOF)" heredoc
    m = re.search(r"<<-?'?EOF'?\s*\n(.*?)\n\s*EOF", cmd, re.DOTALL)
    if m:
        return m.group(1)
    # 4) --body '...' / --body "..." / gh api -f body='...'
    m = re.search(r"(?:--body|(?:-f|--field|--raw-field)\s+body=)[=\s]*'((?:[^']|'\\'')*)'", cmd, re.DOTALL)
    if m:
        return m.group(1)
    m = re.search(r'(?:--body|(?:-f|--field|--raw-field)\s+body=)[=\s]*"(.*?)"', cmd, re.DOTALL)
    if m:
        return m.group(1)
    return ""


# ── item 1/5: verdict claims ────────────────────────────────────────────────
VERDICT = re.compile(
    r"(?i)(?:\bcapture[ds]?\s+confirm\w*|\bconfirm(?:s|ed)\b|\bverif(?:y|ies|ied)\b"
    r"|\bproven\b|\bobserved\b|\bingested\b|\bdemonstrat(?:e|es|ed)\b"
    r"|\blive-proven\b|\bsuccessful\b|\bvalidated\b"
    r"|does not drop\b|✅)"
)
ARTIFACT = re.compile(
    r"(?i)(?:https?://\S+|actions/runs/\d+|/blob/|\bjob/\d+"
    r"|`?[\w./-]*\.(?:test|spec)\.[tj]sx?(?::\d+)?`?)"
)
# ── item 2: runtime observation claims ─────────────────────────────────────
OBSERVATION = re.compile(
    r"(?i)(?:\brendered\b|byte-identical(?:ly)?|\bsnapshot\s+shows?\b"
    r"|\bscreenshots?\s+show\w*|\breproduc(?:ed|es)\b"
    r"|\bstill\s+(?:shown|shows|fails|failing|raises)\b"
    r"|\bin\s+a\s+(?:real|live)\s+browser\b|\blive\s+test\s+build\b"
    r"|\bin\s+two\s+independent\s+runs\b|\bworks\s+as\s+described\b)"
)
OBS_ARTIFACT = re.compile(
    r"(?i)(?:!\[|<img\b|user-images\.githubusercontent|user-attachments"
    r"|gist\.github|sentry\.io/\S+|actions/runs/\d+"
    r"|\b[\w./-]+\.(?:png|jpe?g|gif|mp4|webm|har|log|json)\b)"
)
# ── item 8: deferral needs a tracker ───────────────────────────────────────
DEFERRAL = re.compile(
    r"(?i)(?:remains?\s+pending\b|still\s+pending\b|not\s+yet\s+verif\w*"
    r"|not\s+yet\s+captur\w*|\bTODO\b"
    r"|(?:capture|end-to-end|live|e2e)[^.\n]{0,40}\bpending\b)"
)
TRACKER = re.compile(
    r"(?i)(?:#\d+|https?://\S*(?:issues|pull)/\d+|\btriage\b|follow-?up|tracked\s+in)"
)
# ── item 11: CI restatement — unconditional in validation scope ────────────
CI_RESTATEMENT = re.compile(
    r"(?i)(?:actions/runs/\d+|\bchecks?\s+tab\b|\bgreen\s+(?:at\s+head|in\s+)"
    r"|\ball\s+(?:tests|checks|jobs)\s+(?:pass\w*|green)\b|\bCI\s+(?:is\s+)?green\b"
    r"|\b\d+\s+pass(?:ing|ed)?\s*/\s*\d+\s+fail\w*)"
)
# ── item 11: inflated verdict — proof language beside a non-exercise ───────
NOT_EXERCISED = re.compile(
    r"(?i)(?:was\s+not\s+exercised|not\s+exercised\b|not\s+separately\s+captured"
    r"|borrowed\s+from\b|stands?\s+in\s+for\b)"
)
# ── item 12: bare / truncated identifiers ──────────────────────────────────
BARE_ID = re.compile(r"(?<![\w/.-])(?:[0-9a-f]{32}|[0-9a-f]{16})(?![\w.-])")
TRUNCATED_ID = re.compile(r"(?<![\w])[0-9a-f]{6,}(?:…|\.\.\.)")
HASH_EQUALITY = re.compile(r"(?i)(?:hash[- ]equal|byte-identical|identical\s+hash|md5|sha256\s+match)")
RESOLVER = re.compile(r"(?i)https?://\S+")
# ── item 16: mutable ref — /blob/<branch>/ instead of /blob/<sha>/ ─────────
MUTABLE_REF = re.compile(
    r"(?i)https?://github\.com/[\w.-]+/[\w.-]+/blob/(?![0-9a-f]{7,40}[/#])[\w.-]+/"
)
# ── item 13: dump-as-resolver ──────────────────────────────────────────────
DUMP_LINK = re.compile(r"(?i)https?://\S+\.(?:log|json|har|txt)\b")
IMAGE_EMBED = re.compile(
    r"(?i)(?:!\[|<img\b|user-images\.githubusercontent|user-attachments"
    r"|\b[\w./-]+\.(?:png|jpe?g|gif|mp4|webm)\b)"
)
# ── items 15/17: link-only and data-only exhibits ──────────────────────────
LIVE_LINK = re.compile(r"(?i)sentry\.io/\S+")
TELEMETRY_VOCAB = re.compile(
    r"(?i)(?:\bspans?\b|\btraces?\b|\bevent\s+ingest\w*|\bingest\w*|\benvelopes?\b"
    r"|\btelemetry\b|\bDiscover\b|\btransactions?\s+(?:were|was|are)\b)"
)
# ── item 14: step waiver ───────────────────────────────────────────────────
STEP_WAIVER = re.compile(
    r"(?i)(?:not\s+(?:demonstrable|capturable|observable)\b"
    r"|not\s+separately\s+captured\b|not\s+attached\b"
    r"|rests\s+(?:entirely|solely)\s+on\s+the\s+(?:falsifiers?|unit|revert))"
)

SCOPE_HEADING = re.compile(r"(?i)\b(validation|verification|evidence)\b")
SCOPE_PARA = re.compile(
    r"(?i)(?:[✅❌⚠️]|\bcaptur|\bfalsif|\bingest"
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
                _scan_unit(unit, violations)
    return violations


def _add(violations, kind, token, unit):
    violations.append({
        "kind": kind,
        "token": token,
        "snippet": re.sub(r"\s+", " ", unit.strip())[:120],
    })


def _positive_verdict(unit):
    """A non-negated verdict token in this unit, or None."""
    for m in VERDICT.finditer(unit):
        if not _negated(unit, m.start()):
            return m.group(0)
    return None


def _scan_unit(unit, violations):
    # ── VERDICT: excused by a co-located inspectable artifact.
    if not ARTIFACT.search(unit):
        tok = _positive_verdict(unit)
        if tok:
            _add(violations, "verdict", tok, unit)

    # ── OBSERVATION: needs an observation-class artifact. A /blob/ code
    #    permalink does NOT excuse it.
    if not OBS_ARTIFACT.search(unit):
        for m in OBSERVATION.finditer(unit):
            if _negated(unit, m.start()):
                continue
            _add(violations, "observation", m.group(0), unit)
            break

    # ── DEFERRAL: excused by a co-located tracker, NOT by an artifact.
    if not TRACKER.search(unit):
        dm = DEFERRAL.search(unit)
        if dm:
            _add(violations, "deferral", dm.group(0), unit)

    # ── CI RESTATEMENT (item 11): unconditional in validation scope. No
    #    verdict co-location required, no "beyond-CI"/"as context" excuse —
    #    a carve-out here is an instruction to phrase every violation as the
    #    exception.
    cm = CI_RESTATEMENT.search(unit)
    if cm:
        _add(violations, "ci-restatement", cm.group(0), unit)

    # ── INFLATED VERDICT (item 11): proof language co-located with an
    #    admission the surface was not exercised.
    nm = NOT_EXERCISED.search(unit)
    if nm and _positive_verdict(unit):
        _add(violations, "inflated-verdict", nm.group(0), unit)

    # ── STEP WAIVER (item 14): an impossibility argument never discharges a
    #    lane derived from an executable Manual testing step.
    sm = STEP_WAIVER.search(unit)
    if sm:
        _add(violations, "step-waiver", sm.group(0), unit)

    # ── TRUNCATED IDENTIFIER (item 16): a co-located resolver does NOT
    #    excuse — the resolver resolves the full id, not the fragment the
    #    reader holds. Hash-equality prose is exempt.
    if not HASH_EQUALITY.search(unit):
        tm = TRUNCATED_ID.search(unit)
        if tm:
            _add(violations, "truncated-identifier", tm.group(0), unit)

    # ── BARE IDENTIFIER (item 12): an id with no resolving link and no
    #    re-hosted capture is a digging assignment.
    if not RESOLVER.search(unit) and not OBS_ARTIFACT.search(unit):
        bm = BARE_ID.search(unit)
        if bm:
            _add(violations, "bare-identifier", bm.group(0), unit)

    # ── MUTABLE REF (item 16): pin evidence links to a SHA.
    mm = MUTABLE_REF.search(unit)
    if mm:
        _add(violations, "mutable-ref", mm.group(0)[:60], unit)

    # ── DUMP RESOLVER (item 13): a positive verdict whose only resolver is a
    #    raw dump behind a link. The digging moved a hop away, it did not
    #    disappear.
    if _positive_verdict(unit) and DUMP_LINK.search(unit) and not IMAGE_EMBED.search(unit) \
            and not LIVE_LINK.search(unit):
        _add(violations, "dump-resolver", DUMP_LINK.search(unit).group(0)[:60], unit)

    # ── LINK-ONLY EXHIBIT (item 15): a live permalink defers validation
    #    behind click + auth + query rendering. Needs the visual too.
    if _positive_verdict(unit) and LIVE_LINK.search(unit) and not IMAGE_EMBED.search(unit):
        _add(violations, "link-only-exhibit", LIVE_LINK.search(unit).group(0)[:60], unit)

    # ── DATA-ONLY EXHIBIT (item 17): telemetry claim with neither a visual
    #    nor a live link carries no liveness provenance — extracted data is
    #    indistinguishable from data typed by hand.
    if _positive_verdict(unit) and TELEMETRY_VOCAB.search(unit) \
            and not IMAGE_EMBED.search(unit) and not LIVE_LINK.search(unit):
        _add(violations, "data-only-exhibit", TELEMETRY_VOCAB.search(unit).group(0), unit)


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
