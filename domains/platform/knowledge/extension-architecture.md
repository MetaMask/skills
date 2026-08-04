---
name: extension-architecture
domain: platform
description: MetaMask extension — background/UI boundary, state sync, build types, key directories
---

# Extension Architecture

## Background / UI Boundary

The extension runs two separate JavaScript contexts that cannot share memory.

| Context | Entry | Access |
|---------|-------|--------|
| Background (Service Worker / background page) | `app/scripts/` | DOM-less; controllers, wallet logic |
| UI (popup/tab) | `ui/` | React + Redux; rendering only |
| Shared | `shared/` | Constants, utilities, type definitions |

Communication is message-based (Chrome runtime messaging). Code in `app/scripts/` cannot `import` from `ui/` and vice versa.

## State Sync Flow

```
Controller state changes (app/scripts/)
    ↓
metamask-controller.js batches via debounce (200ms)
    ↓
UI receives batched state via sendUpdate
    ↓
Redux dispatches UPDATE_METAMASK_STATE
    ↓
Immer applies patches (structural sharing — unchanged paths keep stable references)
    ↓
useSelector evaluates; components re-render if output changed
```

Key file: `app/scripts/metamask-controller.js` — aggregates all controller state.

## Build Types

| Build | Command | Background | Security Policy |
|-------|---------|------------|-----------------|
| Development | `yarn start` | Webpack, hot reload | No LavaMoat |
| Production | `yarn dist` | Browserify | LavaMoat enforced |
| Test | `yarn build:test` | Browserify | Partial LavaMoat |

LavaMoat restricts package capabilities at runtime. After adding/updating dependencies, run `yarn lavamoat:auto` to regenerate policies.

## Manifest Versions

| Version | Background | Lifecycle |
|---------|------------|-----------|
| MV3 (Chrome) | Service Worker | Can terminate and restart |
| MV2 (Firefox) | Background Page | Always running |

Errors concentrated in MV3 (99%+) → root cause is service worker lifecycle, not application logic.

## Key Directories

```
app/scripts/
├── controllers/              # Feature controllers (one per domain)
├── lib/                      # Background utilities
└── metamask-controller.js    # Main aggregator; 200ms debounce

ui/
├── components/               # Reusable React components
├── pages/                    # Page-level components
│   ├── routes/               # routes.component.tsx (high selector count)
│   └── home/                 # home.container.js (legacy connect())
├── ducks/                    # Redux slices
├── selectors/                # All selectors
│   ├── selectors.js          # Main file (~2500 lines)
│   └── <feature>.ts          # Feature-specific selectors
└── contexts/                 # React Context providers

shared/
├── constants/
├── lib/
└── modules/
    └── selectors/
        └── selector-creators.ts
```

## React Compiler Scope

Enabled for `ui/components`, `ui/contexts`, `ui/hooks`, `ui/layouts`, `ui/pages`.

Does NOT cross file boundaries — selector values from `useSelector` require manual `useMemo`.
