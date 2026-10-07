---
name: aus-preference-key
description: >-
  Adds a new notification-preference key to Authenticated User Storage (AUS)
  across the frontend repos: updates the @metamask/authenticated-user-storage
  contract in core, gates client work behind a core preview build, wires
  optional settings sections into extension and mobile, and opens draft PRs
  plus a core release follow-up. Backend changes (the AUS Go service) are out
  of scope. Use when asked to add or support a new AUS preference key in
  core, extension, or mobile, or when a notification category needs a
  preference key no client knows yet.
maturity: experimental
---

# AUS preference key

Add a key to `NotificationPreferences` in `@metamask/authenticated-user-storage`
and roll it out across core, extension, and mobile as draft PRs plus a core
release follow-up. The AUS backend (Go service) is a separate workstream: this
skill assumes it already accepts the key and merges a default into GETs. If it
does not, stop and tell the user.

## When to use

- A new preference key must be added to `NotificationPreferences` and surfaced in clients
- A notification category needs a settings row whose key exists in no repo yet

Out of scope: the AUS backend, keys already in the installed storage package,
notification payload rendering, and non-notification AUS blobs.

## Prerequisites

- Checkouts of `core`, `metamask-extension`, `metamask-mobile`
- `gh` authenticated with permission to comment and open draft PRs in all three
- Yarn 4 via Corepack (`corepack enable`)

The state of `main` is the only source of truth. In each repo run
`git fetch origin main` and branch from `origin/main`; working trees are often
on stale feature branches. Read files with `git show origin/main:<path>` if in
doubt.

## Finding every touchpoint

Paths and line numbers drift, so do not trust remembered file lists. In each
repo, find the PR that added the most recent comparable key and mirror its
file list:

```bash
git log origin/main -S'<existingKey>' --oneline -- <package-or-app-dir>
```

Use `agenticCli` (present in all three repos) or `priceAlerts` (core and
mobile) as `<existingKey>`. Then grep every spelling of it on `origin/main`
(`agenticCli`, `agentic_cli`, `AGENTIC_CLI`, `agentic-cli`, `AgenticCli`) in
code, tests, mocks, docs, and the en locale, and mirror each hit that concerns
preferences or the settings UI. Ignore hits for the feature itself and other
locales. The per-repo references list only what grep cannot show: which
touchpoints the compiler does not enforce, and what not to copy.

## Contract facts

Re-check any that the current code contradicts before proceeding.

1. `NotificationPreferencesSchema` is a superstruct `type()`, which ignores
   unknown keys, so old clients keep validating GETs that carry the new key.
   Confirm with `git grep -n "NotificationPreferencesSchema" origin/main --
   packages/authenticated-user-storage/src/validators.ts`: if it is no longer
   built with `type(`, stop and ask.
2. `putNotificationPreferences` sends the full blob and is not validated on
   write. Whatever a client PUTs replaces the stored preferences.
3. Every client writer must spread the fetched blob and replace one section.
   Check with `git grep -n putNotificationPreferences origin/main -- <src dirs>`
   in each repo; a writer that rebuilds the blob from a fixed field list
   drops the new key.
4. The AUS API merges defaults into GETs for keys a stored blob omits.
   Clients do not backfill.
5. A required field is a breaking change (semver-ts), and
   `getNotificationPreferences` validates GETs at runtime, so a required key
   throws on stored blobs that lack it. Default to optional-first; make it
   required only in a later coordinated release, as `agenticCli` was
   (optional in 2.1.0, required in 3.0.0).
6. `buildFreshPreferences` in `NotificationServicesController` seeds every
   key for first-time setup. The new key must be added there.
7. The messenger actions for get/put are key-agnostic and already allowlisted
   in both clients. No messenger or background changes.

## Workflow

Steps marked **Prompt** must ask the user, record the answer in the tracker,
and wait.

### Step 1: Inputs and tracker

**Prompt** for the key name (camelCase), the preference shape,
and whether it is required on the type (recommend optional, fact 5).

Create the tracker outside all working trees (`$TMPDIR/aus-preference-rollout-<key>.md`)
from the template below.

### Step 2: Core

Follow references/core-contract.md. **Prompt** for permission to open the PR,
then open it as a **draft**. Build the description from the repo's current PR
template (`.github/pull_request_template.md`) with **every section filled**.
The Explanation states the contract facts that make the change safe for old
clients and names the planned client follow-ups (PR URLs are added in Step 6).

