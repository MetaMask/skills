#!/usr/bin/env bash
#
# Control matrix for the emit-time gate. Run it from anywhere; it copies the hook to a
# directory with no sibling scripts/ so `_find_gate()` resolves the way it does in
# production rather than the way it does in a checkout.
#
# It exists because three copies of this hook were on one machine, the oldest was the one
# wired into settings, and it had no `gh api` matcher — so every publish through that path
# went ungated for weeks while two newer copies sat unused. Nothing noticed, because a gate
# that blocks nothing is indistinguishable from a gate with nothing to block.
#
# Positives must block (exit 2). Negatives must pass (exit 0). Both halves matter: a gate
# that blocks everything is as broken as one that blocks nothing, and only the negative
# arm catches it.
set -uo pipefail
HOOK="${1:-$(cd "$(dirname "$0")" && pwd)/pr-evidence-gate.py}"
[ -f "$HOOK" ] || { echo "usage: gate-controls.sh [path/to/pr-evidence-gate.py]" >&2; exit 2; }

tmp="$(mktemp -d)"; trap 'rm -rf "$tmp"' EXIT
cp "$HOOK" "$tmp/hook.py"

printf '<!-- LAVAMOAT_DILIGENCE_START -->\n**LavaMoat grants — x**\n\n```\n$ yarn build\n  exit 0\n```\n<!-- LAVAMOAT_DILIGENCE_END -->\n' > "$tmp/bad.md"
printf 'Addressed: see the linked run.\n' > "$tmp/reply.md"
# The enrichment rule needs the REPORT shape, not report vocabulary: three or more
# paragraphs, a cited link, and no reply-template opener. A one-line probe passes it for
# the wrong reason, which is how a mis-specified positive arm reads as a working rule.
cat > "$tmp/finding.md" <<'BODY'
The migration path is ground-truthed against the fixture set and rules out the ordering hazard.

Two of the three cases resolve through the same upstream guard, so the remaining exposure is
the un-guarded third: https://github.com/o/r/blob/abc123/src/migrate.ts#L40

That leaves the rollback lane unaccounted for, which is worth its own pass before this lands.
BODY
# Addressing people is the one violation that cannot be walked back, so it gets both arms.
# The handles here are synthetic on purpose: a fixture that names a real account would page
# them the moment anyone pasted this file's contents into a body.
printf 'Ready for another look — @nobody-example-0000 can you take it from here?\n' > "$tmp/mention.md"
printf 'Pinned the workflow to @v6 so the step resolves the same way on every run.\n' > "$tmp/actionpin.md"

probe() { printf '{"tool_name":"Bash","tool_input":{"command":%s}}' "$(python3 -c 'import json,sys;print(json.dumps(sys.argv[1]))' "$1")"; }

fails=0
check() { # name expected command
  local name="$1" want="$2" cmd="$3" got
  probe "$cmd" | python3 "$tmp/hook.py" >/dev/null 2>&1; got=$?
  if [ "$got" = "$want" ]; then printf '  ok    %-34s exit=%s\n' "$name" "$got"
  else printf '  FAIL  %-34s exit=%s want=%s\n' "$name" "$got" "$want"; fails=$((fails+1)); fi
}

