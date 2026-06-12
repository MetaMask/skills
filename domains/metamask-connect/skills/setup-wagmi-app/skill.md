---
name: setup-wagmi-app
description: Set up a React or React Native app with wagmi and a MetaMask connector implementation that matches your installed @metamask/connect-evm version. Use when integrating MetaMask with wagmi, configuring the metaMask() connector, or building connect/sign/send flows.
maturity: stable
---
# Setup wagmi App with MetaMask

## When to use

Use this skill when:
- Integrating MetaMask with wagmi in a React or React Native app
- Configuring the `metaMask()` wagmi connector for `@metamask/connect-evm`
- Building connect, sign message, send transaction, or switch chain flows
- Debugging wagmi + MetaMask connector issues

## Workflow

### Step 1: Install dependencies

```bash
npm install wagmi @tanstack/react-query viem

# Install the @metamask/connect-evm version wagmi declares as its peer range
# (check with: npm info @wagmi/connectors peerDependencies — currently ^1.3.0):
npm install @metamask/connect-evm@"^1.3.0"
```

The connect-evm-backed `metaMask()` connector requires **wagmi >= 3.6 / `@wagmi/connectors` >= 8**. Match `@metamask/connect-evm` to wagmi's declared optional peer range rather than installing "latest" — the current 2.x line does not satisfy `^1.3.0`. `@metamask/connect-multichain` is installed transitively; you do not need to add it.

### Step 2: Create wagmi config (browser)

```typescript
import { createConfig, http } from 'wagmi';
import { mainnet, sepolia, optimism, celo } from 'wagmi/chains';
// Requires wagmi >= 3.6 / @wagmi/connectors >= 8. On older wagmi, copy the
// reference connector from connect-monorepo/integrations/wagmi/metamask-connector.ts
import { metaMask } from 'wagmi/connectors';

export const wagmiConfig = createConfig({
  chains: [mainnet, sepolia, optimism, celo],
  connectors: [
    metaMask({
      dapp: {
        name: 'My DApp',
        url: typeof window !== 'undefined' ? window.location.href : undefined,
        iconUrl: undefined, // optional
      },
      mobile: {
        preferredOpenLink: undefined, // React Native: (deeplink) => Linking.openURL(deeplink)
        useDeeplink: undefined,
      },
      connectAndSign: undefined, // optional
      connectWith: undefined, // optional { method, params }
      debug: false,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
    [celo.id]: http(),
  },
});
```

**Connector parameters (`metaMask(parameters?)`):**

| Parameter | Type | Description |
|-----------|------|-------------|
| `dapp` | `{ name, url?, iconUrl? }` | DApp metadata. Deprecated: `dappMetadata` maps to `dapp` |
| `mobile.preferredOpenLink` | `(deeplink) => void` | RN: `(deeplink) => Linking.openURL(deeplink)` |
| `mobile.useDeeplink` | `boolean` | Use deeplink for mobile |
| `connectAndSign` | `string` | Optional |
| `connectWith` | `{ method, params }` | Optional |
| `debug` | `boolean` | Enable debug logs |

**Connector id:** `'metaMaskSDK'`, **name:** `'MetaMask'`

### Step 3: Provider hierarchy (React)

```tsx
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      gcTime: 1_000 * 60 * 60 * 24,
      networkMode: 'offlineFirst',
      refetchOnWindowFocus: false,
      retry: 0,
    },
    mutations: { networkMode: 'offlineFirst' },
  },
});

<WagmiProvider config={wagmiConfig}>
  <QueryClientProvider client={queryClient}>
    <App />
  </QueryClientProvider>
</WagmiProvider>
```

### Step 4: React Native polyfills (before wagmi config)

Import polyfills **before** any wagmi/viem imports:

```typescript
// At the very top of your entry file (e.g. index.js or App.tsx)
import 'react-native-get-random-values';
import { Buffer } from 'buffer';
global.Buffer = Buffer;
// window, Event, CustomEvent, metro shims as per RN skills
```

Add to `metaMask()` params:

```typescript
import { Linking } from 'react-native';

metaMask({
  dapp: { name: 'My DApp', url: '...' },
  mobile: {
    preferredOpenLink: (deeplink) => Linking.openURL(deeplink),
  },
})
```

Use `createAsyncStoragePersister` with AsyncStorage instead of localStorage for persistence.

### Step 5: Full component example

