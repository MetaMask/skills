---
maturity: experimental
name: ts2589-workaround
description: Fix TS2589 "type instantiation is excessively deep" in Expect<> constraints by pre-resolving complex conditionals to boolean before the constraint sees them.
---

# TS2589 Workaround: Pre-Resolve Before Expect

## When To Use

- A test file hits TS2589 on `Expect<SomeComplexType, Expected>`
- The failing type involves union distribution, `infer` chains, or multi-step conditionals
- `Expect<ComplexConditional>` fails even though the type itself resolves correctly

## Do Not Use When

- TS2589 is in production code, not test assertions — fix the type itself, don't work around it
- The type is simple enough that TypeScript resolves it without hitting the depth limit

## Workflow

1. Extract the complex type to a standalone alias
2. Manually flatten the equivalence check to `true`/`false` using an extends-pair
3. Feed the boolean result to `Expect<>`, not the original type

```typescript
// 1. Extract to alias
type Resolved = ComplexConditional<Input, true>;

// 2. Flatten to boolean
type Check = [Resolved] extends [Expected]
  ? [Expected] extends [Resolved]
    ? true
    : false
  : false;

// 3. Feed boolean to Expect
Expect<Check>
```

## Common Pitfalls

| Mistake | Correct Approach |
|---------|-----------------|
| Using `type Resolved = ComplexType` then `Expect<Resolved, Expected>` | TypeScript does not eagerly resolve aliases before constraint-checking — it re-expands inline. Use the manual extends-pair flatten. |
| Wrapping in a utility type | Any utility that re-introduces a conditional constraint re-triggers depth expansion. Flatten to `true`/`false` directly. |
