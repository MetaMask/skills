#!/usr/bin/env python3
"""Turn a LavaMoat policy base/head pair into a per-grant justification worklist,
and audit hand-written overrides for scope.

Detection is LavaMoat's job: `@metamaskbot update-policies` regenerates the policy from a
real run of the code and CI fails on drift. This script does NOT re-derive or classify that
diff — it enumerates every capability newly granted so each can be JUSTIFIED with a permalink
to the dependency's own source (accept), or REJECTED where no call site uses it.

With --override it also audits `policy-override.json`. Per lavamoat-core/src/mergePolicy.js the
effective policy is `mergePolicy(generated, override)`, with priority to stricter decisions in
the override. The two files are DESIGNED not to align: the generated policy is regenerated on
dependency updates while the override persists, which is the whole point of separating them.
So an override entry absent from the generated policy is the normal case, not a finding.

What the audit reports is therefore scope, not divergence: which entries persist without a
recorded reason, which are broader than the generated policy shows a need for, and which grant
write. Narrowing a whole-object grant requires setting the parent to `false` — `validateHierarchy`
throws if `X` and `X.y` are both present.

Usage:
  policy-audit.py <base/policy.json> <head/policy.json>
                  [--override <policy-override.json>] [--generated <policy.json>]

Falsifier: a listed grant for which no upstream call site can be found.
"""
import json
import sys

# Capability classes where a wrong call is not recoverable by a follow-up PR. The script
# refuses a verdict on these by design — it reports and escalates. Naming them explicitly
# rather than scoring them keeps the escalation auditable.
CRITICAL = {
    "child_process", "fs", "vm", "worker_threads", "module", "process",
    "eval", "Function", "WebAssembly", "importScripts", "SharedArrayBuffer",
    "fetch", "XMLHttpRequest", "WebSocket", "crypto", "indexedDB",
    "localStorage", "sessionStorage", "chrome", "browser",
}
CRITICAL_PKG_HINTS = ("keyring", "vault", "snap", "lavamoat", "seed", "wallet")

# ECMAScript and DOM intrinsics. Granting these is unremarkable — a package that renders
# anything touches Element and Object — so they never escalate on their own. Without this
# a sensitive-package hint floods the list with `Object`, `String`, `Array`, and an
# escalation list that is mostly noise trains its reader to skip it.
BENIGN = {
    "Array", "Object", "String", "Number", "Boolean", "Symbol", "BigInt", "Math",
    "JSON", "Date", "RegExp", "Map", "Set", "WeakMap", "WeakSet", "Weakmap",
    "Promise", "Error", "TypeError", "Proxy", "Reflect", "Intl",
    "Document", "DocumentFragment", "Element", "Event", "EventTarget", "Node",
    "NavigateEvent", "NavigationDestination", "Clipboard", "CSS", "Text",
    "console", "queueMicrotask", "structuredClone",
}


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


def root_of(cap):
    return cap.split(".", 1)[0]


def criticality(pkg, cap):
    """Return a reason string, or None. The reason is reported verbatim, so it must be
    true of THIS row — a package-level hint is not a claim about the capability."""
    root = root_of(cap)
    if root in CRITICAL:
        return f"critical capability: {root}"
    if root in BENIGN:
        return None
    if any(h in pkg.lower() for h in CRITICAL_PKG_HINTS):
        return "non-intrinsic grant in a security-sensitive package"
    return None


def is_critical(pkg, cap):
    return criticality(pkg, cap) is not None


def audit_overrides(over, gen):
    """Classify each override entry against what the generated policy observed.

    widened   granted here, not observed by the toolchain — a human decision needing a reason
    tightened explicit false over an observed grant — containment narrowed, no action
    broad     whole-object grant where only specific members were observed — narrowable
    write     write access; read may suffice, and only call sites can settle it
    """
    widened, tightened, broad, write = [], [], [], []
    for pkg, cfg in over.items():
        gpkg = gen.get(pkg, {})
        for kind, caps in cfg.items():
            if not isinstance(caps, dict):
                continue
            gcaps = gpkg.get(kind) or {}
            for cap, val in caps.items():
                if val == "write":
                    write.append((pkg, kind, cap))
                    continue
                if val is False:
                    if gcaps.get(cap):
                        tightened.append((pkg, kind, cap))
                    continue
                if not gcaps.get(cap):
                    # NOT "never observed" — the generated policy is regenerated
                    # independently, so absence here is expected. This is only a list of
                    # entries whose justification lives outside both files.
                    widened.append((pkg, kind, cap))
                if "." not in cap:
                    members = sorted(
                        c for c in gcaps if c.startswith(cap + ".") and gcaps.get(c)
                    )
                    if members and not gcaps.get(cap):
                        broad.append((pkg, kind, cap, tuple(members)))
    return widened, tightened, broad, write


def partition_escalations(rows, base, write_set):
    """Split a human's worklist into decisions and consequences.

    A capability granted to a package the base policy did not contain at all arrives
    because the package arrived — a bundle-graph change, not a choice anyone made about
    that capability. A capability newly granted to a package already contained is
    somebody's decision. Under one heading the second is buried in the first: a list
    where 23 of 24 rows are not actionable teaches its reader to skim past the one that is.
    """
    chosen, inherited = [], []
    for pkg, kind, cap in rows:
        (inherited if pkg not in base else chosen).append((pkg, kind, cap))
    return chosen, inherited


