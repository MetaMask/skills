#!/usr/bin/env python3
"""Retention review, scoped to a diff. For each file+patch: find every retention
primitive, pair each acquire with its release IN THE SAME FILE, and mark each
NEW (line appears in the patch's added lines) or pre-existing. Charge only NEW
un-paired primitives; report pre-existing separately. Re-runnable: inputs are
the head files and the PR patch, both fetched from the repo by ref."""
import re, sys

def added_lines(patch_path):
    out=set()
    try:
        for l in open(patch_path):
            if l.startswith('+') and not l.startswith('+++'):
                out.add(l[1:].strip())
    except FileNotFoundError:
        pass
    return out

def scan(src_path, patch_path):
    src=open(src_path).read(); lines=src.split('\n'); added=added_lines(patch_path)
    rows=[]
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
    # pending registries: Map with set paired with delete
    for m in re.finditer(r'(#?\w*[Pp]ending\w*|#?\w*[Rr]equests?\w*)\s*[=:][^\n]*new Map', src):
        name=m.group(1); ln=src[:m.start()].count('\n')+1
        new=lines[ln-1].strip() in added
        setm=re.search(re.escape(name)+r'\.set\(', src); delm=re.search(re.escape(name)+r'\.delete\(', src)
        if setm:
            sln=src[:setm.start()].count('\n')+1
            if delm:
                rows.append((new,'ok',f"{name}  (.set L{sln})",ln,f".delete L{src[:delm.start()].count(chr(10))+1}"))
            else:
                rows.append((new,'OPEN',f"{name}  (.set L{sln})",ln,"no .delete — entries accumulate"))
    return rows

print("RETENTION REVIEW — PR #40684, scoped to the diff  (re-run: retention-scoped.py <file> <patch>)")
print("="*74)
new_open=0
for pair in sys.argv[1:]:
    f,patch=pair.split(':')
    print(f"\n{f.split('/')[-1]}")
    for new,mark,what,ln,status in sorted(scan(f,patch), key=lambda r:(not r[0], r[3])):
        tag='NEW' if new else 'pre-exist'
        if new and mark=='OPEN': new_open+=1
        print(f"  [{tag:9}] {mark:4} L{ln}: {what}")
        print(f"                   -> {status}")
print()
print("VERDICT:", "no retention path INTRODUCED — every NEW primitive is torn down; no heap snapshot warranted"
      if new_open==0 else f"{new_open} NEW un-paired primitive(s) → escalate to a heap snapshot (Phase 2)")
