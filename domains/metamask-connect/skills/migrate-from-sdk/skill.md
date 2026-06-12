---
name: migrate-from-sdk
description: Migrate from @metamask/sdk to @metamask/connect-evm, @metamask/connect-multichain, and @metamask/connect-solana with step-by-step package, API, and configuration changes
maturity: stable
---
# Migrate from @metamask/sdk to @metamask/connect

## When to use

Use this skill when:
- Migrating an existing dApp from `@metamask/sdk` or `@metamask/sdk-react` to the new `@metamask/connect-*` packages
- Updating initialization code, provider access, or event handling for the new API
- Converting a wagmi integration to use the new `metaMask()` connector
- Adding multichain or Solana support during the migration

## Workflow

### Step 1: Replace packages

Remove the old packages and install the new ones:

```bash
# Remove old
npm uninstall @metamask/sdk @metamask/sdk-react

# Install new — pick the packages you need
npm install @metamask/connect-evm
npm install @metamask/connect-multichain
npm install @metamask/connect-solana
```

---

### Step 1b: React Native polyfills (if applicable)

No polyfill configuration is needed for web environments (Vite, Webpack, Next.js, etc.) — `@metamask/connect-*` packages no longer depend on Node.js built-ins in the browser.

**React Native only:** Polyfills must be imported in a specific order. See the `react-native-polyfills` rule for required import order, window/Event/CustomEvent shims, and metro configuration. Note: `Buffer` is self-polyfilled by `@metamask/connect-multichain` but should still be set early as a safety net for peer deps.

---

### Step 2: Update imports

**Old:**

```typescript
import { MetaMaskSDK } from '@metamask/sdk';
import { MetaMaskProvider, useSDK } from '@metamask/sdk-react';
```

**New (EVM):**

```typescript
import { createEVMClient, getInfuraRpcUrls } from '@metamask/connect-evm';
```

**New (Multichain):**

```typescript
import { createMultichainClient } from '@metamask/connect-multichain';
```

**New (Solana):**

```typescript
import { createSolanaClient } from '@metamask/connect-solana';
```

**New (wagmi connector):**

```typescript
// Requires wagmi >= 3.6 / @wagmi/connectors >= 8 (the connect-evm-backed
// connector), with @metamask/connect-evm installed at wagmi's declared peer
// range (currently ^1.3.0). On older wagmi, copy the reference connector
// from connect-monorepo/integrations/wagmi/metamask-connector.ts.
import { metaMask } from 'wagmi/connectors';
```

---

### Step 3: Update initialization

**Old:**

```typescript
const sdk = new MetaMaskSDK({
  dappMetadata: {
    name: 'My DApp',
    url: window.location.href,
  },
  infuraAPIKey: 'YOUR_INFURA_KEY',
  readonlyRPCMap: {
    '0x89': 'https://polygon-rpc.com',
  },
  headless: true,
  extensionOnly: false,
  openDeeplink: (link) => window.open(link, '_blank'),
});
await sdk.init();
```

**New:**

```typescript
const client = await createEVMClient({
  dapp: {
    name: 'My DApp',
    url: window.location.href,
  },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1', '0x89'] }),
      '0xa4b1': 'https://arb1.arbitrum.io/rpc',
    },
  },
  ui: {
    headless: true,
    preferExtension: false,
  },
  // `mobile` block only needed for React Native
  // mobile: {
  //   preferredOpenLink: (link: string) => Linking.openURL(link),
  // },
});
```

**Key option mappings:**

| Old (`MetaMaskSDK`) | New (`createEVMClient`) | Notes |
|---|---|---|
| `dappMetadata` | `dapp` | Same shape: `{ name, url, iconUrl }` |
| `dappMetadata.name` | `dapp.name` | Required |
| `dappMetadata.url` | `dapp.url` | Optional |
| `infuraAPIKey` | `api.supportedNetworks` via `getInfuraRpcUrls({ infuraApiKey: key })` | Helper generates URLs for all Infura-supported chains; optional `chainIds` to limit to specific chains |
| `readonlyRPCMap` | `api.supportedNetworks` | Merge into the same object |
| `headless` | `ui.headless` | Same behavior |
| `extensionOnly` | `ui.preferExtension` | `true` prefers extension (default); not the same as "only" |
| `openDeeplink` | `mobile.preferredOpenLink` | Same signature: `(deeplink: string) => void` |
| `useDeeplink` | `mobile.useDeeplink` | Same behavior |
| `timer` | Removed | No longer configurable |
| `enableAnalytics` | `analytics: { enabled: boolean }` | Pass `analytics: { enabled: false }` at client creation. (A runtime `analytics.disable()` exists on the `@metamask/analytics` singleton — `import { analytics } from '@metamask/analytics'` — it is **not** a method on the connect client.) |
| `communicationServerUrl` | Removed | Managed internally |
| `storage` | Removed | Managed internally |

