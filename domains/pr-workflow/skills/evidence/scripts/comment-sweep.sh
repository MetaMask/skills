#!/usr/bin/env bash
# comment-sweep.sh — inventory my own issue comments and flag the ones that do
# nothing a body edit could not.
#
# WHY THIS EXISTS
#
# The rule (a comment must do something a body edit cannot) is
# enforced at write time by hooks/pr-evidence-gate.py. A write-time gate only
# ever sees the NEXT comment. The comments already published have no path at
# all, and a postmortem that counts them is not a postmortem that removes them:
# on 2026-08-11 an inventory found seven, named all three shapes, and left every
# one in place. This script is the missing path.
#
# Read-only. It prints a triage list and never mutates anything.
#
#   comment-sweep.sh                      # both default repos, open issues
#   comment-sweep.sh MetaMask/some-repo   # one repo
#   AUTHOR=someone comment-sweep.sh       # someone else's comments
#
# Exit 1 when anything is flagged, so it can gate a loop tick.

set -euo pipefail

AUTHOR="${AUTHOR:-$(gh api user --jq .login)}"
REPOS=("$@")
if [[ ${#REPOS[@]} -eq 0 ]]; then
    REPOS=(MetaMask/metamask-extension MetaMask/MetaMask-planning)
fi

# Each shape is a comment whose entire payload is a fact about the author's
# editing process rather than about the subject.
#
#   tombstone  — the content moved to the body and this is what is left. Strictly
#                worse than both alternatives: it keeps the notification noise of
#                a comment while destroying what the comment said.
#   provenance — "filed from", "split out of", "tracked in". Belongs in the body,
#                where a reader arriving cold looks.
#   register   — text shaped like an action ("flagging", "bumping", "requesting")
#                that notifies nobody and changes no state.
TOMBSTONE='superseded|folded into|moved to the (issue )?body|no longer (relevant|applies)|obsolete now|see the (issue )?body'
PROVENANCE='^(filed|split|extracted|carved) (from|out of)|^tracked in|^follow-?up (from|to) '
REGISTER='^(flagging|bumping|requesting|escalating|pinging|raising) '

flagged=0
total=0

for repo in "${REPOS[@]}"; do
    numbers="$(gh search issues --repo "$repo" --author "$AUTHOR" --state open \
                  --limit 100 --json number --jq '.[].number' 2>/dev/null || true)"
    [[ -z "${numbers}" ]] && continue

    while read -r n; do
        [[ -z "$n" ]] && continue
        gh api "repos/${repo}/issues/${n}/comments" --paginate \
            --jq ".[] | select(.user.login==\"${AUTHOR}\")
                  | [\"${repo}#${n}\", (.id|tostring), (.body|length|tostring),
                     (.created_at != .updated_at|tostring), .html_url,
                     (.body|gsub(\"\\n\";\" \"))] | @tsv" 2>/dev/null || true
    done <<< "${numbers}"
done > /tmp/.comment-sweep.$$

while IFS=$'\t' read -r ref id len edited url body; do
    [[ -z "${ref:-}" ]] && continue
    total=$((total + 1))
    shape=""
    lower="$(printf '%s' "${body}" | tr '[:upper:]' '[:lower:]')"
    if [[ "${lower}" =~ $TOMBSTONE ]]; then
        shape="tombstone"
    elif [[ "${lower}" =~ $PROVENANCE ]]; then
        shape="provenance"
    elif [[ "${lower}" =~ $REGISTER ]]; then
        shape="register"
    fi
    [[ -z "${shape}" ]] && continue

    flagged=$((flagged + 1))
    printf '\n[%s] %s  (%s chars%s)\n' "${shape}" "${ref}" "${len}" \
        "$([[ "${edited}" == "true" ]] && printf ', EDITED — original text is gone')"
    printf '  %s\n' "${url}"
    printf '  %s\n' "${body:0:160}"
done < /tmp/.comment-sweep.$$
rm -f /tmp/.comment-sweep.$$

printf '\n---\n%s of %s comment(s) flagged.\n' "${flagged}" "${total}"

if [[ ${flagged} -gt 0 ]]; then
    cat <<'EOF'

Each flagged comment gets one of three dispositions. Deleting is irreversible and
is the user's call, so present the list and ask — do not delete unprompted.

  DELETE   the content is in the body and the comment adds nothing. A deleted
           comment leaves no row; a tombstone leaves a row that says only that
           there used to be one.

  REWRITE  keep it only if it carries something the body cannot: a RETRACTION
           (the reader was notified of a claim that is now withdrawn) or a
           reply to a specific person. Then it must read standalone — state the
           claim being withdrawn, not that something was "superseded".

  LEAVE    it notified a real subscriber set, timestamped a real event, or
           replied to someone. Those are the three powers a body edit lacks.

EOF
    exit 1
fi
