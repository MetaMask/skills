#!/usr/bin/env python3
"""Security and privacy surface delta for a diff — what this change newly exposes,
and what protection it removed.

Two halves, and the second is the one nothing else catches:

  INTRODUCED   added lines that send, store, or log something that leaves the
               device or outlives the session
  WORSENED     removed lines that were a consent gate, a sanitiser, a redaction,
               or a validation — a protection deleted is a regression that no
               "scan the new code" pass can see, because there is no new code

Reports and escalates. It does not rule on whether a flow is acceptable: that
depends on disclosure, jurisdiction, and intent, none of which are in a diff.
A finding here is a question for a human, and for anything sensitive it belongs
in a private tracker rather than a public comment.

Usage: egress-delta.py <patch-file> [--context <repo-root>]
Falsifier: an added egress site with no corresponding gate anywhere in its call path.
"""
import re
import sys
from collections import defaultdict

# Things that move data off-device or persist it beyond the session.
EGRESS = [
    (r"\bfetch\s*\(", "network: fetch"),
    (r"\bXMLHttpRequest\b", "network: XHR"),
    (r"\bnew WebSocket\s*\(", "network: websocket"),
    (r"\bsendBeacon\s*\(", "network: beacon"),
    (r"\baxios\.\w+\s*\(", "network: axios"),
    (r"\bsubmitRequestToBackground\s*(<[^>]*>)?\s*\(", "background RPC"),
    (r"\btrackEvent\s*\(", "telemetry: event"),
    (r"\bcaptureException\s*\(|\bcaptureMessage\s*\(", "telemetry: sentry"),
    (r"\baddBreadcrumb\s*\(", "telemetry: breadcrumb"),
    (r"\bstartSpan\w*\s*\(|\btrace\s*\(\s*\{", "telemetry: span"),
    (r"\blocalStorage\.setItem\s*\(|\bsessionStorage\.setItem\s*\(", "storage: web"),
    (r"\bchrome\.storage\.\w+\.set\s*\(", "storage: extension"),
    (r"\bindexedDB\.open\s*\(", "storage: indexeddb"),
    (r"\bconsole\.(log|info|warn|error)\s*\(", "log: console"),
]

# Identifier-shaped payloads. Presence on an egress line is what makes it interesting.
# Trailing \w* rather than \b: identifiers appear pluralised and camel-cased far more
# often than bare — `addresses`, `accountIds`, `tokenList`. A closing \b silently misses
# every one of those, which is the whole payload on a real call site.
SENSITIVE = [
    (r"\bprivate\w*[Kk]ey|\bmnemonic\w*|\bseed\w*[Pp]hrase", "SECRET"),
    (r"\bvault\w*|\bkeyring\w*|\bencryptionKey\w*", "SECRET"),
    (r"\baddress\w*|\baccount\w*|\bpublicKey\w*", "identifier"),
    (r"\bemail\w*|\bipAddress\w*|\buserId\w*|\bdeviceId\w*", "identifier"),
    (r"\bjwt\w*|\btoken\w*|\bbearer\w*|\bapiKey\w*|\bsecret\w*", "credential"),
    (r"\bbalance\w*|\btxHash\w*|\btransaction\w*", "activity"),
]

# Protections whose REMOVAL is the finding.
GUARDS = [
    (r"\buseExternalServices\b|\bbasicFunctionality\b", "basic-functionality gate"),
    (r"\bparticipateInMetaMetrics\b|\bcanSubmitAnalytics\b|\boptedIn\b|\boptIn\b", "consent gate"),
    (r"\bisEnabled\b|\bfeatureFlag\w*\b|\bremoteFeatureFlags\b", "feature gate"),
    (r"\bsanitiz|\bredact|\bmask\b|\bscrub\b|\banonymi", "sanitiser"),
    (r"\bvalidate\w*\s*\(|\bassert\w*\s*\(|\bisValid\w*\s*\(", "validation"),
    (r"\bbeforeSend\b|\btracesSampleRate\b|\bsampleRate\b", "sampling gate"),
    (r"\bencrypt\w*\s*\(|\bhash\w*\s*\(", "encryption/hashing"),
]

HOST = re.compile(r"https?://([A-Za-z0-9.\-]+)")


