---
name: avoid-any
description: Handle `any` correctly — it is not a type but a directive that disables type checking. Substitute by position (assignee → `unknown`, assigned → `never`); the one exception is a generic constraint, declared with an inline eslint-disable.
maturity: experimental
---

# Avoid `any`

Deepens the TypeScript guidance in `mms-coding-guidelines` — which already says "avoid `any`, prefer `unknown`" and links `MetaMask/contributor-docs` `docs/typescript.md`. This is the reasoning layer beneath that bullet: why `any` is dangerous, and how to replace it by position. Grounded in `docs/typescript.md` (§ Avoid `any`).

## `any` is not a type — it is a directive that disables type checking

The mental model matters more than the ESLint rule, because `@typescript-eslint/no-explicit-any` (already `error` in extension CI) does not stop the reasoning that reaches for `any`:

- **`any` is not "the widest type" — that is `unknown`.** `any` is a compiler directive that _disables_ type checking for the value it annotates.
- **It suppresses every error about its assignee** — the equivalent of `@ts-ignore` on every use of that variable. The errors still affect the code; `any` only makes them invisible.
- **It subsumes what it touches.** Any type in a union, intersection, or property relationship with `any` becomes `any` — an unmitigated loss of type information.
- **It infects downstream code.** One `any` at a source (e.g. a library type that resolves to `any`) propagates silently through every consumer, converting compile-time errors into **silent runtime failures** — defeating the point of a statically-typed language.

## Substitute `any` by position — assignee vs assigned

Identify which side of an assignment the `any` sits on:

- **Assignee** (a variable, parameter, or return that _receives_ a value — "it could be anything"): **try `unknown` first**, then narrow. `unknown` is the true universal supertype: everything is assignable to it, but it forces a type guard before use. `any` ↔ `unknown` are interchangeable in this position, so it is almost always a safe swap.
  - 🚫 `type Fn = () => any; const xs: any[]`
  - ✅ `type Fn = () => unknown; const xs: unknown[]`
- **Assigned** (a value that _flows into_ a slot): **try `never` first**, then widen to a subtype of the assignee's type. `unknown` cannot substitute here (it is only assignable to `unknown`); `never` is the bottom type, assignable to everything.

## The one acceptable exception — generic *constraints*

`any` is acceptable in a generic **constraint**, and only there. It bounds a type parameter without being assigned to a value, so it neither pollutes nor infects.

```typescript
class BaseController<
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Messenger extends RestrictedMessenger<N, any, any, string, string>,
> // ...
```

Three conditions attach:

- **Declare it explicitly.** `no-explicit-any` is `error`, so a constraint `any` needs an inline `// eslint-disable-next-line @typescript-eslint/no-explicit-any` at the site — a deliberate, visible exception.
- **Constraints only — never a generic _argument_.** Passing `any` as an argument (`ControllerMessenger<any, any>`) is 🚫 — that assigns `any` and infects. Constraint-vs-argument is the whole distinction.
- **Prefer a narrower constraint anyway.** Reach for `any` here only when the narrower bound is genuinely unavailable.

When `any` still seems unavoidable, prefer the narrower, greppable escape hatches: `as unknown as` as a documented last resort, or `@ts-expect-error` with a TODO. Never reach for `any` to unblock feature work "to fix later."