---

### Step 4: Update connection flow

**Old:**

```typescript
const accounts = await sdk.connect();
const chainId = await sdk.getProvider().request({ method: 'eth_chainId' });
```

**New:**

```typescript
const { accounts, chainId } = await client.connect({
  chainIds: ['0x1'],
});
```

Key differences:
- `connect()` now returns an **object** with both `accounts` and `chainId` — no separate call needed
- `chainIds` parameter specifies which chains to request (hex strings)
- Use `connectAndSign` for connect + personal_sign in one step:

```typescript
const { accounts, chainId, signature } = await client.connectAndSign({
  chainIds: ['0x1'],
  message: 'Sign in to My DApp',
});
```

- Use `connectWith` for connect + arbitrary RPC method:

```typescript
const { accounts, chainId, result } = await client.connectWith({
  chainIds: ['0x1'],
  method: 'eth_sendTransaction',
  params: [{ from: '0x...', to: '0x...', value: '0x0' }],
});
```

---

### Step 5: Update provider access

**Old:**

```typescript
const provider = sdk.getProvider(); // SDKProvider
await provider.request({ method: 'eth_chainId' });
```

**New:**

```typescript
const provider = client.getProvider(); // EIP1193Provider
await provider.request({ method: 'eth_chainId' });
```

Key differences:
- The provider is now a standard **EIP-1193 provider**, not the custom `SDKProvider`
- The provider is available **immediately** after `createEVMClient` resolves — even before `connect()`
- Before connection, RPC calls that require an account will fail; read-only calls (like `eth_blockNumber`) work against `supportedNetworks` RPCs
- No more `sdk.getProvider()` returning `undefined` — the provider always exists

---

### Step 6: Update event handling

**Old:**

```typescript
const provider = sdk.getProvider();
provider.on('chainChanged', (chainId) => { /* ... */ });
provider.on('accountsChanged', (accounts) => { /* ... */ });
provider.on('disconnect', () => { /* ... */ });
```

**New (same EIP-1193 events still work):**

```typescript
const provider = client.getProvider();
provider.on('chainChanged', (chainId) => { /* ... */ });
provider.on('accountsChanged', (accounts) => { /* ... */ });
provider.on('disconnect', () => { /* ... */ });
```

**New (additional SDK-level events via constructor):**

```typescript
const client = await createEVMClient({
  dapp: { name: 'My DApp' },
  eventHandlers: {
    displayUri: (uri) => { /* render QR code */ },
  },
});
```

Or subscribe on the EIP-1193 provider after creation:

```typescript
const provider = client.getProvider();
provider.on('display_uri', (uri) => { /* ... */ });
```

For `wallet_sessionChanged`, use the multichain client directly:

```typescript
const client = await createMultichainClient({ /* ... */ });
client.on('wallet_sessionChanged', (session) => { /* ... */ });
```

---

### Step 7: New capabilities to adopt

These features are **new** in the MetaMask Connect packages and have no old-SDK equivalent:

| Capability | Description |
|---|---|
| **Multichain client** | `createMultichainClient` supports CAIP-25 scopes across EVM and non-EVM chains |
| **`invokeMethod`** | Call RPC methods on specific CAIP scopes: `client.invokeMethod({ scope: 'eip155:1', request: { method, params } })` |
| **Solana support** | `createSolanaClient` from `@metamask/connect-solana` with wallet-standard adapter |
| **`connectAndSign`** | Connect and sign a message in a single user approval |
| **`connectWith`** | Connect and execute any RPC method in a single user approval |
| **Partial disconnect** | `disconnect(scopes)` is available on the multichain client to revoke specific CAIP scopes while keeping others active |
| **Singleton client** | Subsequent `createMultichainClient` calls merge into the existing instance |
| **`wallet_sessionChanged`** | Multichain client event fired when session state changes or is restored |

---

### Step 8: Wagmi migration

**Old:**

```typescript
// Old @metamask/sdk constructor takes flat options (no `options` wrapper):
import { MetaMaskSDK } from '@metamask/sdk';

const sdk = new MetaMaskSDK({
  dappMetadata: { name: 'My DApp', url: window.location.href },
});
// (or the legacy wagmi `metaMask()` connector that wrapped @metamask/sdk)
```

**New:**

