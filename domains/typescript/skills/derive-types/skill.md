---
name: derive-types
description: Derive types from authoritative sources (indexed access, `typeof`, `ReturnType`/`Parameters`, `Pick`/`Omit`, `Infer<typeof struct>`) instead of hand-writing ad-hoc types that duplicate, run too wide, and drift.
maturity: experimental
---

# Derive Types From Authoritative Sources

Deepens the TypeScript guidance in `mms-coding-guidelines`, and is the structural counterpart to the contributor-docs rule *Prefer type inference over annotations and assertions* (`MetaMask/contributor-docs` `docs/typescript.md`). Where inference handles values, derivation handles types that reference other types.

## Derive, don't re-declare

When a type already exists at an authoritative source — a controller's state type, a function's return, a library's exported type, a schema/struct — **derive from it** rather than restating it. Derive with indexed access (`State['field']`), `typeof`, `ReturnType` / `Parameters`, utility types (`Pick` / `Omit` / `Partial`), and `Infer<typeof struct>`; let inference carry the rest. Inferred and derived types stay "responsive to changes in code," while hand-written declarations "rely on hard-coding, making them brittle against code drift."

An ad-hoc type — one hand-defined to describe a value an authoritative type already describes — carries three dangers:

- **Duplication.** The same shape is stated twice; every reader reconciles them and every change touches both.
- **Incorrect, usually too wide.** A hand-written type is a _guess_ at the source's shape, and the guess is almost always looser than the real type — it admits values the authoritative type would reject, so invalid data still type-checks.
- **Drift.** The source evolves; the copy does not. Because it is hand-written rather than derived, the compiler cannot flag the divergence — the bug surfaces at runtime, not at build.

## A grounded example (`metamask-extension` #42583)

A `wallet-services` module hand-wrote a slice of `NetworkController` state instead of deriving it.

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

## Rule

Before writing a type, ask where the value comes from and whether that source already types it. If it does, derive. Define a fresh type only when no authoritative source exists — a genuinely new shape at a boundary you own. Before defining, exhaust deriving: search the internal `@metamask/*` packages and the consuming repo for the authoritative source first.
