#!/usr/bin/env python3
"""Retention review, scoped to a diff. For each file+patch: find every retention
primitive, pair each acquire with its release IN THE SAME FILE, and mark each
NEW (line appears in the patch's added lines) or pre-existing. Charge only NEW
un-paired primitives; report pre-existing separately. Re-runnable: inputs are
the head files and the PR patch, both fetched from the repo by ref.

Three outcomes, never two: paired (ok), un-paired (OPEN), and not examined (SKIP).
Every NEW line carrying an acquire form from skill.md's primitive table is either
examined by a pairing pass or printed as not examined, and the totals print as
N of M, so a partial scan cannot read as a clean one."""
import re, sys

# Acquire forms from skill.md's primitive table. Module singletons have no syntactic
# form, so no line is counted for them and the summary names them as unscanned.
ACQUIRE=re.compile(r'\.(?:on|once|addListener|addEventListener|subscribe|set|push|add)\('
                   r'|\.on[A-Z]\w*\(|\.add[A-Z]\w*Listener\(|\bset(?:Interval|Timeout)\(|\bnew (?:Map|Set)\b')

def added_lines(patch_path):
    out=set()
    for l in open(patch_path):
        if l.startswith('+') and not l.startswith('+++'):
            out.add(l[1:].strip())
    return out

def scan(src_path, patch_path):
    src=open(src_path).read(); lines=src.split('\n'); added=added_lines(patch_path)
    rows=[]; examined=set()
    # listeners: pair .on(ev,handler) with .removeListener(ev,handler)
    for m in re.finditer(r'(\w+)\.(?:on|addListener)\(\s*[\'"](\w+)[\'"]\s*,\s*(\w+)', src):
        emitter,ev,handler=m.groups(); ln=src[:m.start()].count('\n')+1
        acquire_line=lines[ln-1].strip()
        new = acquire_line in added
        rem=re.search(r'\.(?:removeListener|off)\(\s*[\'"]'+ev+r'[\'"]\s*,\s*'+handler, src)
        if rem:
            rln=src[:rem.start()].count('\n')+1
            ctx=src[max(0,rem.start()-140):rem.start()]
            onclose='Closed' in ctx or 'close' in ctx
            rows.append((new,'ok',f"{emitter}.on('{ev}', {handler})",ln,
                         f"removeListener L{rln}"+(" on stream close" if onclose else "")))
        else:
            rows.append((new,'OPEN',f"{emitter}.on('{ev}', {handler})",ln,"no removeListener in file"))
    # named-subscription listeners: onXxx(handler) / subscribe(handler) / addXxxListener(handler).
    # The quoted-event form above cannot see these — the method name carries the event, and
    # there is no event-name argument to pair on. Missing them yields a clean verdict over a
    # real unpaired listener (observed: background.onNotification on extension#42823).
    for m in re.finditer(
        r'(\w+)\.(on[A-Z]\w*|subscribe|addEventListener|add[A-Z]\w*Listener)\(\s*([\w.]+)\s*[,)]',
        src):
        emitter, method, handler = m.groups()
        if method in ('on', 'addListener'):
            continue                      # already covered by the quoted-event pass
        ln = src[:m.start()].count('\n') + 1
        new = lines[ln - 1].strip() in added
        # Release forms that correspond to this acquire form.
        if method.startswith('on'):
            rel = ['remove' + method[0].upper() + method[1:], 'off' + method[2:]]
        elif method == 'subscribe':
            rel = ['unsubscribe']
        elif method == 'addEventListener':
            rel = ['removeEventListener']
        else:
            rel = ['remove' + method[3:]]
        found = None
        for r in rel:
            rm = re.search(re.escape(r) + r'\(', src)
            if rm:
                found = (r, src[:rm.start()].count('\n') + 1)
                break
        label = f"{emitter}.{method}({handler})"
        if found:
            rows.append((new, 'ok', label, ln, f"{found[0]} L{found[1]}"))
        else:
            rows.append((new, 'OPEN', label, ln,
                         "no " + "/".join(rel) + " in file"))

    # Map registries: any name assigned a `new Map`, .set paired with .delete (or .clear).
    # Matching the Map rather than a name like `pending`/`requests` keeps the pass from
    # taking the shape of the one registry it was first written against.
    for m in re.finditer(r'(#?\w+)\s*[=:][^\n]*?\bnew Map\b', src):
        name=m.group(1); ln=src[:m.start()].count('\n')+1
        new=lines[ln-1].strip() in added
        ref=r'(?<![\w#])'+re.escape(name)
        sets=list(re.finditer(ref+r'\.set\(', src))
        delm=re.search(ref+r'\.delete\(', src) or re.search(ref+r'\.clear\(', src)
        examined.update(src[:s.start()].count('\n')+1 for s in sets)
        if sets:
            sln=src[:sets[0].start()].count('\n')+1
            if delm:
                rows.append((new,'ok',f"{name}  (.set L{sln})",ln,
                             f".{delm.group(0).split('.')[-1][:-1]} L{src[:delm.start()].count(chr(10))+1}"))
            else:
                rows.append((new,'OPEN',f"{name}  (.set L{sln})",ln,"no .delete or .clear, so entries accumulate"))
        else:
            examined.add(ln)
    examined.update(r[3] for r in rows)
    # NEW acquire-shaped lines, and the ones no pass above examined.
    acquires=[(i+1,l.strip()) for i,l in enumerate(lines) if l.strip() in added and ACQUIRE.search(l)]
    return rows, acquires, [a for a in acquires if a[0] not in examined]