```tsx
import { useConnection, useBalance, useConnect, useConnectors, useDisconnect, useSendTransaction, useSignMessage, useSwitchChain, useChains, useChainId } from 'wagmi';
import { parseEther, formatEther } from 'viem';

function WalletDemo() {
  const { address, isConnected, status } = useConnection();
  const { data: balance } = useBalance({ address });
  const { mutateAsync: connectAsync, status: connectStatus } = useConnect();
  const connectors = useConnectors();
  const { disconnect } = useDisconnect();
  const { sendTransactionAsync } = useSendTransaction();
  const { signMessageAsync } = useSignMessage();
  const { switchChainAsync } = useSwitchChain();
  const chains = useChains();
  const chainId = useChainId();

  const metaMaskConnector = connectors.find((c) => c.id === 'metaMaskSDK');

  const handleConnect = async () => {
    if (!metaMaskConnector) return;
    await connectAsync({ connector: metaMaskConnector, chainId: 1 });
  };

  const handleSignMessage = async () => {
    const sig = await signMessageAsync({ message: 'Hello MetaMask!' });
    console.log(sig);
  };

  const handleSendTx = async () => {
    const hash = await sendTransactionAsync({
      to: '0x...' as `0x${string}`,
      value: parseEther('0.001'),
    });
    console.log(hash);
  };

  const handleSwitchChain = async (id: number) => {
    await switchChainAsync({ chainId: id });
  };

  if (!isConnected) {
    return (
      <button onClick={handleConnect} disabled={connectStatus === 'pending'}>
        Connect MetaMask
      </button>
    );
  }

  return (
    <div>
      <p>Address: {address}</p>
      <p>Balance: {balance ? formatEther(balance.value) : '—'} ETH</p>
      <p>Chain: {chainId}</p>
      <button onClick={handleSignMessage}>Sign Message</button>
      <button onClick={handleSendTx}>Send 0.001 ETH</button>
      <select value={chainId} onChange={(e) => handleSwitchChain(Number(e.target.value))}>
        {chains.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <button onClick={() => disconnect()}>Disconnect</button>
    </div>
  );
}
```

**Wagmi hooks used (v3):**
- `useConnection`: `address`, `isConnected`, `status` (renamed from `useAccount` in v3)
- `useBalance`: balance for connected account
- `useConnect`: `mutateAsync` (renamed from `connectAsync`), `status`
- `useConnectors`: standalone hook for connector list (removed from `useConnect` in v3)
- `useDisconnect`: `disconnect`
- `useSendTransaction`: send ETH
- `useSignMessage`: sign messages
- `useSwitchChain`: `switchChainAsync`
- `useChains`: standalone hook for chain list (removed from `useSwitchChain` in v3)
- `useWaitForTransactionReceipt`: tx confirmation
- `useChainId`: current chain
- `useBlockNumber`: current block (`watch: true`)

### Step 6: Connect flow

```typescript
// wagmi v3: connectors come from useConnectors(), and useConnect() exposes
// mutateAsync (connectAsync was the v2 name)
const connectors = useConnectors();
const { mutateAsync: connect } = useConnect();
const metaMaskConnector = connectors.find((c) => c.id === 'metaMaskSDK');
await connect({ connector: metaMaskConnector, chainId: 1 });
```

### Step 7: Error handling

Handle common errors:

- `UserRejectedRequestError` (code 4001)
- `ResourceUnavailableRpcError` (code -32002)
- `SwitchChainError`, `ChainNotConfiguredError`

## Important Notes

- **Connector ID is `'metaMaskSDK'`** — always find it with `connectors.find((c) => c.id === 'metaMaskSDK')`.
- **Wagmi disconnect is separate from multichain disconnect** — disconnecting one does not disconnect the other.
- **CRA/Expo import restriction**: Cannot import from outside `src/` — the connector may need to be copied locally.
- **`isAuthorized` retries on mobile**: The connector wraps `getAccounts()` in `withTimeout` (10ms per attempt) and `withRetry` (3 attempts, ~11ms delay between) because the MetaMask mobile provider sometimes doesn't resolve JSON-RPC requests immediately on page load. It returns `false` on failure (does NOT throw) — it resolves in tens of milliseconds, not seconds.
- **Chains in `wagmiConfig` must match chains you use** — wagmi validates against configured chains.
- **React Native**: Import polyfills before wagmi config; add `mobile.preferredOpenLink`; use `createAsyncStoragePersister` with AsyncStorage. Polyfill requirements: `react-native-get-random-values` first (required for RN < 0.72), then `window` shim (required by connect-multichain for platform detection), then `Event`/`CustomEvent` shims (**wagmi-specific** — wagmi dispatches DOM events; not needed for standalone connect-* usage). Buffer is self-polyfilled by connect-multichain; keep `global.Buffer = Buffer` as a safety net for peer deps.
