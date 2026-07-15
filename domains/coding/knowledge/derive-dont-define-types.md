---
maturity: experimental
name: derive-dont-define-types
description: Derive types from authoritative sources — never hand-write an ad-hoc type that restates one that already exists
---

# Derive Types From Authoritative Sources

When a type already exists at an authoritative source — a controller's state type, a function's return, a library's exported type, a schema — **derive from it** rather than hand-writing a fresh type that restates it. Derive with indexed access (`State['field']`), `typeof`, `ReturnType` / `Parameters`, and utility types (`Pick` / `Omit` / `Partial`), and let inference carry the rest.

This is the structural form of the contributor-docs rule *Prefer type inference over annotations and assertions* (`MetaMask/contributor-docs` `docs/typescript.md`, PR #74): inferred and derived types are "responsive to changes in code, always reflecting up-to-date type information," while hand-written declarations "rely on hard-coding, making them brittle against code drift."

## Why an ad-hoc type is a liability

An ad-hoc type — one hand-defined to describe a value that an authoritative type already describes — carries three dangers:

- **Duplication.** The same shape is now stated in two places. Every reader has to reconcile them, and every change has to touch both.
- **Incorrect, and usually too wide.** A hand-written type is a *guess* at the source's shape, and the guess is almost always looser than the real type — it admits values the authoritative type would reject, so invalid data still type-checks. This is the same failure the guideline warns about in *Avoid unintentionally widening an inferred type*: a wider declaration loses information instead of adding it.
- **Drift.** The source type evolves; the ad-hoc copy does not. It silently goes stale — and because it is hand-written rather than derived, the compiler cannot flag the divergence. The bug surfaces at runtime, not at build.

## Rule

Before writing a type, ask where the value comes from and whether that source already types it. If it does, **derive**. Define a fresh type only when no authoritative source exists — a genuinely new shape at a boundary you own.
