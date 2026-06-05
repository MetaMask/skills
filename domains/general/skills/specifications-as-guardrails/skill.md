---
maturity: experimental
name: specifications-as-guardrails
description: Treat failing automated checks as signals to investigate, not obstacles to remove
---

# Specifications as Guardrails

## When To Use

- A failing CI test, TypeScript error, lint rule, or schema check is blocking work
- Considering disabling, weakening, or bypassing an automated check
- A pre-existing flaky test is tempting to delete rather than diagnose

## Do Not Use When

- The check is genuinely wrong and the team has explicitly agreed to update it
- The spec change is part of a documented requirement change

Automated checks are the specification. When they fail, the code doesn't meet the spec — not the other way around. Never weaken a spec as the first response to failure.

## Applies To

| Check | Specification | Wrong Response |
|-------|--------------|----------------|
| CI tests | Expected behavior | Weaken assertions |
| TypeScript errors | Contract definitions | Add `any` or casts |
| Lint rules | Code standards | Disable the rule |
| Schema validation | Data contracts | Loosen schemas |
| Access controls | Security boundaries | Add bypass flags |
| Build/test config | Platform constraints | Add workarounds |

## Triage Protocol

Before touching the spec, answer in order:

1. Is this failure caused by changes in this PR, or pre-existing?
2. Did this test pass on `main` recently?
3. Is this a known flaky test?
4. What did the PR change that could affect this?
5. Does the fix touch shared config? If so, why don't other consumers need this?

## Workaround Cascade Rule

When a fix requires changing shared config (jest.config, webpack, CI pipelines), you are working around a problem, not fixing it.

Count hops between your fix and the failing line:

| Hops | Fix location | Confidence |
|------|-------------|------------|
| 0 | Same file as failure | High — direct fix |
| 1 | Adjacent file (test helper, mock) | Moderate — verify necessity |
| 2+ | Config, build, CI | Low — almost certainly a workaround |

If your fix chain crosses an abstraction boundary (test code -> test config -> build config), trace backwards to root cause.

```
Cascade: unmocked import -> ESM parse failure -> transformIgnorePatterns -> CI transpiles extra packages for all tests
Fix:     "Why is Jest loading this module?" -> test doesn't mock it -> mock the module
```

**Agent corollary:** When an agent adds config-level workarounds, check how the codebase handles the same situation elsewhere. If other packages don't need the workaround, the agent's code is the problem.

## When Spec Changes Are Appropriate

- Requirements genuinely changed (explicit, documented decision)
- Spec itself has a confirmed bug (rare; requires evidence)
- User explicitly requests after understanding the tradeoff

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| "Let me update the test to pass" | Diagnose why code doesn't meet the spec |
| Add `as any` to fix a type error | Find why the type is wrong |
| `// eslint-disable` on a violation | Understand and fix the violation |
| Arbitrary delay to fix flaky test | Investigate the actual race condition |
| Add package to `transformIgnorePatterns` | Ask why Jest is loading the real module |
| Change jest/webpack config for one test | Find the scoped fix — other consumers don't need this |
| "I'll try a different approach" after error | "The test expects X, but code does Y. Investigating why." |
