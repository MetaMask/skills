---
name: component-testing
description: >-
  Jest and Testing Library standards for MetaMask Design System (MMDS)
  components on React and React Native: test the public prop contract,
  built-in matchers (toHaveClass on web, toHaveStyle with tw on native),
  proportional optional-slot tests, mocks and async, and the 100% coverage
  policy without istanbul ignores. Use when writing, fixing, or reviewing
  tests for MMDS components, or when coverage thresholds fail.
maturity: stable
---

# MMDS component tests

Tests lock in a component's public contract on both platforms, at the 100%
coverage thresholds the packages enforce.

Lookup order: `knowledge/mmds-sources.md` (source:
[`../../knowledge/mmds-sources.md`](../../knowledge/mmds-sources.md)). For a
pattern, mirror an existing test in the same package that follows these rules.

## When to use

- Adding or changing tests for an MMDS component.
- A coverage threshold fails.

Product app tests in Extension and Mobile are out of scope (`extension-testing`,
`mobile-testing`).

## Workflow

1. List the public props and states from the component's types.
2. Write one behavior per test against that contract.
3. Run the package tests with coverage and fix gaps by testing or by
   removing dead code, never by ignoring it.

## Structure

- Never use "should" in test names. Group with `describe` per unit, and
  `when ...` / `if ...` blocks for scenarios.
- Arrange, act, assert, visually separated. One behavior per test; split a
  name that needs "and".
- Colocate `<ComponentName>.test.tsx` with the component.

## Contract, not implementation

- Assert what the props guarantee, not internals. No existence-only
  assertions when a stronger one exists, and no reading `.props` directly.
- Cover every public variant and state prop. Prefer table-driven tests for
  variant matrices.
- Include accessibility assertions with built-in matchers
  (`toBeDisabled()`, `toHaveAccessibilityValue()`).

```tsx
// ❌ expect(getByTestId('button').props.onPress).toBeDefined();
// ✅
const onPress = jest.fn();
render(<Button onPress={onPress} testID="button">Label</Button>);
fireEvent.press(getByTestId('button'));
expect(onPress).toHaveBeenCalledTimes(1);
```

## Optional slots

- Cover the documented usage: omitted or `undefined`, a meaningful string or
  element, and `false` when callers use it to hide the slot.
- Do not test undocumented values (`0`, empty string) unless the types or
  README support them or you are fixing a documented regression.
- No helpers or micro-suites about `&&` versus ternaries. Assert what renders.
  Slot rendering rules: `component-architecture`.
- One high-signal test per branch for mutual exclusion or priority.

## Queries and matchers

| | React web | React Native |
| --- | --- | --- |
| Select | `getByRole`, `getByTestId` | `getByTestId`, `queryByTestId` |
| Presence | `toBeInTheDocument()` | `toBeOnTheScreen()` |
| Styles | `toHaveClass('<class>')` for preset classes; `toHaveStyle` only for inline styles | `toHaveStyle(tw\`<classes>\`)`, or a single property |
| Other | `toHaveTextContent`, `toBeDisabled`, `toHaveAttribute` | `toHaveTextContent`, `toBeDisabled` |

- Web: never assert computed styles for preset classes.
- Native: use the built-in `toHaveStyle`; never add a local `flattenStyles`
  helper. Avoid depending on `style[0]` order. Assert resolved styles for
  `twClassName`, including precedence when `twClassName` and `style` are both
  passed.

## Style tests

- Do not add tests only to assert unconditional default classes, unless
  coverage needs them.
- When a style condition is removed, remove its tests, and update docs that
  describe it.

## Isolation, mocks, async

- Tests are independent and order-agnostic; clear or reset mocks between
  tests.
- Mock external dependencies not under test; prefer test-local mocks.
- Wrap async interactions that update state in `act(async () => { ... })`.
  Cover success and failure.

## Coverage policy

- Never `/* istanbul ignore next */`.
- For code that genuinely cannot run in Jest (animation callbacks, exhaustive
  `switch` defaults, platform-only code), set an explicit per-file threshold
  in the package Jest config with a comment saying why.
- Prefer deleting code to excluding it.

## Checklist

- [ ] Public props and states covered with contract assertions.
- [ ] Built-in matchers; no new `flattenStyles` helpers.
- [ ] Interactive components have accessibility assertions.
- [ ] Optional-slot tests match the documented API only.
- [ ] No istanbul ignores; any reduced threshold is explained.
- [ ] Package tests pass at the coverage thresholds.
