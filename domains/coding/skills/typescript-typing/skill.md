---
name: typescript-typing
description: TypeScript typing discipline — treat `any` as a directive that disables type checking (substitute by position: assignee → `unknown`, assigned → `never`), and derive types from authoritative sources rather than hand-writing ad-hoc ones that duplicate and drift.
maturity: experimental
---

# TypeScript Typing Discipline

Deepens the TypeScript section of `mms-coding-guidelines` — which already says "avoid `any`, prefer `unknown`" and links `MetaMask/contributor-docs` `docs/typescript.md`. This skill is the reasoning layer underneath those bullets: why `any` is dangerous and how to replace it by position, and how to avoid hand-writing a type that an authoritative source already defines. Grounded in `docs/typescript.md` (§ Avoid `any`, § Prefer type inference).

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

## Derive types from authoritative sources — don't hand-write ad-hoc ones

When a type already exists at an authoritative source — a controller's state type, a function's return, a library's exported type, a schema/struct — **derive from it** rather than restating it. Derive with indexed access (`State['field']`), `typeof`, `ReturnType` / `Parameters`, utility types (`Pick` / `Omit` / `Partial`), and `Infer<typeof struct>`; let inference carry the rest. This is the structural form of the contributor-docs rule *Prefer type inference over annotations and assertions*: inferred and derived types stay "responsive to changes in code," while hand-written declarations "rely on hard-coding, making them brittle against code drift."

An ad-hoc type — one hand-defined to describe a value an authoritative type already describes — carries three dangers:

- **Duplication.** The same shape is stated twice; every reader reconciles them and every change touches both.
- **Incorrect, usually too wide.** A hand-written type is a _guess_ at the source's shape, and the guess is almost always looser than the real type — it admits values the authoritative type would reject, so invalid data still type-checks.
- **Drift.** The source evolves; the copy does not. Because it is hand-written rather than derived, the compiler cannot flag the divergence — the bug surfaces at runtime, not at build.

**A grounded example (`metamask-extension` #42583).** A `wallet-services` module hand-wrote a slice of `NetworkController` state instead of deriving it.

🚫 Re-declared — every field optional (wider than the real, _required_ field), keyed by `string` not `Hex`, and unlinked from the source, so it drifts silently when the controller changes:

```typescript
type NetworkControllerState = {
  networkConfigurationsByChainId?: Record<
    string,
    {
      defaultRpcEndpointIndex?: number;
      rpcEndpoints?: { networkClientId?: string }[];
    }
  >;
};
```

✅ Derived — tracks the authoritative shape (`Record<Hex, NetworkConfiguration>`), narrowed to the one field in use:

```typescript
import type { NetworkState } from '@metamask/network-controller';

type NetworkConfigurations = NetworkState['networkConfigurationsByChainId'];
```

A too-wide copy does not save work; it moves the work downstream. The same PR typed a dependency as `getMetaMaskState: () => Record<string, unknown>`, so every consumer then had to re-cast the shape back by hand — including a `{ metamask: getMetaMaskState() } as never` double-cast. Deriving that dependency from the authoritative state type deletes the casts. The same file _did_ derive one type correctly (`type Action = (typeof ACTIONS)[number]`), so the pattern was already in hand; the discipline is extending it to every referenced type.

**Rule:** before writing a type, ask where the value comes from and whether that source already types it. If it does, derive. Define a fresh type only when no authoritative source exists — a genuinely new shape at a boundary you own. Before defining, exhaust deriving: search the internal `@metamask/*` packages and the consuming repo for the authoritative source first.
