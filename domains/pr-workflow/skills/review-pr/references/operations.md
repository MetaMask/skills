# Scripted operations

This registry is the complete terminal interface for `review-pr`. Resolve every path relative to the installed skill root. Run one checked-in script per terminal call. Native file reads, native searches, and read-only MCP tools remain available.

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

## Failure contract

Each script validates its arguments, invokes commands without a shell, emits JSON on standard output, and reports one named failure on standard error. A required terminal operation outside this registry produces a `BLOCKED` report with `missing: scripted operation <capability>`.
