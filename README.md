# MetaMask/skills

Agent skills, rules, and domain knowledge for the MetaMask ecosystem.

Two audiences share this repo:

1. **dApp / Web3 developers** — skills under `domains/web3-tools/` teach AI
   agents how to use MetaMask developer libraries (`gator-cli`,
   `smart-accounts-kit`, OpenCode plugin, etc.). Drop them into your
   editor/agent and it will operate the tooling correctly.
2. **MetaMask product engineers** — skills under `domains/perps/`,
   `domains/testing/`, `domains/pr-workflow/`, etc. carry the conventions
   and review heuristics for `metamask-extension` and `metamask-mobile`.
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

### For engineers in `metamask-extension` / `metamask-mobile`

```bash
# One time:
git clone https://github.com/MetaMask/skills ~/dev/metamask/skills
export METAMASK_SKILLS_DIR=~/dev/metamask/skills

# Then, from inside the consumer repo:
yarn skills
```

`yarn skills` runs `tools/sync`, which pulls the latest skills and writes
them into `.claude/skills/`, `.cursor/rules/`, and `.agents/skills/`.

### For cloud agents (Cursor cloud, Codex cloud, etc.)

No SSH key, no env var — one curl pipe to bash inside the consumer repo:

```bash
curl -fsSL https://raw.githubusercontent.com/MetaMask/skills/main/tools/bootstrap | \
  bash -s -- --repo metamask-extension
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
    repos/<consuming-repo>.md   # optional repo-specific overlay
  knowledge/                    # optional shared domain reference
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
yarn skills                                          # interactive prompt
SKILLS_DOMAINS=perps,testing yarn skills             # non-interactive
METAMASK_SKILLS_DIR=/some/path yarn skills           # override location
```

`yarn skills` calls `tools/sync`, which pulls the source repos, then
execs `tools/install` with each as `--source`.

If neither env var is set, the script prints setup instructions and exits.
**No silent auto-clone** — engineers see the path they're opting into.

## Manual install (the primitive)

Both flows ultimately invoke `tools/install`:

```bash
tools/install \
  --repo metamask-mobile \
  --target ~/dev/metamask/metamask-mobile \
  --domain perps \
  --dry-run
```

### Flags

| Flag             | Default  | Purpose                                                                          |
| ---------------- | -------- | -------------------------------------------------------------------------------- |
| `--target`       | required | Path to consuming repo                                                           |
| `--repo`         | auto     | Consuming repo name. Auto-detected from `<target>/package.json` `name` (fallback: target dirname). |
| `--source`       | this repo | Skill source dir (repeatable, ordered; later overrides earlier on name collision) |
| `--domain`       | all      | Comma-separated domain filter. Default installs **all** domains; pass to opt out. |
| `--maturity`     | `stable` | Min maturity: `experimental`, `stable`, `deprecated`                             |
| `--include-user` | off      | Also install `scope: user` skills (writes to `$HOME` — outside the target repo). Default skips them with a warning. |
| `--dry-run`      | off      | Preview without writing                                                          |

**Install-all default.** Skills install for every domain by default. Engineers
opt out per-machine by editing `.skills.local` (`SKILLS_DOMAINS=perps,testing`)
or by running `yarn skills --select` for an interactive picker. New domains
land automatically on the next sync — that's by design so new tooling is
discoverable.

**User-scope skills (`scope: user` in frontmatter).** Some skills target the
engineer's home dir (`$HOME/.claude/skills`, `$HOME/.codex/skills`) instead
of the target repo. They are **never auto-installed** — installer lists them
in a final warning. Run with `--include-user` to install manually.

### Output

Per consuming repo, the CLI writes:

- `.claude/skills/mms-<name>/SKILL.md` — Claude Code, OpenCode
- `.cursor/rules/mms-<name>/RULE.md` — Cursor
- `.agents/skills/mms-<name>/SKILL.md` + `agents/openai.yaml` — Codex, OpenCode

All output names are prefixed `mms-` (managed metamask skill). Source
frontmatter `name:` stays unprefixed; the prefix is applied at install time.

Each output file carries a `<!-- DO NOT EDIT -->` banner. Synced content
is additive and intended to be `.gitignore`'d in consuming repos.

## Federation (public + private)

When both env vars are set, `tools/sync` walks both sources and the
private overlay overrides the public skill on name conflict. This matches
the "most-local wins" priority below.

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
    repos/metamask-extension.md   # optional repo overlay
    repos/metamask-mobile.md      # optional repo overlay
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
repo: metamask-extension
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
