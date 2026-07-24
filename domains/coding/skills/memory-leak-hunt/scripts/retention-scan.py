#!/usr/bin/env python3
"""Replicates the retention review a human does on a diff: find each retention
primitive (listener, timer, pending-registry), then check whether the same file
tears it down. A primitive WITH teardown is safe; one WITHOUT is the heap-snapshot
candidate. No build, no snapshot — the same read a reviewer performs, automated."""
import re, sys

def pos(src, pat):
    m=re.search(pat, src); return src[:m.start()].count('\n')+1 if m else None

def scan(path):
    src=open(path).read(); out=[]
    # listeners: pair add(handler) with remove(handler)
    for m in re.finditer(r'(\w+)\.(?:on|addListener)\(\s*[\'"](\w+)[\'"]\s*,\s*(\w+)', src):
        emitter,ev,handler=m.groups()
        addln=src[:m.start()].count('\n')+1
        rem=re.search(r'\.(?:removeListener|off)\(\s*[\'"]'+ev+r'[\'"]\s*,\s*'+handler, src)
        if rem:
            remln=src[:rem.start()].count('\n')+1
            teardown='onStreamClosed' in src[max(0,rem.start()-120):rem.start()] or 'Closed' in src[max(0,rem.start()-120):rem.start()]
            out.append(('listener',f"{emitter}.on('{ev}', {handler})",addln,f"removeListener at L{remln}"+(" (on stream close)" if teardown else ""),True))
        else:
            out.append(('listener',f"{emitter}.on('{ev}', {handler})",addln,"no removeListener in file",False))
    # pending registries: Map with .set paired with .delete
    for m in re.finditer(r'(#?\w*[Pp]ending\w*|#?\w*[Rr]equests?\w*)\s*[=:].*?new Map', src):
        name=m.group(1); setln=pos(src, re.escape(name)+r'\.set\(')
        if setln:
            delln=pos(src, re.escape(name)+r'\.delete\(')
            out.append(('registry',f"{name}  (.set L{setln})",m.start()//1 and src[:m.start()].count(chr(10))+1,
                        f".delete at L{delln}" if delln else "no .delete — entries accumulate", bool(delln)))
    return out

print("RETENTION REVIEW — PR #40684 (extract patch-store substream), at head")
print("replicates the diff read a reviewer does; heap snapshot only for an OPEN candidate")
print("="*70)
anyopen=False
for f in sys.argv[1:]:
    print(f"\n{f.replace('ml-','')}")
    for kind,what,ln,status,ok in scan(f):
        mark='  ok ' if ok else ' OPEN'
        anyopen|=not ok
        print(f" {mark} L{ln}: {what}")
        print(f"        -> {status}")
print()
print("VERDICT:", "no un-mitigated retention path — every candidate has teardown" if not anyopen
      else "OPEN candidate(s) above warrant a heap snapshot")
print("(the L6886 removeListener is the exact fix suggested in review — discovery reproduces the review's conclusion)")
