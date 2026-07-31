---
name: supply-chain-audit
description: Assess whether a dependency change is safe to take, across every detector that answers a different part of that question — Socket Security (malicious/anomalous package behavior, install scripts, new maintainers), `yarn npm audit` and advisories (known vulnerabilities), lockfile and manifest diffs (what actually changed, including transitive and resolution swaps), and LavaMoat policy grants (new capabilities, delegated to `lavamoat-policy-diligence`). Also covers the fronts no upstream scanner sees because they are things your own repo does to dependencies afterwards: yarn patches that modify dependency source at install, `resolutions` that force or stub versions, `npmAuditIgnoreAdvisories` suppression lists, CI actions riding mutable tags instead of pinned SHAs, and yarn plugins that execute at install. The falsifier is a lane whose finding is unaccounted for — a flagged package, an unresolved advisory, or a grant with no call site. Detection belongs to the tools; the job is disposition, and handing it to the humans who own the dependency. Triggers on /supply-chain-audit, or when asked whether a dependency bump is safe, to review a lockfile or package.json change, to triage a Socket or audit finding, or to assess supply-chain risk of a change. Callable by `evidence` as its supply-chain engine.
maturity: experimental
---

# /supply-chain-audit

**"Is this bump safe?" is not one question.** A dependency can be free of known CVEs and still
reach `child_process` for the first time. It can have a clean policy diff and ship a
newly-added install script from a maintainer who joined last week. Each detector answers a
different question and is blind to the others, so a single green check is never the answer.

> **Falsifier.** Any lane's finding left unaccounted for: a Socket alert nobody dispositioned,
> an advisory with no upgrade path or accepted-risk note, a capability grant with no call site.
> An unexplained finding is the output, not a nit to wave through.

## Lanes

| question | detector | disposition |
|---|---|---|
| what actually changed? | lockfile / `package.json` diff | direct vs transitive; resolution swaps; version range widening |
| known-vulnerable? | `yarn npm audit`, GitHub advisories, Dependabot | fixed-in version, or an explicit accepted-risk with reachability |
| behaving maliciously or anomalously? | **Socket Security** | per-alert disposition — see below |
| new capability reached? | **LavaMoat** policy diff | **delegate to `lavamoat-policy-diligence`** |
| install-time code execution? | `allowScripts` in `package.json` (`@lavamoat/allow-scripts`) | a newly-`true` entry is a finding in its own right |
| **is dependency source modified in-repo?** | **`.yarn/patches/*.patch`** | read the diff — see below |
| **is a version being forced?** | **`resolutions`** in `package.json` | pinned below a fix? stubbed out? |
| **are findings being suppressed?** | **`npmAuditIgnoreAdvisories`** in `.yarnrc.yml` | every entry needs a reason and a re-check date |
| **does untrusted code run in CI?** | **`uses:` pinning** in `.github/workflows` | third-party actions pinned to a full SHA, not a mutable tag |
| **does untrusted code run at install?** | **`.yarn/plugins/*.cjs`** + their `spec:` URLs | committed bundle reviewed; spec pinned, not `main` |

## The fronts that no scanner covers

Socket, `audit`, and LavaMoat all examine the dependency **as published**. The last five lanes
above are things *your own repo, or your CI,* does around dependencies afterwards, so no
upstream scanner sees them. Measured on `metamask-extension` today, to show these aren't hypothetical:

- **Yarn patches — 53 of them.** A patch is arbitrary modification of a dependency's source,
  applied at install, living in your repo. It is the single most direct injection point in the
  list and the least watched: the package can be clean at every scanner and still execute your
  patch. **Read every patch diff on change**, the same way you'd read a diff to `app/`. A patch
  that grows beyond its stated purpose, or touches a file unrelated to the bug it works around,
  is the finding. Record why each patch exists and what removes it (upstream fix, version bump)
  — an unattributed patch is technical debt with a security surface.

- **`resolutions` — 149 entries.** Forcing a version across the tree. Two failure modes: a pin
  that holds a transitive *below* the version that fixed an advisory (audit may not flag it,
  because the range resolves), and outright substitution — this repo maps several packages to
  `npm:npm-empty-package@1.0.0` to neutralize them. Substitution is legitimate and deliberate,
  but it means **"same version range" does not imply "same code"**, so treat a resolution
  change as a dependency change and re-run the lanes on it.

- **`npmAuditIgnoreAdvisories` — a suppression list.** Entries here are accepted risks by
  definition, and this repo's numeric IDs carry no inline reason (its deprecation entries do).
  This directly contradicts this skill's own falsifier: an unaccounted finding is the output.
  Each entry wants a reason, an owner, and a condition that retires it. An ignore list nobody
  revisits converts a finding into silence.

- **CI action pinning — 7 of 47 third-party `uses:` are SHA-pinned.** The rest ride mutable
  tags (`actions/checkout@v6`, `actions/github-script@v9`). A tag can be repointed by its owner
  or by anyone who compromises that account, and CI holds secrets — this is the
  `tj-actions/changed-files` failure mode. Pin third-party actions to a full 40-char commit
  SHA. First-party (`MetaMask/*`, 25 here) is lower risk but the same mechanism.