```typescript
import { createConfig, http } from 'wagmi';
import { mainnet, sepolia } from 'wagmi/chains';
import { metaMask } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia],
  connectors: [
    metaMask({
      dapp: {
        name: 'My DApp',
        url: typeof window !== 'undefined' ? window.location.href : undefined,
      },
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
  },
});
```

Key differences:
- The connect-evm-backed `metaMask()` connector ships in `wagmi/connectors` from wagmi 3.6 / `@wagmi/connectors` 8 — there is no `@metamask/connect-evm/wagmi` subpath; install `@metamask/connect-evm` at wagmi's declared peer range
- Use `dapp` not `dappMetadata`
- Connector ID is `'metaMaskSDK'` — find it with `connectors.find(c => c.id === 'metaMaskSDK')`
- Most wagmi hooks work unchanged, but note the wagmi v3 renames: `useConnect().connectors` → `useConnectors()`, `connectAsync` → `mutateAsync`, `useAccount` → `useConnection` (see the migrate-wagmi-metamask-connector skill)

---

## Quick Reference: Full Option Mapping

| Old (`@metamask/sdk`) | New (`@metamask/connect-*`) | Status |
|---|---|---|
| `new MetaMaskSDK(opts)` | `await createEVMClient(opts)` | Renamed, async |
| `sdk.init()` | Not needed | Init happens in `createEVMClient` |
| `sdk.connect()` | `client.connect({ chainIds })` | Returns `{ accounts, chainId }` |
| `sdk.getProvider()` | `client.getProvider()` | Returns EIP-1193 provider |
| `sdk.disconnect()` | `client.disconnect()` | Same for EVM; partial disconnect is multichain-only |
| `sdk.terminate()` | `client.disconnect()` | `terminate` is removed — the EVM client's `disconnect()` revokes the EVM (`eip155:*`) scopes; for full multi-ecosystem teardown call the multichain client's `disconnect()` with no arguments |
| `dappMetadata` | `dapp` | Renamed |
| `infuraAPIKey` | `getInfuraRpcUrls({ infuraApiKey: key })` in `api.supportedNetworks` | Helper function; optional `chainIds` filters to specific chains |
| `readonlyRPCMap` | `api.supportedNetworks` | Merged with Infura URLs |
| `headless` | `ui.headless` | Moved to `ui` namespace |
| `extensionOnly` | `ui.preferExtension` | Renamed, slightly different semantics |
| `openDeeplink` | `mobile.preferredOpenLink` | Moved to `mobile` namespace |
| `useDeeplink` | `mobile.useDeeplink` | Moved to `mobile` namespace |
| `MetaMaskProvider` (React) | No direct equivalent | Use wagmi `WagmiProvider` or call `createEVMClient` directly |
| `useSDK()` hook | No direct equivalent | Use wagmi hooks or manage client state manually |
| `SDKProvider` | `EIP1193Provider` | Standard provider interface |
| `timer` | Removed | — |
| `enableAnalytics` | `analytics: { enabled: boolean }` | — |
| `communicationServerUrl` | Removed | — |
| `storage` | Removed | — |

## Important Notes

- **`createEVMClient` is async** — unlike `new MetaMaskSDK()`, it returns a promise. Ensure you `await` it or handle the promise before accessing the client.
- **The multichain core is the singleton** — `createMultichainClient` merges into a shared instance, while EVM/Solana create wrappers on top of that shared core. Do not recreate clients on every render.
- **`connect()` returns an object now** — destructure `{ accounts, chainId }` instead of treating the return value as an accounts array.
- **Chain IDs must be hex strings** — use `'0x1'` not `1` or `'1'` in `chainIds` and `supportedNetworks` keys.
- **No more `sdk.init()`** — initialization is part of `createEVMClient`. There is no separate init step.
- **Provider exists before connection** — `client.getProvider()` never returns `undefined`. But node-routed reads (`eth_blockNumber`, `eth_getBalance`, …) require a **selected chain** and throw `No chain ID selected` until one is set (after `connect()` or a restored session); only the intercepted `eth_chainId` / `eth_accounts` (cached) are safe before connecting.
- **`@metamask/sdk-react` has no 1:1 replacement** — if you were using `MetaMaskProvider` and `useSDK()`, migrate to either wagmi hooks or manage the client instance in your own React context.
- **`sdk.terminate()` is replaced by `disconnect()`** — the EVM client's `disconnect()` revokes EVM (`eip155:*`) scopes only; if the session also has Solana scopes, terminate everything via the multichain client's `disconnect()` with no arguments. There is no separate `terminate` method.
- **Test the migration on both extension and mobile** — the transport layer has changed, and behavior differences may surface in one environment but not the other.
