---
name: dependency-bump-audit
description: Audit a dependency-bump branch or PR in any JS/TS repo — npm, yarn, or pnpm; service or app — and prove each bump is safe against the repo's own code rather than trusting its semver label. Use when reviewing CVE, Dependabot, or security-motivated bumps, routine dependency upgrades or lockfile refreshes, when asked "is this bump safe?" or "audit these package changes for breaking changes", or when a patch/minor bump needs evidence-based sign-off before merge.
maturity: experimental
---

# Dependency Bump Audit

Applying dependency bumps is easy; proving they break nothing is the hard part. Teams get burnt by bumps labelled patch or minor that carried breaking or behaviour changes and broke real flows. This skill audits a bump branch against the repo's own code and produces evidence-backed verdicts, so "safe to merge" is a conclusion, not a guess.

Two principles carry the whole method:

1. **Audit resolved versions, not manifest ranges.** The manifest says what is allowed; the lockfile says what ships. A one-line "patch" bump in the manifest can drag ten transitive minors behind it, a resolutions/overrides block can force a package past an exact pin another package chose deliberately, and a base-image bump can swap the toolchain every install runs under.
2. **Patch and minor labels are claims, not facts.** Review every release between the old and new version — not just the endpoints — and verify each flagged change against how *this* repo actually uses the package.

## When To Use

- A bump PR or branch needs sign-off: CVE or Dependabot or other security-motivated bumps, routine dependency upgrades, lockfile refreshes, toolchain/image bumps that change installed packages.
- "Is this bump safe?", "audit these package changes for breaking changes", "review this Dependabot PR", "can we merge this dependency update?"
- The repo is JS/TS with npm, yarn (classic or berry), or pnpm — a service, an app, a monorepo, any of them.

Out of scope: performing the bumps themselves (recommend follow-ups; don't rewrite the branch under audit), and non-JS ecosystems (a different skill's territory if one exists).

## Prerequisites

- The branch/PR to audit and its base (usually `origin/main`); `git fetch origin` first and confirm the head.
- Node plus the repo's own package manager; `gh` authenticated (release notes, commit compares).
- Network access to the public npm registry and GitHub.
- A scratch area under `/tmp` for empirical probes; the audited checkout stays read-only.

## Workflow

### Step 1 — Inventory from the lockfile diff

```bash
git diff origin/main...HEAD -- 'package.json' '**/package.json' 'yarn.lock' 'package-lock.json' 'pnpm-lock.yaml' '**/pnpm-lock.yaml'
```

Diff the lockfiles, not the manifests, and extract for **every entry whose resolved version changes**:

- old → new resolved version, and semver class (patch / minor / major)
- direct or transitive, and who pulls it in: `yarn why <pkg>`, `npm explain <pkg>`, `pnpm why <pkg>`
- prod (ships in the built artifact or container, or runs at deploy time) or dev-only
- **new coexisting copies**: a lockfile can hold two versions of a package side by side. A new entry while the old one remains is a *new copy*, not an upgrade — record who consumes each copy
- range-only edits (the resolved version is identical on both sides) are no-ops — list them as such, don't inflate the inventory

**Forced overrides/resolutions of an exact pin are the highest-risk signal.** If the branch's `resolutions` / `overrides` forces a package to a version another package pinned *exactly*, that consumer never ran against the forced version. Treat as high risk until proven otherwise, and note that any future bump of the pinning package silently re-tests the override.

**Include tooling outside the lockfile:** Dockerfile base images, global tool installs (for example `npm i -g npm@x` inside a Dockerfile), CI image bumps. A global package-manager bump is frequently the *actual* source of an image scanner's CVE finding, and it changes the environment every build runs in. For each, check whether the tool is even invoked at runtime (CMD/entrypoint) or only at build time.

Build an inventory table up front — one row per change, columns: package, old → new, semver, direct/transitive (via), prod/dev, notable changes in range, reaches our code? (file:line), risk. Reading a large lockfile diff as prose hides changes; the table is the audit's backbone.

### Step 2 — Read upstream notes for EVERY version in the range

Not only old and new: a bump 1.2.3 → 1.2.6 must account for 1.2.4 and 1.2.5 too. Sources, in preference order:

- GitHub releases: `gh api "repos/<owner>/<repo>/releases"` (map the npm package to its repo with `npm view <pkg> repository`)
- the repo's CHANGELOG
- `gh api "repos/<owner>/<repo>/compare/<old>...<new>"` for the commit-by-commit diff when notes are thin — a "dependency-bump-only" release shows up as a diff touching only `package.json` and lockfiles, which is strong evidence of no behaviour change

Cumulative checklist of what counts as a behaviour change across the range:

- changed defaults, options, or configuration semantics
- validation strictness — rejecting what it used to accept, or accepting what it used to reject
- error types, codes, messages, or status fields (callers match on these)
- response, header, or body shapes; serialization output
- removed, renamed, or re-typed public APIs
- engine / minimum-Node bumps
- new peer dependencies
- ESM/CJS module-format changes
- correctness fixes — fixing "wrong" behaviour is still a behaviour change; someone may depend on the wrong behaviour

Also scan releases shipped *after* the bump range (footnote, not blocker): a follow-up security fix for the same class of issue may have landed days later. Note whether the repo's usage is affected and whether the manifest range will absorb it on the next refresh.

### Step 3 — Map every flagged change into the repo's code

For each package with a flagged change:

