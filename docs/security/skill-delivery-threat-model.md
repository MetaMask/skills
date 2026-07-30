# Threat model: skill delivery

Skills are auto-loaded instructions distributed to engineers' coding agents across the org,
alongside executable payloads written into agent-trusted local paths. That is a delivery
channel with real reach, and it is not currently described anywhere in this repo's security
posture. This document states what the channel does today, which controls already constrain
it, and which decisions are open.

It is descriptive, not a proposal. Nothing here changes delivery behavior; the mitigations
are listed so the security team can rule on them.

> [!NOTE]
> `SECURITY.md` currently says this repo holds *"agent instructions and prompt templates
> only — no runtime code that ships in MetaMask products."* That understates the surface:
> `bin/` and `tools/` ship as the published `@metamask/skills` CLI, and skill bundles
> include `scripts/` and `adapters/` payloads copied into consumer repos. Worth reconciling
> whichever way the team decides.

## What is being protected

- **Engineer workstations.** Install writes into `$HOME` (with `--include-user`) and into
  the consumer repo's agent directories.
- **Agent sessions.** A skill body is instruction text that an agent treats as trusted
  guidance, in a session that usually holds repo write access and credentials.
- **Consumer repositories.** Install writes `.claude/skills/`, `.cursor/rules/`, and
  `.agents/skills/`, which are read on every subsequent agent run.

## Channels

### 1. Instruction channel — skill bodies

Skill bodies are auto-loaded into agents. A body that instructs an agent to weaken a check,
exfiltrate a value, or alter an edit is executed as guidance, not flagged as content. Reach
is every engineer who installs the domain.

Relevant property: the installer writes `alwaysApply: false` for Cursor rules
(`tools/install`), so skills are selected on demand rather than force-loaded. That bounds
*when* a body is read, not what it may say once read.

### 2. Execution channel — shipped payloads

`copy_bundle_dirs` ships `references scripts assets adapters` (`tools/install:349`). Today
that is **7 files** under `scripts/`/`adapters/`, including `.sh` payloads. They are copied
into agent-trusted paths, where an agent may run them without the friction that applies to
code fetched at runtime.

### 3. Delivery channel — how content reaches a machine

| Path | Ref | Notes |
|---|---|---|
| `@metamask/skills` npm package | pinned by lockfile | package review and npm minimal-age gates apply |
| `tools/sync` → `git pull --ff-only` (`tools/sync:194`) | **tracks a branch** | content follows `main`, not a reviewed ref |
| `tools/bootstrap` via `curl … \| bash` | **`main`, unpinned** | the bootstrap script itself is fetched from `raw.githubusercontent.com/MetaMask/skills/main/tools/bootstrap`, with no checksum; `SKILLS_REF` defaults to `main` |

The package is pinned; the **content** it installs is not. That distinction is the crux —
a lockfile entry for the CLI says nothing about which skill revision gets written to disk.

## Controls already in place

Stating these accurately matters, because the risk is often described as larger than it is:

- **Auto-update is opt-in.** `metamask-skills postinstall` refreshes the cache and returns
  unless `SKILLS_AUTO_UPDATE` is truthy (`bin/metamask-skills.mjs:741-744`). Installing the
  package does not by itself pull new skill content.
- **No `postinstall` in this package's own `package.json`.** The hook exists for consumer
  repos to wire up deliberately.
- **`--ff-only`.** A force-push to `main` breaks the pull rather than being silently applied,
  and `tools/sync` refuses to install rather than proceed with a stale source.
- **CLI distribution is reviewed.** Package review and npm minimal-age gates cover the
  `@metamask/skills` artifact.

## Open decisions

For the security team, in rough order of leverage:

1. **Pin content to a reviewed ref.** Sync and bootstrap follow `main`. A release tag or
   reviewed SHA would make the installed revision an auditable fact. Cost: an extra step to
   publish, and a lag between merge and availability.
2. **Gate the bootstrap path.** `curl … | bash` from a mutable branch is the weakest link —
   no pin, no checksum, no signature. Options include publishing a checksummed release
   artifact or dropping the documented one-liner in favour of the package.
3. **Decide how shipped executables are gated.** Whether `scripts/`/`adapters/` should ship
   at all; if so, whether they need review by a named owner, and whether an agent should be
   told they are runnable.
4. **Treat skill bodies as untrusted pending review.** An admission review that reads a body
   as instruction — asking what an agent would do if it followed it literally — rather than
   as prose.
5. **Branch protection and CODEOWNERS on this repo.** Confirm the required-review and
   status-check rules on `main` match the reach of the channel. (Not asserted here: the
   protection endpoint returns 404 to a non-admin token, which does not distinguish "no
   rule" from "no permission to read the rule".)

## Related

- [`MetaMask/decisions#162`](https://github.com/MetaMask/decisions/pull/162) — ADR 0057
  review, where the missing threat model was raised.
- [`SECURITY.md`](../../SECURITY.md) — reporting policy, and the framing noted above.
- [`CONTRIBUTING.md`](../../CONTRIBUTING.md) — admission criteria for new skills.
