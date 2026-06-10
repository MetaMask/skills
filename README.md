# MetaMask/skills

Agent skills, rules, and domain knowledge for the MetaMask ecosystem.

Two audiences share this repo:

1. **dApp / Web3 developers** — skills under `domains/web3-tools/` teach AI
   agents how to use MetaMask developer libraries (`gator-cli`,
   `smart-accounts-kit`, OpenCode plugin, etc.). Drop them into your
   editor/agent and it will operate the tooling correctly.
2. **MetaMask product engineers** — skills under `domains/perps/`,
   `domains/testing/`, `domains/pr-workflow/`, `domains/agentic/`, etc. carry the conventions
   and review heuristics for `metamask-extension`, `metamask-mobile`, and `core`.
   These install into consumer repos via a small CLI.

Single source of truth, multi-operator output (Claude Code, Cursor,
Codex/OpenAI), public canonical, private overlay optional.

> **Private overlay:** internal-only skills (Consensys-wide tooling,
> in-progress experiments, non-public products) live in a separate
> private repo, [`Consensys/skills`](https://github.com/Consensys/skills).
> Engineers with access can layer those skills on top of the public set.
> See [Federation](#federation-public--private).

## Quickstart

### For dApp / Web3 developers (use a single skill)

Point your agent at this repo and load the skill that matches your
tooling. For example, to use the `gator-cli` skill in Claude Code:

```bash
# One-time clone:
git clone https://github.com/MetaMask/skills ~/dev/metamask/skills

# Copy or symlink the skill you want into your project (or ~/.claude/skills):
cp -r ~/dev/metamask/skills/domains/web3-tools/skills/gator-cli/* \
     ~/.claude/skills/gator-cli/
```

Or use the installer to drop all `web3-tools/` skills at once:

```bash
~/dev/metamask/skills/tools/install \
  --repo metamask-extension --target . --domain web3-tools
```

### Package CLI

`@metamask/skills` is also an npm package and exposes the shared consumer CLI:

```bash
metamask-skills list          # discover installable skills for the current repo
metamask-skills search test   # search skill names and descriptions
metamask-skills describe testing/unit-testing
metamask-skills sync          # infer repo + target, refresh cache, install skills
metamask-skills postinstall   # refresh cache; run sync only when SKILLS_AUTO_UPDATE=1
metamask-skills install       # lower-level installer wrapper
```

The discovery commands make opt-in selection self-serve. Developers can find a
skill, inspect it, then save their selection:

```bash
metamask-skills list --domain testing
metamask-skills describe testing/unit-testing
metamask-skills sync --include testing/unit-testing --save
```

Consumer repos should prefer this CLI over copying sync/postinstall scripts.
That keeps cache behavior, `.skills.local` parsing, maturity filtering, and
experimental skill opt-in semantics uniform across Mobile, Extension, Core, and
future org packages.


### For engineers in `metamask-extension` / `metamask-mobile` / `core`

From inside an integrated consumer repo:

```bash
yarn skills

# To opt into experimental ADR-58 recipe skills:
yarn skills --domain agentic --maturity experimental
```

The integrated consumer script is intentionally small: `yarn skills` calls the
published `@metamask/skills` CLI. The CLI infers the current repo from git
remote/package metadata, keeps a public `MetaMask/skills` checkout in
`.skills-cache/metamask-skills`, and falls back to the package's bundled skills
snapshot when offline. It writes managed skills into `.claude/skills/`,
`.cursor/rules/`, and `.agents/skills/`.

Optional: set `METAMASK_SKILLS_DIR=~/dev/metamask/skills` in `.skills.local` or
your shell if you want to use a separate local checkout instead of the cache.

### For cloud agents (Cursor cloud, Codex cloud, etc.)

No SSH key, no env var — one curl pipe to bash inside the consumer repo:

```bash
curl -fsSL https://raw.githubusercontent.com/MetaMask/skills/main/tools/bootstrap | \
  bash -s -- --repo metamask-extension
curl -fsSL https://raw.githubusercontent.com/MetaMask/skills/main/tools/bootstrap | \
  bash -s -- --repo metamask-mobile
curl -fsSL https://raw.githubusercontent.com/MetaMask/skills/main/tools/bootstrap | \
  bash -s -- --repo core

# To opt into experimental ADR-58 recipe skills:
curl -fsSL https://raw.githubusercontent.com/MetaMask/skills/main/tools/bootstrap | \
  bash -s -- --repo metamask-extension --domain agentic --maturity experimental
```

The bootstrap script clones this repo into a cache dir under
`$HOME/.cache/metamask-skills` and runs the installer against the current
directory.

## Repo structure

```
domains/<area>/
  skills/<skill-name>/
    skill.md                    # base skill
    references/                 # optional supporting docs
    scripts/                    # optional helper scripts
    adapters/                   # optional runtime payloads used by scripts
    repos/<consuming-repo>.md   # optional repo-specific overlay
  knowledge/                    # optional shared domain reference, installed beside each domain skill
tools/
  install      # core writer (mms- prefix, multi-operator output)
  sync         # Flow 2: `yarn skills` wrapper for engineers
  deploy       # Flow 1: maintainer push to multiple targets
  bootstrap    # zero-config installer for cloud agents
.targets.local.example          # template for maintainer config
```

## Domains today

| Domain         | Audience          | Examples                                    |
| -------------- | ----------------- | ------------------------------------------- |
| `web3-tools`   | dApp builders     | `gator-cli`, `smart-accounts-kit`, `oh-my-opencode` |
| `coding`       | MM product eng    | Coding guidelines, controller patterns       |
| `agentic`      | MM product eng    | Experimental recipe workflows and runtime proof tools |
| `general`      | All agents        | `codex`, `gemini` CLI usage guides           |
| `performance`  | MM product eng    | React rendering, hooks, state perf          |
| `perps`        | MM product eng    | Perps feature dev + review                  |
| `pr-workflow`  | MM product eng    | PR title, description, changelog            |
| `swaps`        | MM product eng    | Non-EVM swap integration                    |
| `testing`      | MM product eng    | E2E, unit, visual, perf testing             |
| `ui`           | MM product eng    | Component development                       |

## Two distribution flows

### Flow 1 — Push (maintainer)

From inside `MetaMask/skills`, push the current state to one or more
consumer checkouts.

**One target:**

```bash
tools/install --repo metamask-extension --target ~/dev/metamask/metamask-extension
# Core monorepo:
tools/install --repo core --target ~/dev/metamask/core
```

**All configured targets:**

```bash
cp .targets.local.example .targets.local   # one-time
# edit paths
tools/deploy
tools/deploy --domain perps --dry-run      # forwarded to install
```

`.targets.local` is gitignored.

### Flow 2 — Pull (engineer)

From inside a consumer repo:

```bash
yarn skills                                          # sync all stable/default saved domains
yarn skills --select                                 # interactive domain picker
yarn skills --domain agentic --maturity experimental # opt into all experimental recipe skills
yarn skills --include agentic/recipe-harness         # cherry-pick one experimental skill
yarn skills --exclude testing/visual-testing         # opt out of one selected/default skill
yarn skills --include agentic/recipe-harness --save  # persist granular selection to .skills.local
SKILLS_DOMAINS=perps,testing yarn skills             # non-interactive domain filter
SKILLS_INCLUDE=agentic/recipe-harness yarn skills    # non-interactive skill opt-in
SKILLS_MATURITY=experimental yarn skills             # non-interactive maturity filter
METAMASK_SKILLS_DIR=/some/path yarn skills           # override location
```

`yarn skills` should be wired to the shared `@metamask/skills` CLI:

```json
{
  "scripts": {
    "skills": "metamask-skills sync",
    "skills:postinstall": "metamask-skills postinstall"
  },
  "devDependencies": {
    "@metamask/skills": "^0.1.0"
  }
}
```

The CLI infers the repo name by default (`metamask-mobile`,
`metamask-extension`, or `core`) from `git remote get-url origin` or the
`package.json` repository URL. Use `METAMASK_SKILLS_TARGET_REPO` in
`.skills.local` for forks or unusual remotes; pass `--repo` for one-off
overrides/debugging.

Source selection is centralized for consistency across org packages:

1. `METAMASK_SKILLS_DIR` / `CONSENSYS_SKILLS_DIR` when configured.
2. The repo-local `.skills-cache/metamask-skills` checkout maintained by the CLI.
3. The bundled skills snapshot inside the installed `@metamask/skills` package.

`tools/sync` then delegates to `tools/install` with the selected sources. This
keeps every consumer repo on the same parser, cache refresh, maturity filter,
and `SKILLS_AUTO_UPDATE` behavior instead of duplicating setup scripts.

## Manual install (the primitive)

Both flows ultimately invoke `tools/install`:

```bash
tools/install \
  --repo metamask-mobile \
  --target ~/dev/metamask/metamask-mobile \
  --domain agentic \
  --maturity experimental \
  --dry-run
```

### Flags

| Flag             | Default  | Purpose                                                                          |
| ---------------- | -------- | -------------------------------------------------------------------------------- |
| `--target`       | required | Path to consuming repo                                                           |
| `--repo`         | auto     | Consuming repo name. Auto-detected from git/repository URL (fallback: target dirname). |
| `--source`       | this repo | Skill source dir (repeatable, ordered; later overrides earlier on name collision) |
| `--domain`       | all      | Comma-separated domain filter. Default installs **all** domains; pass to opt out. |
| `--maturity`     | `stable` | Min maturity: `experimental`, `stable`, `deprecated`                             |
| `--include`, `--skill` | none | Comma-separated skill opt-ins (`domain/skill` or `skill`). Explicit includes bypass domain and maturity filters. Repeatable. |
| `--exclude`      | none | Comma-separated skill opt-outs (`domain/skill` or `skill`). Explicit excludes win. Repeatable. |
| `--save`         | off | Persist CLI domain/maturity/include/exclude choices to `.skills.local`. CLI flags are one-off unless this is passed. |
| `--include-user` | off      | Also install `scope: user` skills (writes to `$HOME` — outside the target repo). Default skips them with a warning. |
| `--dry-run`      | off      | Preview without writing                                                          |

**Install-all default with granular overrides.** Stable skills install for every
domain by default. Engineers opt out per-machine by editing `.skills.local`
(`SKILLS_DOMAINS=perps,testing`) or by running `yarn skills --select` for an
interactive domain picker. New stable domains land automatically on the next
sync — that's by design so new tooling is discoverable.

When a domain mixes stable and experimental skills, use skill-level selection
instead of raising the maturity for the whole domain. `SKILLS_INCLUDE` /
`--include` adds specific skills even when their domain or maturity would
normally skip them; `SKILLS_EXCLUDE` / `--exclude` removes specific skills even
when their domain is selected. Items may be `domain/skill` or just `skill`; use
`domain/skill` when names could collide across public/private sources. CLI
selection is one-off unless passed with `--save`, which writes `.skills.local`:

```bash
# Stable defaults plus only one experimental recipe skill for this run:
yarn skills --include agentic/recipe-harness

# Persist stable defaults plus selected experimental recipe skills:
yarn skills \
  --include agentic/recipe-harness,agentic/recipe-quality \
  --exclude testing/visual-testing \
  --save
```

Recipe skills currently live in the experimental `agentic` domain. Install all
lower-level recipe tools in this rollout with `--domain agentic --maturity
experimental`, or cherry-pick only the ones you want with
`--include agentic/<skill>`.

**User-scope skills (`scope: user` in frontmatter).** Some skills target the
engineer's home dir (`$HOME/.claude/skills`, `$HOME/.codex/skills`) instead
of the target repo. They are **never auto-installed** — installer lists them
in a final warning. Run with `--include-user` to install manually.

### Recipe skills quick use

Recipe skills are experimental. Install them with:

```bash
yarn skills --domain agentic --maturity experimental
```

Experimental recipe skills include lower-level proof tools plus the opt-in high-level workflows `/mms-recipe-dev` and `/mms-recipe-fix-ticket`. Treat the high-level workflows as validation-backed orchestration entry points; they still delegate runtime proof to the lower-level recipe skills.

Use these directly when steering/debugging:

- `/mms-recipe-doctor` — check tool, skill, harness, runtime-context, and fixture/profile readiness before a run.
- `/mms-recipe-harness` — install/verify Mobile or Extension runtime harness.
- `/mms-recipe-cook` — author/refine the executable recipe.
- `/mms-recipe-quality` — critique recipe/evidence and force weak proof into explicit gaps.
- `/mms-recipe-evidence` — format artifacts into reviewer-ready PR text.
- `/mms-recipe-wallet-control` — optional wallet/app primitives for setup, navigation, state, and screenshots.

Happy path for this lower-level rollout: clear task + acceptance criteria → `/mms-recipe-doctor` setup check → `/mms-recipe-harness` verify → `/mms-recipe-cook` recipe → live recipe run → screenshots/trace/summary/manifest → `/mms-recipe-quality` critique → `/mms-recipe-evidence` block → human validation.

### Output

Per consuming repo, the CLI writes:

- `.claude/skills/mms-<name>/SKILL.md` — Claude Code, OpenCode
- `.cursor/rules/mms-<name>/RULE.md` — Cursor
- `.agents/skills/mms-<name>/SKILL.md` + `agents/openai.yaml` — Codex, OpenCode

When a source skill includes bundled resources, `references/`, `scripts/`,
`assets/`, and `adapters/` are mirrored into each output skill directory.
Large runtime skills such as recipe harnesses can therefore add sizeable
ignored payloads under `.claude/skills/`, `.cursor/rules/`, and
`.agents/skills/`; this is intentional so installed skills remain
self-contained. Sync removes stale managed bundle directories when the source
skill removes them. "Self-contained" means the skill payload is present; live
runtime proof still depends on the target repo dependencies, device/browser,
and CDP state described by each repo overlay. Repo overlays still decide which
adapter an agent should use.

All output names are prefixed `mms-` (managed metamask skill). Source
frontmatter `name:` stays unprefixed; the prefix is applied at install time.

Each output file carries a `<!-- DO NOT EDIT -->` banner. Synced content
is additive and intended to be `.gitignore`'d in consuming repos.

## Federation (public + private)

When both env vars are set, `tools/sync` walks both sources and the
private overlay overrides the public skill on name conflict. The shared
`@metamask/skills` CLI passes these sources through while still providing the
repo-local public cache and bundled package snapshot as zero-config fallbacks.

```bash
export METAMASK_SKILLS_DIR=~/dev/metamask/skills        # public, this repo
export CONSENSYS_SKILLS_DIR=~/dev/Consensys/skills      # private overlay
yarn skills
```

Engineers without access to the private repo simply don't set
`CONSENSYS_SKILLS_DIR` — the public set installs cleanly on its own.

## Authoring a skill

```
domains/<area>/
  skills/<skill-name>/
    skill.md
    references/                   # optional supporting docs
    scripts/                      # optional helper scripts
    adapters/                     # optional runtime payloads used by scripts
    repos/metamask-extension.md   # optional repo overlay
    repos/metamask-mobile.md      # optional repo overlay
    repos/core.md                 # optional Core monorepo overlay
```

### `skill.md` frontmatter

```yaml
---
name: <slash-command-name>
description: <≤1,536 chars including when_to_use cues>
maturity: stable          # experimental | stable | deprecated (default stable)
---
```

Extra metadata blocks (e.g. OpenClaw-style `metadata:` with emoji and
homepage) are preserved through install — only `name`, `description`,
`maturity`, `mandatory`, and `scope` are read by the CLI.

### Overlay frontmatter

```yaml
---
repo: metamask-extension  # or metamask-mobile / core
parent: <skill-name>
---
```

Overlays merge into the base body at install time. Skills with a `repos/`
subdir but no overlay matching `--repo` are skipped for that target.
Skills with no `repos/` subdir at all install for any target.

## Multi-operator priority

```
Enterprise > User (~/.claude/skills/) > Project (.claude/skills/)
```

Most-local wins on name conflict. The `mms-` prefix on output names
prevents collision with personal skills.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT — see [LICENSE](LICENSE).

## Security

See [SECURITY.md](SECURITY.md) for how to report issues with skills or
the installer.
