---
name: typescript-intermediate-defaults
domain: coding
description: Break complex conditional types into a chain of named intermediate defaulted type parameters instead of nesting conditionals.
---

# Intermediate Defaulted Type Parameters

When a conditional type needs to resolve multiple aspects of a generic input, chain intermediate defaulted parameters instead of nesting conditionals.

## Pattern

```typescript
type InferResult<
  Input extends Record<PropertyKey, unknown>,
  Step1 = Input extends { key: infer V } ? V : never,
  Step2 = [Step1] extends [never] ? false : true,
  Step3 = Step1 extends { nested: infer V } ? V : never,
  Result = Step2 extends true ? Step1 : Fallback,
> = Result;
```

## Why

| Benefit | Detail |
|---------|--------|
| Transparent resolution chain | Each step is named and hoverable in IDE |
| Flat debugging | Hover any parameter to see its resolved value without tracing nested branches |
| Extensible | Adding resolution steps doesn't increase nesting depth |
| Compatible with `import()` inference | Works where deferred conditional evaluation in generics prevents resolution |

## When To Use

- Complex conditional types with 3+ resolution steps
- Types handling multiple structural patterns (default exports, named exports, nested namespaces)
- When deferred conditional evaluation blocks resolution in generic type parameters