### Step 3: Core CI green, then preview build

Poll `gh pr checks <core-pr>` until all pass. If any fail, stop, summarize,
and **Prompt** the user. Only once green, post the trigger comment (needs
MetaMask engineering membership; otherwise ask the user which path in core's
`docs/processes/preview-builds.md` applies):

```bash
gh pr comment <core-pr> --body "@metamaskbot publish-previews"
```

Poll `gh pr view <core-pr> --comments` for the bot's reply and record the
`@metamask/authenticated-user-storage` preview version. Do not start client
work without it.

Previews are built from the PR head at request time. If the core PR gets new
commits afterwards, wait for CI to pass again, re-post the comment (ask the
user first), and update each client's `previewVersion`.

### Step 4: Per-client decisions

**Prompt** separately for extension and mobile; answers may differ.

1. Add a settings section for the key in this repo?
2. If yes: title, description, icon.
3. UI, inferred from the shape:
   - Only the two channel booleans (`inAppNotificationsEnabled`,
     `pushNotificationsEnabled`), optionally plus controller-managed internal
     fields → default two-toggle UI. Do not ask.
   - Additional user-facing fields (like `socialAI`) → ask default or
     custom; for custom, prompt for the React component path.

### Step 5: Client changes, one repo at a time

For each repo adding support:

1. Add a `previewBuilds` entry to `package.json` (create the section if
   missing; handled by the repo's `plugin-preview-builds` yarn plugin):

   ```json
   "previewBuilds": {
     "@metamask/authenticated-user-storage": {
       "type": "non-breaking",
       "previewVersion": "<version from the bot comment>"
     }
   }
   ```

   Use `"breaking"` if the field was made required. Run `yarn install`, then
   `yarn why @metamask/authenticated-user-storage` to confirm every instance
   is on the preview. Follow the repo's dependency workflow for lockfile
   changes (extension: see "dependency" steps in its `AGENTS.md`).
2. Wire the section: discovery recipe above plus the repo's reference file.
3. Run the reference file's verification commands.
4. **Prompt** for permission, then open a **draft** PR with the repo's current
   PR template, every section filled. Record the URL.

### Step 6: Close out

When every planned PR is open (core plus each client that opted in), add the
release follow-up (Step 7) to the core PR description, then delete the
tracker. A client that declined needs no PR and no preview build.

### Step 7: Release follow-up (after the core PR merges)

Follow core's `docs/processes/releasing.md`: `yarn create-release-branch -i`
on `main`, picking the bump the changelog implies (minor for optional, major
for `**BREAKING:**`). Add the `release:keep-open` label if review will outlast
the auto-close. After the release publishes, replace each client PR's
`previewBuilds` entry with the released version bump and re-run its tests.

## Tracker template

```markdown
# AUS preference rollout — <key>

## Inputs
- Key / shape / required on type:

## Per-repo decisions
| Repo      | Add section | Title | Description | Icon | UI (default/custom + component) |
|-----------|-------------|-------|-------------|------|---------------------------------|
| extension |             |       |             |      |                                 |
| mobile    |             |       |             |      |                                 |

## Tasks
- [ ] Core: changes, tests, changelog validated
- [ ] Core: draft PR — <url>
- [ ] Core CI green; preview requested; preview version — <version>
- [ ] Extension: wired, tests green; draft PR — <url> (skip if declined)
- [ ] Mobile: wired, tests green; draft PR — <url> (skip if declined)
- [ ] Release follow-up written into core PR; tracker deleted
```

## Troubleshooting

- **No bot comment.** Check the "Publish a preview build" workflow run on the
  core PR. Re-comment only with the user's permission.
- **Core CI red.** Do not self-fix; ask the user.
- **Preview not picked up.** `yarn why` in the client; if a patched
  resolution conflicts, use the patch-preserving form in core's preview-builds doc.
- **Client type errors after the preview.** The field was made required:
  that is the breaking path. Fix the client in the same PR.
- **PR template conflict.** Extension's `AGENTS.md` says to comment out
  non-applicable sections; this skill requires every section filled. Write
  "N/A — <reason>" in non-applicable ones and flag it to the user.

## Security considerations

- Draft PRs only, after explicit per-PR permission.
- No secrets handled; previews are published by the metamask bot.
- The tracker lives outside the repos so it cannot leak into a PR.