def main():
    args = sys.argv[1:]
    if len(args) < 2:
        sys.exit("usage: policy-audit.py <base/policy.json> <head/policy.json> "
                 "[--override <file>] [--generated <file>]")
    base_p, head_p = args[0], args[1]
    over_p = gen_p = None
    for i, a in enumerate(args):
        if a == "--override" and i + 1 < len(args):
            over_p = args[i + 1]
        if a == "--generated" and i + 1 < len(args):
            gen_p = args[i + 1]

    base, head = resources(base_p), resources(head_p)
    grants = sorted(newly_granted(head, base))

    print("PER-GRANT JUSTIFICATION WORKLIST")
    print("=" * 74)
    print("Detection is LavaMoat's; each row below needs a REASON, not a category.")
    print("Justify with a permalink to the dependency's source at the installed version")
    print("(accept), or reject where no call site uses the capability.\n")

    if not grants:
        print("  (no new grants between base and head — nothing to justify)")
    else:
        for pkg, kind, cap in grants:
            mark = "!" if is_critical(pkg, cap) else " "
            print(f"  {mark}[ ] {pkg[:38]:40s} {kind[:3]}:{cap:22s}"
                  "  reason: <upstream file#Ln @ tag>   verdict: accept|REJECT")
        crit = [g for g in grants if is_critical(g[0], g[2])]
        print(f"\n  {len(grants)} grant(s) to justify"
              + (f"; {len(crit)} marked ! for escalation." if crit else "."))
        print("  A grant with no locatable call site is the finding — reject it.")

    if not over_p:
        return
    gen = resources(gen_p) if gen_p else head
    over = resources(over_p)
    widened, tightened, broad, write = audit_overrides(over, gen)

    print("\n\nOVERRIDE SCOPE AUDIT")
    print("=" * 74)
    print("Effective policy = mergePolicy(generated, override), stricter decisions winning.")
    print("The files are meant to differ: the generated one is regenerated on dependency")
    print("updates while the override persists. Entries below are scoped, not \"unobserved\".")
    print(f"{len(over)} package(s) overridden.\n")
    print(f"  tightened  {len(tightened):3d}  explicit false over an observed grant — containment narrowed")
    print(f"  persisting {len(widened):3d}  in the override only — expected, but each needs a standing reason")
    print(f"  broad      {len(broad):3d}  whole-object grant where only members were observed")
    print(f"  write      {len(write):3d}  write access — read may suffice")

    if broad:
        print("\n\nSUGGESTED TIGHTENINGS — evidence-based, functionality-preserving")
        print("-" * 74)
        print("A whole-object grant where the generated policy shows only members in use.")
        print("`validateHierarchy` REJECTS a policy containing both `X` and `X.y`, so narrowing")
        print("requires denying the parent explicitly — that is LavaMoat's documented form:")
        print("  \"You could set the parent to false if you intended a less permissive policy.\"")
        print("Regenerate and re-run the app after applying; an over-narrowed grant fails loudly.\n")
        for pkg, kind, cap, members in sorted(broad)[:20]:
            print(f"  {pkg}")
            narrowed = {cap: False}
            narrowed.update({m: True for m in members})
            print(f"    now:  \"{cap}\": true")
            print(f"    →     " + json.dumps(narrowed)[1:-1])
        if len(broad) > 20:
            print(f"\n  … {len(broad) - 20} further narrowable grant(s).")

    escalate = sorted(set(
        [(p, k, c) for p, k, c in widened if is_critical(p, c)] +
        [(p, k, c) for p, k, c in write]
    ))
    if escalate:
        write_set = set(write)
        chosen, inherited = partition_escalations(escalate, base, write_set)
        print("\n\nRAISE WITH A HUMAN — no verdict offered")
        print("-" * 74)
        print("These widen a capability class where a wrong call is not recoverable by a")
        print("follow-up PR, or grant write where read may suffice. Whether each is correct")
        print("depends on intent and threat model, neither of which is in the policy files.")
        print("This script stops here deliberately rather than guessing.\n")
        def row(pkg, kind, cap):
            why = "write access" if (pkg, kind, cap) in write_set else criticality(pkg, cap)
            print(f"  [?] {pkg[:42]:44s} {kind[:3]}:{cap:20s}  {why}")

        print(f"\nCHOSEN HERE — {len(chosen)} row(s), on a package the base already contained")
        if chosen:
            for pkg, kind, cap in chosen:
                row(pkg, kind, cap)
        else:
            print("  (none — every escalation below arrived with a new package)")

        if inherited:
            print(f"\nARRIVES WITH A NEWLY-CONTAINED PACKAGE — {len(inherited)} row(s)")
            print("  The package is new to this policy, so the grant follows from containing")
            print("  it. The question is whether the package belongs in this bundle, not")
            print("  whether the capability was correctly chosen.")
            # Write access is never truncated. It is the smallest and highest-signal
            # category, and a cap that hides it turns the section into a list whose
            # most important row is the one the reader cannot see.
            w = [r for r in inherited if r in write_set]
            rest = [r for r in inherited if r not in write_set]
            for pkg, kind, cap in w:
                row(pkg, kind, cap)
            for pkg, kind, cap in rest[:10]:
                row(pkg, kind, cap)
            if len(rest) > 10:
                print(f"      … {len(rest) - 10} further read-only row(s) of the same kind.")
        print(f"\n  {len(escalate)} decision(s) for a human. An audit that silently resolves")
        print("  these has substituted a guess for the thing it was asked to check.")


if __name__ == "__main__":
    main()
