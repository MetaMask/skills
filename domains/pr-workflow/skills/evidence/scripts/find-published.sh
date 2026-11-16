#!/usr/bin/env bash
# Where does a marker actually live on a PR? A pull request has THREE comment
# collections, and searching two of them and reporting "not posted" is a negative
# claim carrying the scope of its search:
#
#   1. issue comments   /issues/{n}/comments        — the conversation tab
#   2. review comments  /pulls/{n}/comments         — anchored to a diff line
#   3. review bodies    /pulls/{n}/reviews          — the summary of a review
#
# On 2026-08-14 a diligence body was reported unposted for several turns because it
# lived in (3) and only (1) and (2) had been queried. A duplicate was nearly published.
#
# usage: find-published.sh <owner/repo> <pr> <marker-regex>
set -euo pipefail
REPO="${1:?owner/repo}"; PR="${2:?pr number}"; PAT="${3:?marker regex}"
FOUND=0
row() { printf '  %-16s %-12s %s\n' "$1" "$2" "$3"; }
echo "searching all three comment collections of $REPO#$PR for /$PAT/"
while IFS=$'\t' read -r id url; do
  [ -n "${id:-}" ] || continue; FOUND=$((FOUND+1)); row "issue comment" "$id" "$url"
done < <(gh api "repos/$REPO/issues/$PR/comments" --paginate \
  -q ".[] | select(.body|test(\"$PAT\")) | \"\(.id)\t\(.html_url)\"" 2>/dev/null)
while IFS=$'\t' read -r id url; do
  [ -n "${id:-}" ] || continue; FOUND=$((FOUND+1)); row "review comment" "$id" "$url"
done < <(gh api "repos/$REPO/pulls/$PR/comments" --paginate \
  -q ".[] | select(.body|test(\"$PAT\")) | \"\(.id)\t\(.html_url)\"" 2>/dev/null)
while IFS=$'\t' read -r id url; do
  [ -n "${id:-}" ] || continue; FOUND=$((FOUND+1)); row "review body" "$id" "$url"
done < <(gh api "repos/$REPO/pulls/$PR/reviews" --paginate \
  -q ".[] | select((.body//\"\")|test(\"$PAT\")) | \"\(.id)\t\(.html_url)\"" 2>/dev/null)
if [ "$FOUND" -eq 0 ]; then
  echo "  no match in any of the three — this negative claim is now scoped to all of them"
  exit 1
fi
echo "  $FOUND match(es) — publishing again would duplicate"