def parse(patch_path):
    """Yield (file, sign, text) for +/- lines, tracking the current file."""
    cur = None
    with open(patch_path, errors="replace") as f:
        for line in f:
            if line.startswith("+++ b/"):
                cur = line[6:].strip()
                continue
            if line.startswith("--- ") or line.startswith("+++ "):
                continue
            if line.startswith("+") or line.startswith("-"):
                yield cur, line[0], line[1:].rstrip("\n")


def classify(text, table):
    return [label for pat, label in table if re.search(pat, text)]


def main():
    if len(sys.argv) < 2:
        sys.exit("usage: egress-delta.py <patch-file>")

    introduced = []      # (file, kind, sensitivity, host, text)
    worsened = defaultdict(list)   # guard -> [(file, text)]
    removed_egress = 0

    # An egress call and its payload are usually on different lines —
    # `submitRequestToBackground<T>(` on one, `[addresses]` on the next. Matching a
    # single line therefore misses precisely the argument that makes the call
    # interesting, so sensitivity is read from a window around the call site.
    WINDOW = 3
    rows = [(p, sg, t) for p, sg, t in parse(sys.argv[1])
            if p and not p.endswith((".md", ".json", ".lock", ".snap"))]

    for i, (path, sign, text) in enumerate(rows):
        stripped = text.strip()
        if not stripped or stripped.startswith(("//", "*", "/*")):
            continue

        kinds = classify(text, EGRESS)
        if sign == "+" and kinds:
            lo, hi = max(0, i - WINDOW), min(len(rows), i + WINDOW + 1)
            near = " ".join(t for p2, sg2, t in rows[lo:hi] if p2 == path and sg2 == "+")
            sens = classify(near, SENSITIVE)
            host = HOST.search(near)
            introduced.append((path, kinds[0], sens, host.group(1) if host else None, stripped))
        elif sign == "-" and kinds:
            removed_egress += 1

        if sign == "-":
            for g in classify(text, GUARDS):
                worsened[g].append((path, stripped))

    # A guard removed in the same hunk that re-adds it is a refactor, not a regression.
    readded = set()
    for path, sign, text in parse(sys.argv[1]):
        if sign == "+":
            for g in classify(text, GUARDS):
                readded.add((path, g))
    worsened = {g: [(p, t) for p, t in v if (p, g) not in readded]
                for g, v in worsened.items()}
    worsened = {g: v for g, v in worsened.items() if v}

    print("SECURITY / PRIVACY SURFACE DELTA")
    print("=" * 74)
    print("Introduced = added lines that send, store, or log off-device.")
    print("Worsened   = removed protections. Nothing that scans new code can see these,")
    print("             because a deleted guard adds no code.\n")

    if not introduced and not worsened:
        print("  (no egress added and no protection removed in this diff)")
        return

    if introduced:
        print(f"INTRODUCED — {len(introduced)} site(s)")
        print("-" * 74)
        sens_first = sorted(introduced, key=lambda r: (not r[2], r[0]))
        for path, kind, sens, host, text in sens_first[:25]:
            tag = ("/".join(sens) if sens else "—")
            print(f"  [{tag:>12}] {kind:<22} {path}")
            print(f"                 {text[:96]}")
            if host:
                print(f"                 → host: {host}")
        if len(introduced) > 25:
            print(f"\n  … {len(introduced) - 25} further site(s).")
        print()

    if worsened:
        n = sum(len(v) for v in worsened.values())
        print(f"WORSENED — {n} protection(s) removed and not re-added in this diff")
        print("-" * 74)
        for guard, rows in sorted(worsened.items()):
            print(f"  {guard}  ({len(rows)})")
            for path, text in rows[:4]:
                print(f"      {path}")
                print(f"        - {text[:92]}")
        print()

    if removed_egress:
        print(f"  ({removed_egress} egress line(s) also removed — a move or a deletion, "
              "check before reading the counts above as net-new.)\n")

    print("RAISE WITH A HUMAN — no verdict offered")
    print("-" * 74)
    print("Whether a flow is acceptable depends on disclosure, jurisdiction, and intent,")
    print("none of which are in a diff. A screening check that a user can decline screens")
    print("nobody, so an absent consent gate is not automatically a defect — and that is")
    print("exactly the judgement this script must not make.")
    print()
    print("Anything sensitive here belongs in a private tracker, not a public comment.")


if __name__ == "__main__":
    main()