print("RETENTION REVIEW — scoped to the supplied diff  (re-run: retention-scan.py <file>:<patch> [...])")
print("="*74)
new_open=0; new_ok=0; acq_total=0; skipped_total=0; unread=[]
for pair in sys.argv[1:]:
    f,patch=pair.split(':')
    print(f"\n{f.split('/')[-1]}")
    try:
        rows,acquires,skipped=scan(f,patch)
    except OSError as e:
        unread.append(f)
        print(f"  NOT EXAMINED: cannot read {e.filename}")
        continue
    for new,mark,what,ln,status in sorted(rows, key=lambda r:(not r[0], r[3])):
        tag='NEW' if new else 'pre-exist'
        if new and mark=='OPEN': new_open+=1
        if new and mark=='ok': new_ok+=1
        print(f"  [{tag:9}] {mark:4} L{ln}: {what}")
        print(f"                   -> {status}")
    for ln,text in skipped:
        print(f"  [{'NEW':9}] SKIP L{ln}: {text}")
        print(f"                   -> no pairing pass matched this acquire: not examined")
    print(f"  NEW acquire-shaped lines examined: {len(acquires)-len(skipped)} of {len(acquires)}")
    acq_total+=len(acquires); skipped_total+=len(skipped)
print()
n=len(sys.argv)-1
print(f"Files read: {n-len(unread)} of {n}")
print(f"NEW acquire-shaped lines examined: {acq_total-skipped_total} of {acq_total}   NEW primitives: {new_ok} paired, {new_open} open")
print("No pass: module singleton / cache (no syntactic form). Timers, arrays and Sets are counted above but never paired.")
if new_open:
    verdict=f"{new_open} NEW un-paired primitive(s) → escalate to a heap snapshot (Phase 2)"
elif unread or skipped_total:
    verdict=(f"no NEW un-paired primitive among those examined, but {skipped_total} NEW acquire-shaped line(s) "
             f"and {len(unread)} file(s) were not examined. Not a clean result.")
elif acq_total==0:
    verdict="no NEW acquire-shaped line in the supplied files. Nothing was paired."
else:
    verdict=f"every NEW acquire-shaped line was examined ({acq_total} of {acq_total}) and every NEW primitive is paired"
print("VERDICT:", verdict)
