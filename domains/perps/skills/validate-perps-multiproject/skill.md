---
name: validate-perps-multiproject
description: Interactively validate perps changes across local MetaMask Core, Mobile, and Extension checkouts. Use when a Core @metamask/perps-controller change must be checked in Mobile/Extension, or when a Mobile/Extension perps change needs parity validation in the other client. Defaults to current checkout as owner, yalc for Core package transport, read-only validation targets, and the smallest meaningful proof; asks the user only when required folders or proof level cannot be resolved.
maturity: stable
---

# Validate Perps Multiproject

Validate one perps change across multiple local MetaMask repo checkouts.

## Defaults

- **Owner checkout**: current repo/cwd unless a path is provided.
- **Folder layout**: assume Core/controller, Mobile, and Extension are sibling folders under one workspace.
- **Targets**:
  - Core/controller owner -> validate in Mobile and Extension when available;
  - Mobile owner -> validate parity in Extension;
  - Extension owner -> validate parity in Mobile.
- **Transport**: `yalc` for `@metamask/perps-controller`; none for client parity.
- **Proof**: smallest meaningful proof: build/package smoke first; recipe/e2e or real UI flow when behavior changes.
- **Target edits**: forbidden unless explicitly allowed.
- **Cleanup**: required; restore validation checkouts to pre-state.

## Step 0 — resolve folders or ask

Do not guess missing folders. Discover likely local checkouts, then ask only for unresolved choices.

```bash
HERE=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
PARENT=$(dirname "$HERE")

# Prefer sibling folders in the same workspace.
for name in core metamask-core controller metamask-mobile mobile metamask-extension extension; do
  [ -d "$PARENT/$name" ] && echo "$PARENT/$name"
done

# Optional fallback if repos are not siblings.
ROOT="${METAMASK_REPOS_DIR:-$HOME/dev/metamask}"
find "$ROOT" -maxdepth 1 -type d \
  \( -name 'core*' -o -name 'controller*' -o -name 'metamask-mobile*' -o -name 'mobile*' -o -name 'metamask-extension*' -o -name 'extension*' \) -print 2>/dev/null
```

If needed, ask one concise question using the runtime's interactive question tool when available:

```text
I need the validation folders:
- Owner checkout: <default/candidates>
- Validation target(s): <default/candidates>
- Proof level: transport-only | type/import | recipe/e2e | real UI flow
- May validation targets be edited? default no
```

Echo the resolved contract before changing anything.

## Worker context to inject

```md
## Perps multiproject validation

Owner: <core|mobile|extension> `<path>` on `<branch>`
Targets:
- <project> `<path>` — <read-only|editable> — purpose: <integration/parity>
- <project> `<path>` — <read-only|editable> — purpose: <integration/parity>

Rules:
1. Capture `git status --short --branch` in every checkout first.
2. Edit only the owner checkout unless a target is explicitly editable.
3. For Core package validation, build first, then publish via yalc; never publish stale `dist/`.
4. Run the smallest proof that reaches the changed perps behavior.
5. Label package transport-only checks as `transport-only`; do not call them E2E.
6. Cleanup yalc/package-manager changes and prove final target status matches pre-state.
```

## Core -> clients via yalc

Use the repo toolchain and capture it in the evidence. Do not assume a Node manager. If your local checkout uses asdf/nvm/volta, activate it explicitly before running build commands.

```bash
# Optional examples only; use the manager configured for this checkout.
# asdf users: export PATH="$HOME/.asdf/shims:$HOME/.asdf/bin:$PATH"
# nvm users:  nvm use
# volta users usually need no shell change.
YALC_BIN="${YALC_BIN:-yalc}"

# Pre-state
for repo in /path/to/core /path/to/mobile /path/to/extension; do
  echo "--- $repo"
  git -C "$repo" status --short --branch
  (cd "$repo" && printf 'node=%s yarn=%s\n' "$(node -v)" "$(yarn -v)")
done

# Build the exact package. This is the freshness gate for yalc.
cd /path/to/core
yarn workspace @metamask/perps-controller build

# Publish only after the package build succeeds.
cd /path/to/core/packages/perps-controller
"$YALC_BIN" publish --private

# Install in each client; Yarn 4 uses singular skip-build.
cd /path/to/client
"$YALC_BIN" add @metamask/perps-controller
yarn install --mode=skip-build

grep -n "@metamask/perps-controller" package.json yalc.lock yarn.lock
ls -la .yalc/@metamask/perps-controller/dist
```

Yalc path handling:

- Prefer plain `yalc` from the developer shell.
- If `yalc` resolves to a broken version-manager shim, set `YALC_BIN=/opt/homebrew/bin/yalc`, `YALC_BIN=/usr/local/bin/yalc`, or another explicit binary path for that machine.

Build failure handling:

- If the package build fails, do **not** use an older `~/.yalc` package and do **not** hand-edit `dist/`. Report that client validation is blocked before transport.
- If errors mention `TS6305`, `unknown`, `never`, or a Core workspace dependency cycle, the package graph is stale or cyclic. Do not run `yarn workspaces foreach --from @metamask/perps-controller -R ...`; it can fail on the account-tree/multichain/perps/snap cycle and still leave `dist/` deleted.
- If a full Core rebuild is acceptable, ask first, then run it gently: `nice -n 10 yarn build`. Otherwise stop at the build blocker with the log path.
- Treat `yalc publish` success as meaningful only when the current run produced fresh `packages/perps-controller/dist` first.
- If the user still needs a client runtime smoke despite a Core build blocker, use an explicit **runtime-only yalc overlay**: restore the target client's installed package `dist` as a baseline, transpile only changed package source files into that `dist`, publish with yalc, and label the proof `runtime-only overlay, not publish-quality build`. Do not present this as a successful Core package build.

Run the selected proof in each client, then cleanup:

```bash
cd /path/to/client
"$YALC_BIN" remove @metamask/perps-controller || true
git checkout -- package.json yarn.lock 2>/dev/null || true
rm -rf .yalc yalc.lock
git status --short --branch
```

## Client parity

For Mobile <-> Extension checks:

1. Load relevant installed perps knowledge from `knowledge/`: `mobile-extension-map`, `screens`, `shared-package-analysis`, architecture docs as needed.
2. Find the equivalent screen/hook/flow in the other client.
3. Validate with real flow evidence; do not inject UI state.
4. Report semantic differences separately from regressions.

## Stop conditions

Stop and report when the owner package cannot build, target checkout has unexpected dirt, cleanup would delete user work, target source edits are needed but not allowed, or required device/browser/credential context is missing.

## Final answer

```md
Validated <change> against <targets>.
- Owner: <path>@<branch>, status <clean/expected dirty>
- Targets: <path/status>, <path/status>
- Transport: <yalc package/version or none>
- Proof: <commands/recipes> => <pass/fail>
- Artifacts: <paths>
- Cleanup: <target repos restored or noted>
- Follow-ups/blockers: <if any>
```