# ── wiring ───────────────────────────────────────────────────────────────────────
# The arms below prove the SCRIPT works. They say nothing about whether anything calls
# it, and those are different questions: a hook that is not wired, or wired to a path
# that no longer exists, is indistinguishable from a hook with nothing to block. One
# session ran to completion with every PreToolUse hook inert — 306 certification markers
# written, none of them enforcing anything — because nobody asked this question.
wiring() {
  local found=0
  # $HOME is not necessarily the login home — an account-switching setup points it at a
  # per-account directory, which is exactly the case this was first run in. Enumerating
  # from $HOME alone found one config, reported it as "the" wiring, and never looked at
  # the other. Derive the roots instead, and de-duplicate by realpath so a symlinked
  # config is not counted twice or missed once.
  local roots=() seen=() r
  for r in "$HOME" "$(getent passwd "$(id -un)" | cut -d: -f6)" /home/*/ ; do
    [ -d "$r" ] || continue
    roots+=("$r/.claude/settings.json")
    for a in "$r"/.claude-accts/*/.claude/settings.json; do [ -f "$a" ] && roots+=("$a"); done
  done
  for cfg in "${roots[@]}"; do
    [ -f "$cfg" ] || continue
    local rp; rp=$(readlink -f "$cfg")
    case " ${seen[*]} " in *" $rp "*) continue ;; esac
    seen+=("$rp")
    local cmd
    cmd=$(python3 -c '
import json,sys
try: d=json.load(open(sys.argv[1]))
except Exception: sys.exit(0)
out=[]
def w(o):
    if isinstance(o,dict):
        for k,v in o.items():
            if k=="command" and isinstance(v,str) and "pr-evidence-gate" in v: out.append(v)
            else: w(v)
    elif isinstance(o,list):
        [w(x) for x in o]
w(d.get("hooks",{}))
print(out[0] if out else "")' "$cfg")
    [ -n "$cmd" ] || continue
    found=1
    local path; path=$(printf '%s' "$cmd" | grep -oE '[^ "]*pr-evidence-gate\.py')
    path="${path/\$HOME/$HOME}"
    if [ -f "$path" ]; then printf '  ok    wired: %s\n' "${cfg/#$HOME/~}"
    else printf '  FAIL  wired to a missing file: %s → %s\n' "${cfg/#$HOME/~}" "$path"; fails=$((fails+1)); fi
  done
  [ "$found" = 1 ] || { printf '  FAIL  no settings file registers the gate as a PreToolUse hook\n'; fails=$((fails+1)); }
}

echo "gate-controls: $HOOK"
wiring
check "positive: gh api body write"   2 "gh api repos/o/r/issues/comments/1 -X PATCH -F body=@$tmp/bad.md"
check "positive: gh pr comment"       2 "gh pr comment 1 --repo o/r --body-file $tmp/bad.md"
check "positive: finding via comment" 2 "gh issue comment 1 --repo o/r --body-file $tmp/finding.md"
check "negative: unrelated command"   0 "ls -la"
check "negative: gh read, no body"    0 "gh pr view 1 --repo o/r"
check "negative: a reply is a reply"  0 "gh issue comment 1 --repo o/r --body-file $tmp/reply.md"

# The mentions check runs over the WHOLE body rather than the evidence-scoped paragraphs,
# so its positive arm is a body that violates nothing else — proving the block comes from
# the handle and not from something the other checks would have caught anyway. The negative
# arm is the shape that shares the syntax and pages nobody: an action pin. Without it, a
# rule that blocked every `@` at all would look identical here.
check "positive: body addresses a person" 2 "gh pr comment 1 --repo o/r --body-file $tmp/mention.md"
check "negative: @v6 action pin"          0 "gh pr comment 1 --repo o/r --body-file $tmp/actionpin.md"

# The gate reads the command as text, so a body it cannot resolve is a body it cannot
# check. These three are how an entire session of publishes went ungated while every
# other arm above was green: the path was assembled from a shell variable each time.
check "positive: body path via \$VAR"     2 'gh pr comment 1 --repo o/r --body-file $D/c.md'
check "positive: body via \$(cat ...)"    2 'gh pr comment 1 --repo o/r --body "$(cat c.md)"'
check "positive: gh api body via \$VAR"   2 'gh api repos/o/r/issues/1/comments -F body=@$D/c.md' 

echo
if [ "$fails" -eq 0 ]; then
  echo "gate-controls: all arms behave, and the gate is wired"
  echo
  echo "Wiring is not liveness. This proves a settings file names an existing file; it"
  echo "cannot prove the running session loaded it. For that, run a command the gate must"
  echo "block and confirm it is blocked — in a session, not here."
  exit 0
fi
echo "gate-controls: $fails arm(s) wrong — the gate is not doing what it claims"; exit 1
