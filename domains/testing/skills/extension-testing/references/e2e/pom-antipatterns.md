# Extension POM anti-patterns

Agent checklist for Page Object Model defects under `test/e2e/`. These are
maintainability defects that cause flakes and expensive rewrites — treat them as
must-fix when creating or reviewing E2E code.

Canonical review rules also live in the Extension repo:

- `.cursor/BUGBOT.md` (sections 3.3–3.9)
- `test/e2e/.cursor/BUGBOT.md` (path-scoped copy)

## Checklist (flag and fix)

| Anti-pattern | Prefer |
| --- | --- |
| Locators (`data-testid`, `{ css }`, `{ text, tag }`, `*Button`/`*Input` constants) in `page-objects/flows/**` | Move locators into `page-objects/pages/**`; flow only calls page methods |
| Flow that instantiates exactly one page object and no other flow | Move the method onto that page object |
| UI helper in a `*.spec.ts` that clicks/fills/waits or builds page objects | Page object method, or a flow if multi-page |
| Spec calls `driver.clickElement` / `findElement` / `waitForSelector` / `fill` / … for UI | Call page object or flow; keep locators in pages |
| `driver.delay(` or bare `setTimeout` without a justifying comment | `waitForSelector`, `waitForElementNotPresent`, `driver.wait` |
| Page object imports/instantiates another page (`new OtherPage(this.driver)`) | Multi-page steps belong in a flow |
| `try`/`catch` in page objects or flows (except `driver.wait` poll returning `false`) | Let failures surface; use wait helpers and `check*` methods |

## Create / maintain process tie-in

- After writing E2E: run this checklist before submit.
- When fixing flakes: if the root cause is structural, fix here first, then apply
  [`flakiness.md`](flakiness.md) patterns.

## Cursor Bugbot reality (MMQA-2248)

| Fact | Guidance |
| --- | --- |
| Project `BUGBOT.md` rules are loaded on PR review (verify with `bugbot run verbose=true`) | Keep rules in the Cursor-documented regex → “Add a Bug” format |
| Bugbot often reports **no new issues** even when POM violations are in the diff | Team/learned rules and Default effort bias toward high-confidence bugs, not style/POM gates |
| Local CODEBOT / `/review` use the same files more reliably | Prefer local self-check + this skill over expecting Bugbot CI to block merges |
| Effort level, learned rules, and team rate-limits are dashboard-only | Agents cannot disable them from the repo |
| Deterministic ESLint/CI lint for POM is a future option | Out of scope for the testing-skills v1; do not claim Bugbot is the merge gate |

**Bottom line:** prevent bad E2E by following this skill when writing and
maintaining tests. Do not wait for Bugbot to catch POM anti-patterns on the PR.
