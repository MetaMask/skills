---
name: typescript-strict-flag-pattern
domain: coding
description: Fold a wrapper type's stricter constraint into the base type behind a Strict boolean flag parameter instead of duplicating branching logic.
---

# Strict-Flag DRY Pattern

When a wrapper type duplicates branching logic from a base type to add a stricter constraint, fold the constraint into the base type behind a boolean flag.

## Before (duplicated logic)

```typescript
type InferComponent<Module, ...> = /* branch on condition */;

type StrictComponent<Module, ...> =
  ConditionA extends true
    ? InferComponent<Module>
    : ConditionB extends true
      ? InferComponent<Module>
      : never;
```

## After (consolidated)

```typescript
type InferComponent<
  Module,
  Strict extends boolean = false,
  FromNamedExport = Strict extends true
    ? ConditionB extends true
      ? ValidResult
      : never
    : ValidResult,
> = /* single branch on primary condition */;

type StrictComponent<Module> = InferComponent<Module, true>;
```

## When To Apply

- Wrapper type delegates to base type in all passing branches
- Wrapper only adds a `never` gate for certain input shapes
- `Strict = false` default preserves backward compatibility for existing callers

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Keeping the wrapper type after consolidation | Delete it — callers use `Base<Input, true>` directly |
| Setting `Strict = true` as the default | Breaks callers not expecting the stricter behavior |
