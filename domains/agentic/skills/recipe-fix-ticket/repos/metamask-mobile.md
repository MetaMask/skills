---
repo: metamask-mobile
parent: recipe-fix-ticket
---

# MetaMask Mobile

For Mobile tickets, first classify whether the bug is navigation, rendering, wallet state, controller state, network, transaction, notification, deeplink, or build/config behavior.

Use existing fixtures and page objects before adding new helpers. Runtime proof should avoid inherited simulator state.

For visible Mobile UI tickets, the pass bar is a live recipe run on the intended
simulator/device, not only Jest/type/lint. Use the runner-appropriate
`mms-recipe-harness` delegate (Codex: `$mms-recipe-harness`; Claude/Cursor:
`/mms-recipe-harness`) or its installed portable `scripts/recipe-harness verify`
wrapper, then run the recipe through the installed Mobile recipe runner and save
artifacts under an ignored task directory. Do not require personal shell aliases. Return the recipe path, `summary.json`, `trace.json`,
screenshots/video when available, evidence manifest, and any fixture/device gap.
Default runtime is auto: if app/simulator is unreachable, let `/mms-recipe-harness` prepare it. With `--interactive`, ask before runtime/heavy steps. If harness/policy blocks, record `BLOCKED` with command/artifact.

Load `references/metamask-mobile-checklist.md` and execute it as the ordered checklist for Mobile bug fixes. Runtime proof should avoid inherited simulator state and name the fixture/setup flow used.


## MetaMask Mobile focused checks

Mobile lint: never run `yarn lint <files>`; it runs repo-wide ESLint. Use direct `./node_modules/.bin/eslint <changed files> --cache --quiet --max-warnings=0` or mark lint `N/A: broad lint deferred`.