- `rg` its usage with file:line for every site you checked — imports, config files, bootstrap, registration sites, scripts, tests.
- Decide **reachability**: is the package loaded on the request path? Reached only through another library's internals? Dev-only? Never actually required (a declared-but-unused transitive)?
- **Unreachable ≠ skip.** Say *why* it's unreachable, with evidence — for example: the consumer's compiled output never requires it (verified by `rg` over its `dist/`), or the app runs on a different adapter, or the route that uses it is never registered. "Doesn't look used" is not evidence.
- For packages consumed *indirectly* — a static-file plugin registered by a docs module, an OpenAPI generator wired up by a framework — find the registration site, which may live inside the parent package in `node_modules`, and compare the changed options against the configuration actually passed there.

### Step 4 — Prove remaining doubts empirically

Where reading the notes can't settle a question, run it — branch vs base, in scratch copies, real repo untouched:

```bash
git worktree add /tmp/audit-main origin/main      # base; remove when done
cp -r <branch-checkout> /tmp/audit-branch          # or a second worktree
```

Probes that have earned their keep:

- **Build + lint on both sides** — and lint must also fire on a *deliberately broken file* to show the rules still catch things. "0 warnings" proves nothing if a bump silently stopped the rules from firing; identical findings on identical broken input does prove it.
- **Unit + integration tests with the same counts on both sides** — same files, same test counts, not just "green".
- **Byte-diff generated artifacts**: OpenAPI/Swagger JSON, ORM client generation, migration status output. Generate on both sides and `diff` the files — a byte-identical generated document covers an entire decorator/scanner/generator chain in one shot.
- **Live HTTP probe of affected routes** (fastify `inject`, supertest, or a booted server): status codes, content types, conditional GETs and 304s, path-traversal attempts.
- **Tiny scripts against old vs new package**: install both versions in scratch dirs and feed each the repo's *real* inputs — its schemas, its identifiers, its config shape. Characterize exactly which inputs behave differently.

Keep logs under `/tmp`, clean up everything created, and confirm the audited checkout is still clean at the end.

### Step 5 — Report

The audit report:

- the **inventory table** from Step 1 with risk and reachability filled in — risk rated none / low / medium / high
- one **evidence section per medium/high item**: release links, the commands run, their output, and what was proven
- the **verdict**: `safe` | `safe with caveats` (list them) | `breaking` (list what breaks, with the evidence)

When the audit should land on the bump PR itself, post a single review (event `COMMENT`, never approve):

- one comment per changed manifest line, posted together as one review
- each comment says: what changed, whether it reaches the code and where (file:line), and how that was proven
- the review body carries the verdict and a pointer to the full report

## Examples

### Example 1 — "is this bump safe?"

User: "Dependabot opened a PR bumping our docs framework. Is it safe to merge?"

Agent: inventories the lockfile diff — the framework's patch bump drags three transitive minors. Reading every release in range, one minor changed the 403 error shape on path-traversal attempts in the framework's static-file plugin. The plugin is never imported by app code; it is registered by the framework's docs module with a single root and default settings — none of the changed options match. Live probe of the docs routes on branch and base: identical status codes, content types, conditional-GET/304 behaviour, and traversal responses. Verdict: safe, with the inventory table and the probe table as evidence.

### Example 2 — a forced resolution

An ORM pins a runtime library to an exact version; the bump branch forces a newer minor via `resolutions` to clear a CVE. The only consumer of that library in the whole tree is the ORM's config loader (verified from the lockfile graph). Reading every release between the pinned and forced version shows the changed APIs are far from what the config loader calls — then prove it: run the ORM's generate, validate, and migrate commands on both sides, byte-diff the generated client, run the integration suite with the same test counts. Verdict: low risk, safe — with the standing caveat that any future ORM bump re-tests the override, and a follow-up note to drop the resolution once the ORM ships the fixed version itself.

## Troubleshooting

### The lockfile diff is enormous

Extract only the changed-version hunks (`rg` on the diff for the package-name headers), group by package, and work the table. Lockfiles churn formatting; only resolved-version changes matter. A range-only key change with the same resolved version on both sides is a no-op.

### Release notes are thin or missing

Fall back through: the compare API commit-by-commit → the repo's CHANGELOG → `npm pack` both versions and diff the tarballs as a last resort. Absence of notes is itself a finding: treat as elevated risk and lean harder on Step 4.

### The install behaves differently in CI than locally

Check registry auth first. Yarn berry ignores `~/.npmrc`; private-registry credentials belong in the repo's `.yarnrc.yml` (`npmScopes` / `.npmRegistries`), not a user-level npmrc. An install that authenticates locally but fails in CI is almost always this.

### The fix for the CVE requires a major bump

List it as a follow-up. Never force a fix across a major version via `resolutions`/`overrides` — a major is untested by every consumer in the tree, and the override hides that from the manifests. The bump PR under audit takes the versions its ranges allow; the major migration is its own piece of work with its own audit.

### The bump PR is urgent and the audit is not done

Report what is proven so far and what remains, per package. A partial audit that says "proven: these 22; unproven: these 3, because X" is actionable; "looks fine" is not.

## Security Considerations

- Keep the audited repo read-only; scratch work lives under `/tmp` and is cleaned up.
- Check publish dates against any minimum-release-age gate the repo enforces (`npm view <pkg> time`) — and never loosen the gate to get a fix in faster. The gate exists to catch yanked or superseded releases; weakening it under deadline pressure is how a bad release ships.
- Audit reports and PR reviews are often public. No private registry hosts, credentials, internal ticket keys, or incident-specific identifiers in them — name packages and use neutral examples. Public advisory and CVE identifiers are fine to cite; the details of a private incident are not.
- Prefer empirical probes over trusting release notes: a security fix that changes validation behaviour is itself a behaviour change, and it must be characterized (what input now behaves differently) even when it is unambiguously the right fix.
