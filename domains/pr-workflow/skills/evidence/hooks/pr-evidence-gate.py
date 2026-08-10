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
(stderr shown to the model). Fails OPEN on anything it cannot parse, so it never
bricks unrelated Bash commands — but once it has identified a body it is going to
publish, it fails CLOSED: if attest-gate.sh cannot be found or run, the write is
refused rather than waved through.
"""
import json
import os
import re
import subprocess
import sys
import tempfile


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

    # Resolve the repo the claim is about, so repo-relative artifact paths can be checked
    # against that checkout rather than against wherever this shell happens to be.
    global _TARGET_REPO_NAME  # noqa: PLW0603 - one value, set once, read by _repo_roots
    _m = re.search(r"(?:--repo\s+|github\.com/|repos/)[\w.-]+/([\w.-]+)", cmd)
    _TARGET_REPO_NAME = _m.group(1) if _m else ""

    is_porcelain = bool(GH_PORCELAIN.search(cmd))
    is_api = bool(GH_API.search(cmd)) and re.search(r"(?:-F|-f|--field|--raw-field)\s+body=|--input\b", cmd)
    if not (is_porcelain or is_api):
        _out_allow()
    if is_porcelain and "--body" not in cmd:  # covers --body and --body-file
        _out_allow()

    body = _extract_body(cmd)
    # An unexpanded shell construct is not a body. `--body "$(cat f)"` extracts the literal
    # characters `$(cat f)`, which scans clean and publishes whatever the shell substitutes
    # later — the gate would be inspecting a string the reader never sees.
    #
    # Look at the ARGUMENT, not the body text. A first attempt scanned the body for `$` and
    # backticks and rejected every evidence comment ever written, because markdown inline
    # code is backticks and these artifacts are full of them. The shell metacharacters that
    # matter are in the command; the body is just prose.
    if _body_arg_is_unresolvable(cmd):
        body = ""
    if not body:
        # FAIL CLOSED. The previous reasoning here was "can't read it -> nothing to scan",
        # which inverts the situation: by this point the command has already been identified
        # as an outward-facing write, so an unreadable body is not an absent risk, it is an
        # unverifiable one.
        #
        # This was not theoretical. The extraction is textual, so a path assembled from a
        # shell variable — `--body-file $S/comment.md` — or a body spliced in with
        # `--body "$(cat f)"` yields nothing, and every such publish sailed through while
        # the gate reported itself healthy. An entire session of publishes went ungated this
        # way, including one the gate blocks when handed the same body by literal path.
        _block(
            "EVIDENCE GATE (PreToolUse) — blocked an outward-facing write whose body "
            "could not be read.\n\n"
            "The body path could not be resolved from the command. This hook reads the "
            "command as text and cannot expand shell variables, command substitution, or "
            "heredocs, so a body assembled that way is unverifiable rather than safe.\n\n"
            "Pass a literal path:\n"
            "    gh pr comment <n> --repo <owner/repo> --body-file /abs/path/to/comment.md\n\n"
            "If the body genuinely has no file, write it to one first. The gate has to see "
            "what you are about to publish.\n"
        )

    violations = _scan(body)
    if re.search(r"\bgh\s+issue\s+comment\b", cmd):
        violations += _scan_enrichment_via_comment(body)
    violations += _run_attest_gate(body, cmd)
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
    "enrichment": "a BODY EDIT instead (`gh issue edit --body-file`) — this reads like a resolved finding, not a reply",
    "attest-gate": "the check named above to pass — run scripts/attest-gate.sh yourself to iterate",
    "gate-missing": "attest-gate.sh on disk; refusing to publish a body nothing verified",
    "gate-error": "attest-gate.sh to run successfully; refusing to publish unverified",
    "verdict": "an inspectable ARTIFACT (https:// permalink, /blob/<sha>/, or a *.test.ts ref)",
    "observation": "an OBSERVATION artifact (screenshot/recording/log/JSON/permalink) — "
                   "a /blob/ code link witnesses code, not runtime behavior",
    "deferral": "a co-located TRACKER (#issue, issues/pull URL, 'triage', 'tracked in')",
    "ci-restatement": "removal of the CLAIM, not of the link — 'green at head' hands the "
                      "reviewer their own Checks tab back. Citing a specific run and job "
                      "whose log holds the figure you are reporting is evidence and is "
                      "fine; asserting a status the Checks tab already shows is not",
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
# Restating a status is not the same as citing a measurement, and the rule is about the
# first. "Tests are green at head <sha>" hands the reviewer their own Checks tab back and
# carries no information. A link to a specific run and job whose log holds the figure
# being reported carries the whole measurement, and is what evidence-run.yml exists to
# produce — "move the measurement to CI, where the run URL is the capture".
#
# Matching a bare `actions/runs/N` conflated the two, so the package forbade its own
# flagship output: five of the six branches below describe a CLAIM about CI, and one
# described a URL. A run link is now a violation only when it carries restatement
# language with it.
CI_RESTATEMENT = re.compile(
    r"(?i)(?:\bchecks?\s+tab\b|\bgreen\s+(?:at\s+head|in\s+)"
    r"|\ball\s+(?:tests|checks|jobs)\s+(?:pass\w*|green)\b|\bCI\s+(?:is\s+)?green\b"
    r"|\b\d+\s+pass(?:ing|ed)?\s*/\s*\d+\s+fail\w*"
    r"|actions/runs/\d+[^.\n]{0,80}?\b(?:green|passing|all\s+checks|succeeded)\b"
    r"|\b(?:green|passing|all\s+checks)\b[^.\n]{0,80}?actions/runs/\d+)"
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



# ── attest-gate delegation ────────────────────────────────────────────────────
# The rules live in attest-gate.sh. This hook used to carry a second, narrower copy
# of them — keyed on verdict tokens — and a diligence comment that renders no verdict
# satisfied neither the copy here nor the copy there. Two rule sets means the weaker
# one governs whatever falls between them, which is how a results section of hand-typed
# terminal output reached a public PR under both gates.
#
# So: one rule set, invoked at the one point the model cannot route around. The model
# runs the gate by choice; this runs it by construction.
def _gv(kind, token, snippet):
    """attest-gate findings, in the shape the reporter already renders."""
    return {"kind": kind, "token": token, "snippet": snippet}


def _repo_pr_from_cmd(cmd):
    """owner/repo#N for check 12. A comment-update URL carries the COMMENT id, not the
    issue's — reading it as a PR number asks the gate whether pull #5177261620 is open,
    which 404s and reports as 'destination unknown'. So resolve it."""
    m = re.search(r"(?:--repo\s+|github\.com/|repos/)([\w.-]+/[\w.-]+)", cmd)
    repo = m.group(1) if m else ""
    if not repo:
        return ""
    c = re.search(r"issues/comments/(\d+)", cmd)
    if c:
        try:
            out = subprocess.run(
                ["gh", "api", f"repos/{repo}/issues/comments/{c.group(1)}",
                 "--jq", ".issue_url"],
                capture_output=True, text=True, timeout=30)
            n = re.search(r"/issues/(\d+)\s*$", out.stdout.strip())
            return f"{repo}#{n.group(1)}" if n else ""
        except Exception:  # noqa: BLE001
            return ""
    n = re.search(r"(?:issues|pulls?)/(\d+)|\bpr\s+(?:comment|edit|create)\s+(\d+)", cmd)
    num = next((g for g in (n.groups() if n else ()) if g), "")
    return f"{repo}#{num}" if num else ""


def _find_gate():
    here = os.path.dirname(os.path.abspath(__file__))
    for cand in (
        # An explicit override that loses to a default is not an override. This
        # ranked last, so a control run pointing ATTEST_GATE at a stand-in gate
        # silently exercised the installed one instead and reported on it — the
        # test looked like it passed and measured the wrong binary.
        os.environ.get("ATTEST_GATE", ""),
        os.path.join(here, "..", "scripts", "attest-gate.sh"),
        os.path.join(here, "attest-gate.sh"),
        os.path.expanduser("~/.claude/skills/mms-evidence/scripts/attest-gate.sh"),
    ):
        if cand and os.path.isfile(cand):
            return os.path.abspath(cand)
    return ""


# Only evidence artifacts are held to the evidence contract. An ordinary reply is not a
# failed validation run, and running the gate over every published body blocks every normal
# comment on checks 1-4 — caught by the negative arm of gate-controls.sh before this was
# wired, which is the entire reason that arm exists. A gate that blocks everything is as
# broken as one that blocks nothing, and only the negative control tells them apart.
ARTIFACT_MARKERS = (
    "VALIDATION_RUN_START",
    "LAVAMOAT_DILIGENCE_START",
    "## 🧪 Validation Run",
)


# Where the bold stops is not a fact about the claim. `**Verdict:** proven`
# ran all thirteen checks and `**Verdict: proven**` ran none — the same
# sentence, rendered the same way, one of them silently unenforced. Match the
# bolded Verdict lead however the emphasis falls, while staying anchored to a
# line-leading bold run so that mentioning the word in prose still does not
# drag a normal comment into the gate.
_VERDICT_LEAD = re.compile(r"^\s*\*\*\s*Verdict\b[^*\n]*\*\*", re.M | re.I)


_FENCE = re.compile(r"^```.*?^```", re.M | re.S)


def _is_evidence_artifact(body):
    if any(m in body for m in ARTIFACT_MARKERS):
        return True
    # A verdict line inside a fenced block is an example of one, not one. Writing about
    # this gate — a PR that quotes `**Verdict:** proven` to show what triggers it — was
    # otherwise classified as a validation run and asked for the whole envelope. The
    # trigger has to be able to tell a claim from a quotation of a claim, or documenting
    # the rule becomes a violation of it.
    return bool(_VERDICT_LEAD.search(_FENCE.sub("", body)))


def _run_attest_gate(body, cmd):
    if not _is_evidence_artifact(body):
        return []
    gate = _find_gate()
    if not gate:
        # Fails CLOSED. An enforcement point that waves things through when it cannot
        # find its rules is not an enforcement point; the whole reason this exists is
        # that the model-invoked path was skippable.
        return [_gv("gate-missing", "attest-gate.sh not found",
                    "Set ATTEST_GATE to its path, or install mms-evidence.")]
    mode = ["--diligence"] if "LAVAMOAT_DILIGENCE_START" in body else []
    target = _repo_pr_from_cmd(cmd)
    with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False) as fh:
        fh.write(body)
        path = fh.name
    try:
        argv = ["bash", gate, path] + mode + (["--target", target] if target else [])
        proc = subprocess.run(argv, capture_output=True, text=True, timeout=120)
    except Exception as exc:  # noqa: BLE001 - any failure to run it is a failure to verify
        os.unlink(path)
        return [_gv("gate-error", str(exc), "attest-gate.sh could not be run.")]
    os.unlink(path)
    if proc.returncode == 0:
        return []
    out = proc.stdout.splitlines()
    fails = []
    for i, ln in enumerate(out):
        if ln.strip().startswith("FAIL"):
            detail = out[i + 1].strip() if i + 1 < len(out) else ""
            fails.append(_gv("attest-gate", ln.strip()[6:].strip(), detail))
    return fails or [_gv("attest-gate", f"exit {proc.returncode}", proc.stdout[-200:])]


REPLY_TEMPLATE_OPENER = re.compile(
    r"(?i)^\s*(?:addressed|resolved|reverted)\s*:\s*\S"
)


def _scan_enrichment_via_comment(body):
    """`gh issue comment` posting a standalone finding — should be a body edit.

    Structural signal, not a vocabulary one: the real instance this is modeled
    on (planning#7508) used none of VERDICT's literal words ("ground-truthed",
    "rules out", "de-risks" — not "confirmed"/"proven"/etc), so reusing that
    regex as the discriminator missed it entirely on the first attempt (caught
    by testing against the real text, not by reasoning about it). What actually
    distinguishes a standalone report from a reply, regardless of vocabulary:
    several paragraphs, at least one cited link, and no reply-template opener.
    A properly-templated reply (Addressed:/Resolved:/Reverted: <fact>.) is
    excused unconditionally — that template is itself the correct convention
    for a comment (exogram-core: ghostwrite-review-reply-register), so
    following it is the signal of doing this right, not a loophole.
    """
    if REPLY_TEMPLATE_OPENER.search(body.strip()):
        return []
    paras = [p.strip() for p in re.split(r"\n\s*\n", body) if p.strip()]
    if len(paras) < 3:
        return []  # short reply, even with a link, isn't a standalone report
    if not re.search(r"https?://\S+", body):
        return []  # no cited evidence — not the report shape either
    snip = re.sub(r"\s+", " ", paras[0])[:120]
    return [{"token": "standalone finding", "snippet": snip, "kind": "enrichment"}]


# The text following --body/--body-file, up to the next argument. If it carries a variable,
# a command substitution, or a backtick, this hook cannot know what will actually be sent.
BODY_ARG = re.compile(r"(?:--body-file|--body|-F\s+body|--field\s+body|--raw-field\s+body)[=\s]+(\S+)")


def _body_arg_is_unresolvable(cmd):
    m = BODY_ARG.search(cmd)
    if not m:
        return False
    arg = m.group(1)
    return bool(re.search(r"\$|`", arg))


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


# ── artifact credibility ───────────────────────────────────────────────────
# Matching a URL shape only proves someone typed a URL, and the same generator
# writes the claim and the string that satisfies the check — so presence alone
# carries no information. An artifact counts only if the author could not have
# authored its contents: a namespace where the bytes are written by CI, by the
# upload endpoint, or by an observability backend; or a local path that is
# actually on disk. Presence stays necessary and stops being sufficient.
ARTIFACT_HOST_ALLOWLIST = (
    "github.com/",                      # narrowed by ARTIFACT_PATH_ALLOWLIST below
    "user-images.githubusercontent.com/",
    "gist.github.com/",
    "sentry.io/",
    "grafana.net/",
    "grafana.com/",
)
# github.com is author-writable in general (a branch, a wiki, a comment anchor),
# so only the sub-namespaces whose bytes CI or the upload endpoint produce count.
ARTIFACT_PATH_ALLOWLIST = (
    "/actions/runs/",
    "/user-attachments/",
    "/blob/",
    "/commit/",
    "/pull/",
)
# Escape hatch for hosting the author does control — an artifact bucket, an
# internal dashboard. Registering one is a deliberate, visible downgrade: the
# artifact becomes fetchable rather than independent, and a reader who trusts
# it is trusting the author. Comma-separated substrings.
#   EVIDENCE_GATE_ARTIFACT_HOSTS=my-bucket.s3.amazonaws.com,dash.internal
_EXTRA_HOSTS = tuple(
    h.strip().lower()
    for h in (os.environ.get("EVIDENCE_GATE_ARTIFACT_HOSTS") or "").split(",")
    if h.strip()
)
_URL_RE = re.compile(r"https?://[^\s)>\]\"']+")
_LOCAL_REF_RE = re.compile(
    r"`?([\w./-]+\.(?:test|spec)\.[tj]sx?)(?::\d+)?`?"
    r"|`?([\w./-]+\.(?:png|jpe?g|gif|mp4|webm|har|log|json))`?"
)


def _url_is_credible(url):
    low = url.lower()
    if _EXTRA_HOSTS and any(h in low for h in _EXTRA_HOSTS):
        return True
    if not any(h in low for h in ARTIFACT_HOST_ALLOWLIST):
        return False
    if "github.com/" in low and "githubusercontent" not in low and "gist." not in low:
        return any(p in low for p in ARTIFACT_PATH_ALLOWLIST)
    return True


# Set from the publish command's --repo, so a repo-relative path can be resolved against
# the repository the claim is actually about rather than against wherever the hook ran.
_TARGET_REPO_NAME = ""


def _repo_roots():
    """Directories a repo-relative reference could resolve against.

    The hook does not run from the repo under review — it runs wherever the publishing
    shell happened to be. Checking only cwd meant a real `shared/lib/trace.test.ts` was
    reported as fabricated whenever the publish came from a parent directory, which is
    the normal case.
    """
    roots = [os.getcwd(), os.environ.get("CLAUDE_PROJECT_DIR") or ""]
    try:
        top = subprocess.run(["git", "rev-parse", "--show-toplevel"],
                             capture_output=True, text=True, timeout=5)
        if top.returncode == 0:
            roots.append(top.stdout.strip())
    except Exception:  # noqa: BLE001 - absence of git is not a verdict
        pass
    if _TARGET_REPO_NAME:
        base = os.getcwd()
        for cand in (os.path.join(base, _TARGET_REPO_NAME),
                     os.path.join(os.path.dirname(base), _TARGET_REPO_NAME)):
            roots.append(cand)
    return [r for r in roots if r and os.path.isdir(r)]


def _local_ref_state(ref):
    """'found' | 'missing' | 'unverifiable'.

    The three are genuinely different and collapsing them is what broke this. 'missing'
    means we looked in a real checkout and it is not there — that is a fabricated path.
    'unverifiable' means there was nowhere to look, and reporting that as fabricated
    blocks legitimate publishing from outside the repo.
    """
    if os.path.isabs(ref):
        return "found" if os.path.exists(ref) else "missing"
    roots = _repo_roots()
    if not roots:
        return "unverifiable"
    for root in roots:
        if os.path.exists(os.path.join(root, ref)):
            return "found"
    # Only claim 'missing' from a root that actually looks like a checkout; otherwise we
    # are asserting absence from a tree that was never going to contain it.
    for root in roots:
        if os.path.isdir(os.path.join(root, ".git")):
            return "missing"
    return "unverifiable"


def _has_credible_artifact(unit, pattern):
    """True only if this unit carries an artifact the author could not fabricate."""
    if not pattern.search(unit):
        return False
    for url in _URL_RE.findall(unit):
        if _url_is_credible(url):
            return True
    for m in _LOCAL_REF_RE.finditer(unit):
        test_ref, capture_ref = m.group(1), m.group(2)
        ref = test_ref or capture_ref
        if not ref:
            continue
        state = _local_ref_state(ref)
        if state == "found":
            return True
        # A test/spec path is listed in this gate's own contract as an acceptable
        # artifact — the reviewer resolves it in the PR's repo, not on the publisher's
        # disk. So when there is no checkout to check against, accept it. A capture
        # (.png/.log/.json) is not accepted on the same terms: a local path to a capture
        # is not something a reader can open, so it has to be real or re-hosted.
        if state == "unverifiable" and test_ref:
            return True
    return False


def _positive_verdict(unit):
    """A non-negated verdict token in this unit, or None."""
    for m in VERDICT.finditer(unit):
        if not _negated(unit, m.start()) and not _in_code_span(unit, m.start()):
            return m.group(0)
    return None


def _scan_unit(unit, violations):
    # ── VERDICT: excused by a co-located inspectable artifact.
    if not _has_credible_artifact(unit, ARTIFACT):
        tok = _positive_verdict(unit)
        if tok:
            _add(violations, "verdict", tok, unit)

    # ── OBSERVATION: needs an observation-class artifact. A /blob/ code
    #    permalink does NOT excuse it.
    if not _has_credible_artifact(unit, OBS_ARTIFACT):
        for m in OBSERVATION.finditer(unit):
            if _negated(unit, m.start()) or _in_code_span(unit, m.start()):
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
    if not RESOLVER.search(unit) and not _has_credible_artifact(unit, OBS_ARTIFACT):
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


_INLINE_CODE = re.compile(r"`[^`\n]+`")


def _in_code_span(text, pos):
    """A verdict token inside inline code is the word being discussed, not a claim made.

    The same use-versus-mention distinction the fenced-block strip draws one level up:
    a body quoting `**Verdict:** proven` to document what the trigger matches is writing
    *about* a verdict. Without this, documenting the rule violates it — which is how it
    was found, on the description of the pull request that ships the rule.

    Positional rather than a strip of the spans, deliberately. `_has_credible_artifact`
    reads paths and test refs *out of* inline code, so removing it would delete the
    evidence that excuses a verdict and tighten the gate instead of correcting it.
    """
    return any(m.start() <= pos < m.end() for m in _INLINE_CODE.finditer(text))


def _negated(text, pos):
    """A verdict token preceded by a negator is a hedge, not a claim.

    The 16-character lookback is narrow enough to miss a negator governing a subordinate
    clause — "cannot tell whether a screenshot shows" puts it 22 back. Left as is: a
    window wide enough to reach it also lets a negator elsewhere in the sentence excuse a
    real claim, and a gate that wrongly allows an unbacked verdict fails at its purpose,
    where one that wrongly blocks only costs the author a rewrite.
    """
    pre = text[max(0, pos - 16):pos].lower()
    if re.search(r"\b(not|never|no|isn't|aren't|cannot|can't|without|un|yet)\s*$", pre):
        return True
    # 'unverified' / 'unproven' — negator fused onto the token
    if pre.endswith("un"):
        return True
    return False


if __name__ == "__main__":
    main()
