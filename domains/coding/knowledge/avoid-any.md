---
maturity: experimental
name: avoid-any
description: Handle `any` correctly — it is not a type but a directive that disables type checking; substitute by position (assignee → `unknown`, assigned → `never`)
---

# Handling `any`

Grounded in `MetaMask/contributor-docs` `docs/typescript.md` (§ Avoid `any`, PR #74).

## Conceptualize it correctly — `any` is not a type

`any` is the most dangerous explicit type declaration and should be completely avoided. The mental model matters more than the ESLint rule, because `no-explicit-any` alone does not stop the reasoning that reaches for it:

- **`any` is not a type. It is a compiler directive that _disables_ type checking** for the value it's assigned to. It is not "the widest type" — that is `unknown`.
- **It suppresses every error about its assignee** — the equivalent of applying `@ts-ignore` to every use of that variable. The errors still affect the code; `any` only makes them invisible.
- **It subsumes everything it touches.** Any type in a union, intersection, or property relationship with `any` becomes `any` — an unmitigated loss of type information.
- **It infects downstream code.** One `any` at a source (e.g. a library type that resolves to `any`) propagates silently through every consumer. This is its most dangerous property: it converts compile-time errors into **silent runtime failures**, defeating the purpose of a statically-typed language.

## Substitute by POSITION — assignee vs assigned

When tempted to write `any`, first identify which side of an assignment it sits on:

- **Assignee `any`** — the variable, parameter, or return that _receives_ a value ("it could be anything"). **Try `unknown` first**, then narrow to a supertype of the assigned type. `unknown` is the true universal supertype: everything is assignable to it, but it forces a type guard before use. In assignee position `any` and `unknown` are interchangeable, so this is almost always a safe swap.
  - 🚫 `type Fn = () => any; const xs: any[]`
  - ✅ `type Fn = () => unknown; const xs: unknown[]`
- **Assigned `any`** — the value that _flows into_ a slot. **Try `never` first**, then widen to a subtype of the assignee type. `unknown` cannot substitute here (it is only assignable to `unknown`); `never` is the bottom type, assignable to everything.

## Two more cases

- **A generic parameter with a default of `any`** — always supply an explicit type argument. The `any` default silently poisons the instantiation otherwise.
- **`any` inside a generic _constraint_** (e.g. `T extends Struct<any>`) may be acceptable — a constraint position does not assign `any` to a value.

## When it still seems unavoidable

Prefer the narrower, visible escape hatches over `any`: `as unknown as` as a documented, commented last resort, or `@ts-expect-error` with a TODO. Both are scoped and greppable; `any` infects silently. Never reach for `any` to unblock feature work "to fix later" — that is exactly the tech-debt pattern the guideline exists to prevent.
