#!/usr/bin/env python3
"""Turn a LavaMoat policy base/head pair into a per-grant justification worklist.

Detection is LavaMoat's job: `@metamaskbot update-policies` regenerates the policy from a
real run of the code and CI fails on drift. This script does NOT re-derive or classify that
diff — it enumerates every capability newly granted so each can be JUSTIFIED with a permalink
to the dependency's own source (accept), or REJECTED where no call site uses it.

Usage: policy-audit.py <base/policy.json> <head/policy.json>
Falsifier: a listed grant for which no upstream call site can be found.
"""
import json
import sys


def resources(path):
    with open(path) as f:
        return json.load(f).get("resources", {})


def newly_granted(head, base):
    """Every (pkg, kind, capability) that is true in head and absent/false in base."""
    out = []
    for pkg, cfg in head.items():
        for kind in ("globals", "builtins", "packages"):
            for cap, val in (cfg.get(kind) or {}).items():
                if val and not ((base.get(pkg, {}).get(kind) or {}).get(cap)):
                    out.append((pkg, kind, cap))
    return out


def main():
    if len(sys.argv) != 3:
        sys.exit("usage: policy-audit.py <base/policy.json> <head/policy.json>")
    base = resources(sys.argv[1])
    head = resources(sys.argv[2])
    grants = sorted(newly_granted(head, base))

    print("PER-GRANT JUSTIFICATION WORKLIST")
    print("=" * 74)
    print("Detection is LavaMoat's; each row below needs a REASON, not a category.")
    print("Justify with a permalink to the dependency's source at the installed version")
    print("(accept), or reject where no call site uses the capability.\n")

    if not grants:
        print("  (no new grants between base and head — nothing to justify)")
        return

    for pkg, kind, cap in grants:
        print(
            f"  [ ] {pkg[:38]:40s} {kind[:3]}:{cap:22s}"
            "  reason: <upstream file#Ln @ tag>   verdict: accept|REJECT"
        )

    print(f"\n  {len(grants)} grant(s) to justify.")
    print("  A grant with no locatable call site is the finding — reject it.")


if __name__ == "__main__":
    main()
