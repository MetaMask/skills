#!/usr/bin/env python3
"""List a PR's requested reviewers that no CODEOWNERS rule requires for its current diff.

Usage: unrequired-reviewers.py <owner/repo> <pr-number>

Reads CODEOWNERS from the PR's base branch (the file GitHub uses), matches every changed
file with last-match-wins semantics, and prints each requested user or team no file needs.
A reviewer the user added by name stays even when unrequired; this script cannot know
which those are, so it lists and does not remove.
"""
import base64, json, re, subprocess, sys


def gh(*args):
    return subprocess.run(["gh", "api", *args], capture_output=True, text=True, check=True).stdout


def compile_pat(p):
    anchored = p.startswith("/")
    p = p.lstrip("/")
    if p.endswith("/"):
        p += "**"
    rx, i = "", 0
    while i < len(p):
        if p[i:i + 3] == "**/":
            rx += "(?:.*/)?"; i += 3
        elif p[i:i + 2] == "**":
            rx += ".*"; i += 2
        elif p[i] == "*":
            rx += "[^/]*"; i += 1
        elif p[i] == "?":
            rx += "[^/]"; i += 1
        else:
            rx += re.escape(p[i]); i += 1
    if not anchored and "/" not in p.rstrip("*").rstrip("/"):
        rx = "(?:.*/)?" + rx
    return re.compile("^" + rx + "(?:/.*)?$")


def required(codeowners, files):
    rules = []
    for line in codeowners.splitlines():
        line = line.split("#", 1)[0].strip()
        if line:
            pat, *owners = line.split()
            rules.append((compile_pat(pat), [o for o in owners if o.startswith("@")]))
    need = set()
    for f in files:
        owners = None
        for rx, own in rules:
            if rx.match(f):
                owners = own
        for o in owners or []:
            need.add(o.split("/", 1)[-1].lstrip("@").lower())
    return need


def main():
    repo, num = sys.argv[1], sys.argv[2]
    pr = json.loads(gh("repos/%s/pulls/%s" % (repo, num)))
    co = json.loads(gh("repos/%s/contents/.github/CODEOWNERS?ref=%s" % (repo, pr["base"]["ref"])))
    files = gh("--paginate", "repos/%s/pulls/%s/files" % (repo, num), "--jq", ".[].filename").split()
    need = required(base64.b64decode(co["content"]).decode(), files)
    req = json.loads(gh("repos/%s/pulls/%s/requested_reviewers" % (repo, num)))
    extra = [("team", t["slug"]) for t in req["teams"] if t["slug"].lower() not in need]
    extra += [("user", u["login"]) for u in req["users"] if u["login"].lower() not in need]
    for kind, name in extra:
        print("%s %s" % (kind, name))
    return 0


if __name__ == "__main__":
    sys.exit(main())
