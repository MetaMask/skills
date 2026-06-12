---
name: migrate-wagmi-metamask-connector
description: Migrate a wagmi app from @metamask/sdk to the new @metamask/connect-evm connector (wagmi PR #4960)
maturity: stable
---
# Migrate Wagmi MetaMask Connector to @metamask/connect-evm

## When to use
- Upgrading a wagmi project from `@wagmi/connectors` v6.x/v7.x (which bundled `@metamask/sdk`) to v8.x+ / wagmi >= 3.6 (which uses `@metamask/connect-evm`)
- You see errors like `Cannot find module '@metamask/sdk'` after updating wagmi
- You want to adopt the new MetaMask Connect SDK in an existing wagmi app
- Consumer is migrating to the latest wagmi version that includes the MetaMask connector refactor (PR [#4960](https://github.com/wevm/wagmi/pull/4960))

## Breaking Change Summary

The MetaMask connector in wagmi has been **completely rewritten**. The underlying SDK changed from `@metamask/sdk` to `@metamask/connect-evm`. The connector now dynamically imports `@metamask/connect-evm` instead of bundling `@metamask/sdk`.

**Key impacts:**
- New optional peer dependency: `@metamask/connect-evm` must be installed explicitly, at a version inside wagmi's declared peer range (check `npm info @wagmi/connectors peerDependencies` — currently `^1.3.0`)
- Old dependency `@metamask/sdk` should be removed
- Configuration parameter names changed (`dappMetadata` → `dapp`, `useDeeplink` → `mobile.useDeeplink`)
- Several deprecated SDK-specific options are removed entirely
- Internal provider type changed from `SDKProvider` to `EIP1193Provider`

## Workflow

### Step 1: Update Dependencies

Remove the old SDK and install the new one:

```bash
# npm
npm uninstall @metamask/sdk
npm install @metamask/connect-evm

# pnpm
pnpm remove @metamask/sdk
pnpm add @metamask/connect-evm

# yarn
yarn remove @metamask/sdk
yarn add @metamask/connect-evm
```

Then update wagmi packages to the latest:

```bash
npm install wagmi@latest @wagmi/core@latest @wagmi/connectors@latest
```

### Step 2: Update MetaMask Connector Configuration

#### Before (old `@metamask/sdk` options):

```typescript
import { metaMask } from 'wagmi/connectors'

metaMask({
  dappMetadata: {
    name: 'My Dapp',
    url: 'https://mydapp.com',
  },
  useDeeplink: true,
  logging: { sdk: false },
  // These SDK-specific options are REMOVED:
  forceDeleteProvider: false,
  forceInjectProvider: false,
  injectProvider: false,
})
```

#### After (new `@metamask/connect-evm` options):

```typescript
import { metaMask } from 'wagmi/connectors'

metaMask({
  dapp: {
    name: 'My Dapp',
    url: 'https://mydapp.com',
    iconUrl: 'https://mydapp.com/icon.png', // new optional field
  },
  debug: false,
  // Mobile options are now nested:
  mobile: {
    useDeeplink: true,
    preferredOpenLink: undefined, // required for React Native
  },
})
```

### Step 3: Configuration Parameter Migration Reference

| Old Parameter (`@metamask/sdk`) | New Parameter (`@metamask/connect-evm`) | Notes |
|---|---|---|
| `dappMetadata: { name, url }` | `dapp: { name, url, iconUrl }` | `dappMetadata` still works but is deprecated |
| `logging: { sdk: true }` | `debug: true` | `logging` still works but is deprecated |
| `useDeeplink: boolean` | `mobile: { useDeeplink: boolean }` | Moved into `mobile` namespace |
| `preferredOpenLink` | `mobile: { preferredOpenLink }` | Moved into `mobile` namespace |
| `forceDeleteProvider` | *(removed)* | No replacement — not needed with new SDK |
| `forceInjectProvider` | *(removed)* | No replacement — not needed with new SDK |
| `injectProvider` | *(removed)* | No replacement — not needed with new SDK |
| `readonlyRPCMap` | *(auto-configured)* | Built automatically from wagmi's chain config |
| `_source` | *(auto-set to 'wagmi')* | Set internally by the connector |

### Step 4: Update connectAndSign / connectWith Usage (if applicable)

The `connectAndSign` parameter name changed from `msg` to `message` internally. However, at the wagmi connector level the API is the same — you still pass `connectAndSign: 'message string'` in the `metaMask()` parameters.

```typescript
// Still works the same at the wagmi config level:
metaMask({
  dapp: { name: 'My Dapp' },
  connectAndSign: 'Please sign this message to verify your identity',
})
```

The `connectWith` API is also unchanged at the wagmi level:

```typescript
metaMask({
  dapp: { name: 'My Dapp' },
  connectWith: {
    method: 'eth_signTypedData_v4',
    params: [address, typedData],
  },
})
```

### Step 5: Handle Provider Type Changes

If your code directly accesses the provider from the connector, the type has changed:

```typescript
// Before: provider was SDKProvider from @metamask/sdk
// After: provider is EIP1193Provider from @metamask/connect-evm

// The EIP1193Provider interface is the same standard interface,
// so provider.request() calls remain unchanged.

// New: You can access the underlying MetamaskConnectEVM instance:
const connector = config.connectors.find(c => c.id === 'metaMaskSDK')
if (connector) {
  const instance = await connector.getInstance()
  // instance.accounts, instance.getChainId(), instance.switchChain(), etc.
}
```

### Step 6: Remove Deprecated Patterns

The new connector handles event listeners internally. If you had code that manually managed MetaMask SDK event listeners, you can remove it:

```typescript
// REMOVE any manual SDK event management like:
// sdk.on('accountsChanged', ...)
// sdk.on('chainChanged', ...)
// provider.removeListener(...)

// Event handlers are now passed to createEVMClient internally.
// Wagmi hooks (useAccount, useChainId, etc.) handle state automatically.
```

### Step 7: Additional Wagmi API Renames (same major version)

This wagmi release also includes several API renames. Deprecated aliases are provided but you should migrate:

| Old API | New API | Package |
|---|---|---|
| `useAccount()` | `useConnection()` | `wagmi` |
| `useAccountEffect()` | `useConnectionEffect()` | `wagmi` |
| `useSwitchAccount()` | `useSwitchConnection()` | `wagmi` |
| `getAccount()` | `getConnection()` | `@wagmi/core` |
| `switchAccount()` | `switchConnection()` | `@wagmi/core` |
| `watchAccount()` | `watchConnection()` | `@wagmi/core` |
| `WagmiConfig` | `WagmiProvider` | `wagmi` (alias removed) |
| `useToken()` | `useReadContracts()` | `wagmi` (hook removed) |
| `useFeeData()` | `useEstimateFeesPerGas()` | `wagmi` (alias removed) |
| `normalizeChainId()` | *(removed)* | `wagmi` (export removed) |

### Step 8: Verify the Migration

After making changes, verify:

1. **Build succeeds** — `npm run build` or `tsc --noEmit` should pass
2. **No `@metamask/sdk` imports remain** — search your codebase:
   ```bash
   grep -r "@metamask/sdk" --include="*.ts" --include="*.tsx" --include="*.js"
   ```
3. **Wallet connection works** — test connecting via MetaMask browser extension
4. **Mobile deep-link works** (if applicable) — test QR code / deep-link flow
5. **Chain switching works** — test switching between configured chains
6. **Signing works** — test message signing and transaction signing

## Complete Before/After Example

### Before (`@wagmi/connectors` <= 7.x + @metamask/sdk):

```typescript
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia, optimism } from 'wagmi/chains'
import { metaMask } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia, optimism],
  connectors: [
    metaMask({
      dappMetadata: {
        name: 'My Dapp',
        url: window.location.origin,
      },
      useDeeplink: true,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
  },
})
```

### After (wagmi >= 3.6 / `@wagmi/connectors` >= 8 + @metamask/connect-evm):

```typescript
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia, optimism } from 'wagmi/chains'
import { metaMask } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia, optimism],
  connectors: [
    metaMask({
      dapp: {
        name: 'My Dapp',
        url: window.location.origin,
      },
      mobile: {
        useDeeplink: true,
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
  },
})
```

## React Native Specific Migration

If you are using wagmi with React Native, the `preferredOpenLink` callback has moved:

```typescript
// Before:
metaMask({
  dappMetadata: { name: 'My RN App' },
  preferredOpenLink: (link, target) => Linking.openURL(link),
  useDeeplink: true,
})

// After:
metaMask({
  dapp: { name: 'My RN App' },
  mobile: {
    preferredOpenLink: (link, target) => Linking.openURL(link),
    useDeeplink: true,
  },
})
```

## Important Notes
- `@metamask/connect-evm` is an **optional peer dependency** of `@wagmi/connectors` — you only need it if you use the `metaMask()` connector
- The connector ID remains `'metaMaskSDK'` and the name remains `'MetaMask'` — no changes to connector identity
- The connector's `rdns` is `['io.metamask', 'io.metamask.mobile']` — unchanged
- The `supportedNetworks` map is now auto-built from wagmi's configured chains and their default RPC URLs — you no longer need to pass `readonlyRPCMap`
- The `dappMetadata` parameter still works (it's mapped to `dapp` internally) but is deprecated — migrate to `dapp` for forward compatibility
- The `logging` parameter still works (mapped to `debug: true`) but is deprecated
- If no `dapp` config is provided, the connector defaults to `{ name: window.location.hostname, url: window.location.href }` in browsers, or `{ name: 'wagmi' }` in Node.js/SSR
