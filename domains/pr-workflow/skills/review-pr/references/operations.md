# Scripted operations

This registry is the complete terminal interface for `review-pr`. Resolve every path relative to the installed skill root. Run one checked-in script per terminal call. Native file reads, native searches, read-only MCP tools, and native writes of the stored report and the approved review manifest outside the reviewed checkout remain available.

Open each `references/*.md` linked from the instruction file (`skill.md`, installed `SKILL.md`, or `RULE.md`) with the native file read tool, from that file's directory. The bash blocks below are the script paths to run.

The agent runs these operations through its terminal tool. User interaction is reserved for review decisions and publication approval.

## Check checkout cleanliness

```bash
node <skill-root>/scripts/check-worktree.mjs
```

Returns the exact porcelain status and a `clean` boolean for review preflight or postflight evidence.

## Peer pull request context

```bash
node <skill-root>/scripts/collect-pr-context.mjs <number-or-url>
```

Returns repository identity, pull request metadata, frozen SHAs, commits, checks, reviews, issue references, conversation comments, inline comments, and the exact diff.

## Self-review context

```bash
node <skill-root>/scripts/collect-self-review-context.mjs <included-or-excluded>
```

Returns repository identity, base and head SHAs, branch commits, changed paths, the committed diff, and staged and unstaged diffs when the working-tree argument is `included`.

## Ensure a peer head is readable locally

```bash
node <skill-root>/scripts/ensure-pr-head.mjs <pr-number> <expected-head-sha>
```

Checks the local object store first. When required, fetches the pull request head through the configured `origin`, then verifies that the fetched object matches the expected frozen SHA.

## Inspect one commit

```bash
node <skill-root>/scripts/inspect-commit.mjs <commit-sha>
```

Returns the frozen commit SHA, subject, parent SHAs, and changed paths.

## Read one file at a frozen revision

```bash
node <skill-root>/scripts/read-frozen-file.mjs <commit-sha> <repository-path>
```

Returns the file path, commit SHA, and full text content from the Git object store.

## Read selected JSON values at a frozen revision

```bash
node <skill-root>/scripts/read-frozen-json.mjs <commit-sha> <repository-path> <json-pointer> [json-pointer...]
```

Returns a map from each RFC 6901 JSON Pointer to its value. For example, `/dependencies/expo` and `/dependencies/react-native` select package versions without an interpreter expression or pipeline.

## Search a frozen tree

```bash
node <skill-root>/scripts/search-frozen-tree.mjs <commit-sha> <pattern> [repository-path...]
```

Returns bounded matching lines with paths and line numbers. The script treats the pattern as a fixed string and limits output to 500 matches.

## Create a pending GitHub review

After the user approves the exact displayed review body and inline comments, write this manifest to a temporary JSON file outside the reviewed checkout:

```json
{
  "schemaVersion": 1,
  "headSha": "<frozen 40-character head SHA>",
  "body": "<review summary>",
  "comments": [
    {
      "path": "<changed repository path>",
      "line": 42,
      "side": "RIGHT",
      "body": "<inline review comment>"
    }
  ]
}
```

An inline comment may add `startLine` and `startSide` for a multiline range. `LEFT` addresses deleted lines; `RIGHT` addresses additions and context lines. A summary-only pending review uses an empty `comments` array.

```bash
node <skill-root>/scripts/create-pending-review.mjs <pr-url> <temporary-manifest-path>
```

The operation validates the manifest, confirms the pull request still has the frozen head, detects an existing pending review for the authenticated user, and creates one GitHub review with `event` omitted. Return its URL, then remove the temporary manifest with the native file tool. The review stays `PENDING`. The user inspects the file comments in GitHub's **Files changed** view.

## Submit the pending GitHub review

After the user replies to publish, submit that same pending review. Resend its stored summary so the summary and the file comments become public together. `COMMENT` is the event when the reply does not name another one.

```bash
node <skill-root>/scripts/submit-pending-review.mjs <pr-url> <COMMENT|APPROVE|REQUEST_CHANGES>
```

The operation finds the authenticated user's single pending review, confirms its summary and the current head SHA, and submits it through the reviews events endpoint. Return the submitted review URL.

## Failure contract

Each script validates its arguments, invokes commands without a shell, emits JSON on standard output, and reports one named failure on standard error. A required terminal operation outside this registry produces a `BLOCKED` report with `missing: scripted operation <capability>`.

A `github.com` or `raw.githubusercontent.com` page is outside this registry, including blob, pull, commit, and files views. Read peer data through `collect-pr-context.mjs` or the GitHub MCP adapter in [providers.md](providers.md). Read a cited file through `read-frozen-file.mjs`, `read-frozen-json.mjs`, or `search-frozen-tree.mjs`. A failed read stays `failed` or `BLOCKED`.