- **Yarn plugins execute at install with full privilege.** Three `.cjs` bundles are committed
  (good — the committed bytes are what runs), but their `spec:` URLs point at
  `raw.githubusercontent.com/.../main/...`, a moving branch. Re-importing pulls whatever `main`
  holds that day. Pin the spec to a tag or SHA, and review the bundle diff when it changes.

**Also consider `enableHardenedMode`** (Yarn 4) — not currently set here. It validates
resolutions and checksums against the registry, and is designed for exactly the untrusted-PR
case. And leave `checksumBehavior` at its default (`throw`): a checksum mismatch means the
registry served different bytes for a version you already resolved, which is a signal, not a
nuisance.

Run the lanes the change actually touches. A lockfile-only bump of a build-time dev dependency
does not need the same treatment as a new runtime dependency in the wallet's hot path — but
say which lanes you ran and which you skipped, and why.

## Method

1. **Establish what changed before assessing it.** Direct bump, transitive pull-through, or a
   *resolution swap* (same range, different resolved package)? The last is the easiest to miss
   and the most interesting: an identifier substitution in a policy or lockfile
   (`pkgC>name` replacing `pkgB>pkgA>name`) can mean the dependency was replaced rather than
   updated.

2. **Take each tool's findings as the worklist; don't re-derive them.** Socket, audit, and
   LavaMoat all run in CI and are trusted machines. Re-implementing their detection by hand
   re-does work and produces a less reproducible artifact. Your input is their output.

3. **Prefer the CI-generated artifact over a local regeneration.** Where a bot regenerates
   something (policies especially) and CI enforces drift, that committed artifact is
   authoritative. Regenerate locally only as a **fallback** — bot hasn't run, branch unpushed,
   variant not covered — and note that the provenance is weaker (your node version, OS, and
   lockfile resolution, not CI's). Re-check against the bot's artifact once it runs.

4. **Disposition every finding; the reason is the deliverable.** For each alert or advisory:
   what the tool flagged, whether it is reachable from how *this* project uses the package, and
   the outcome — fixed by upgrading to X, accepted with a stated reason, or blocking. Socket's
   common alert classes need different reasoning: `install scripts` (what does it run, at whose
   trust level), `new author` / `low download count` (typosquat and takeover surface),
   `network access` / `filesystem access` in a package with no business doing either,
   `obfuscated code`, `protestware`. A tool's severity is an input to that judgment, not a
   substitute for it.

5. **Cite at a pinned version, not a branch head.** Every claim about what a dependency does
   resolves to a permalink at the version being installed. A branch-head link drifts out from
   under the citation; the permalink *is* the evidence, because a reader clicks it and is
   convinced without re-running anything.

6. **Hand it to the owners.** Post the disposition where the people who own the dependency
   read it, not as a unilateral assertion. This skill produces a justification for humans to
   act on; it does not approve anything.

## Capability containment → `lavamoat-policy-diligence`

LavaMoat policy grants are a specialized lane with their own method and tooling. **Delegate to
`lavamoat-policy-diligence`** and fold its result in as this audit's capability-containment lane.

Do not restate that lane's question as "does each new capability have a call site" — the policy
is generated from a real run, so it always does, and that check cannot fail. The lane's actual
output is a least-privilege triage: which grants are **removable** (their gate is never opened by
our usage), which are removable at a stated cost, which are load-bearing, plus anything the
reading turned up bearing on security. Carry those findings through; do not compress them to a
pass/fail.

Keep the boundary straight in the writeup: **a clean policy diff does not mean a safe
dependency, and a known CVE does not appear as a new grant.** They are independent.

## Output

```
Supply-chain assessment — <package> <old> -> <new>   (<direct|transitive|resolution swap>)
  lockfile/manifest  <what moved, incl. transitives of note>
  advisories         <id> → fixed in <v> | accepted: <reason> | none
  Socket             <alert> → <disposition + reason>        | no alerts
  install scripts    <allowScripts change> | unchanged
  patches            <.yarn/patches touched> → diff read: <purpose, scope ok?> | unchanged
  resolutions        <forced/stubbed entries touched> | unchanged
  audit ignores      <npmAuditIgnoreAdvisories added> → reason + retire-when | unchanged
  ci actions         <third-party uses: added> → SHA-pinned? | unchanged
  capabilities       → lavamoat-policy-diligence: <removable: …; load-bearing: …>  | no policy change
  lanes skipped      <lane> — <why>
Unresolved: <finding> — <what would settle it>   | none
```

Lead with whatever is actionable — an unresolved finding, a removable capability, a patch whose
scope exceeded its purpose. Lanes that came back clean are a compact line each, not sections.
**No overall accept/reject verdict and no `@`-mentions**: the disposition belongs to the people
who own the dependency, and tagging them is the user's call, not this skill's. Close on what is
unresolved and what would settle it.

## Related

- `lavamoat-policy-diligence` — the capability-containment engine this skill delegates to.
- `evidence` — packages this skill's output as its [supply-chain evidence category](https://github.com/MetaMask/skills/blob/main/domains/pr-workflow/skills/evidence/references/evidence-catalog.md).
