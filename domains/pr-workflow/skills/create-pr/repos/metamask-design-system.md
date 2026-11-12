---
repo: metamask-design-system
parent: create-pr
---

# PR Create — Design System

## Workflow

### 1. Precondition checks

```bash
git rev-parse --abbrev-ref HEAD
git status --porcelain
git rev-parse --verify origin/<branch>
```

- On `main`: abort ("Cannot create a PR from main").
- Dirty working tree: abort ("Commit all changes before creating a PR").
- Branch not on origin: ask before pushing (default: abort). Never push
  without explicit consent.
- The diff edits a package `CHANGELOG.md` and the branch is not `release/*`:
  stop. Changelogs change only on release branches (`release-workflow`).

### 2. Analyze the diff

From `git diff origin/main...HEAD`: files added, changed, and deleted; the
components and packages touched; the change type (feat, fix, chore, docs,
refactor); new dependencies; breaking changes.

- React and React Native changes: state cross-platform consistency.
- Code Connect files: state Figma alignment.
- Breaking changes: point at the `MIGRATION.md` entry.

### 3. Visual evidence

If the diff includes visual UI, run `visual-regression-collect` before
opening the PR, and put the attached PNGs in **Screenshots/Recordings**.
Otherwise write "Not applicable". Never leave the section as a placeholder.

### 4. Write the body from the template

Follow `.github/pull_request_template.md`:

- **Description:** 2–3 sentences on what changed and why.
- **Related issues:** issue or Jira references found in commits, or the
  template's placeholder.
- **Manual testing steps:** realistic steps for the components changed
  (which Storybook stories to open, on which platform).
- **Screenshots/Recordings:** from step 3.
- **Pre-merge author checklist:** check only what is clearly satisfied.

Title: conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, ...).

### 5. Create the draft PR

Write the body to a uniquely named temporary file, then:

```bash
gh pr create --title "<title>" --body-file <tmp file> --draft \
  --attach '<png path>#<alt text>'    # one per screenshot, if any
```

Delete the temporary file whether or not creation succeeds. If `gh` fails,
print the body and the command for the user to run.

### 6. Output

Print the PR URL and the next step: review the description, then
`gh pr ready` when it is ready for review.

## Rules

- Always open as a draft.
- Target `main`.
- Consumer-facing notes go in the PR description; breaking-change guidance
  goes in `MIGRATION.md`; package changelogs are left to the release branch.
