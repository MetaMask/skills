---
name: type-level-assertions
domain: coding
description: Compile-time type tests using branded uninhabitable types, IsEquivalent guards against any, and mutual-assignability checks.
---

# Type-Level Compile-Time Assertions

Pattern for writing type-level tests that produce compiler errors on failure rather than runtime assertions.

## Core Types

```typescript
type _ = { readonly _: unique symbol };

type IsAny<T> = 0 extends 1 & T ? true : false;
type IsNever<T> = [T] extends [never] ? true : false;

type IsEquivalent<A, B> =
  IsAny<A> extends true ? IsAny<B>
  : IsAny<B> extends true ? false
  : [A, B] extends [B, A] ? true : false;

type Expect<
  X extends [X, V] extends [V, X] ? V : V & _,
  V = true,
> = IsNever<V> extends true ? X
  : IsNever<X> extends true ? Expect<X, V>
  : X;
```

## Usage

Organize assertions in named tuple types. Each element either compiles or produces a type error at the failing assertion.

```typescript
type Describe_MyFeature = [
  Expect<IsEquivalent<Actual, Expected>>,
  Expect<IsEquivalent<EdgeCase, EdgeExpected>, false>,
];
```

## Design Decisions

| Decision | Rationale |
|----------|-----------|
| `_` branded uninhabitable type | `V & _` is unsatisfiable, forcing a type error when `X` doesn't match `V` |
| `IsEquivalent` guards against `any` | Naive `[A, B] extends [B, A]` returns `true` if either side is `any` |
| `IsNever` wraps in tuple | Prevents distributive conditional evaluation over `never` |
| `Expect` uses naive `& _` constraint, not `IsEquivalent` | Referencing `IsEquivalent` in `Expect`'s own bound creates a circular constraint (TS2313) |

## Known Limitation

`Expect<any, string>` passes silently. Use `Expect<IsEquivalent<any, string>>` when `any`-safety matters.

## ESLint Configuration

Type-level spec files (`*.spec.ts`) need relaxed rules:
- Disable `no-unused-vars` (tuple types are never "used")
- Allow `Describe_` prefixed type names
- Exclude E2E test files from these overrides
