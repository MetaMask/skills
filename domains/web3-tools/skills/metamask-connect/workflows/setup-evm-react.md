# Setup EVM React App with MetaMask Connect

## When to use

Use this skill when:
- Creating a new React app that connects to MetaMask via `@metamask/connect-evm`
- Adding wallet connect, sign, or send functionality to an existing React app
- Setting up `createEVMClient` with Infura RPC URLs and event handlers
- Building a React component that tracks accounts, chain, and balance state

## Workflow

### Step 1: Install dependencies

```bash
npm install @metamask/connect-evm @metamask/connect-multichain
```

`@metamask/connect-multichain` is a regular dependency of `@metamask/connect-evm` and is installed transitively. (Only the 2.0.0 release briefly made it a peer dependency; 2.1.0 reverted that.) Installing it explicitly is harmless but not required. The SDK warns at runtime if duplicate or mismatched copies are resolved.

### Step 2: Create the EVM client

Create a module that initializes the client once and exports a ready promise:

```typescript
// src/metamask.ts
import { createEVMClient, getInfuraRpcUrls } from '@metamask/connect-evm';
import type { MetamaskConnectEVM } from '@metamask/connect-evm';

let clientPromise: Promise<MetamaskConnectEVM> | null = null;

export function getClient(): Promise<MetamaskConnectEVM> {
  if (!clientPromise) {
    clientPromise = createEVMClient({
      dapp: {
        name: 'My React DApp',
        url: window.location.href,
      },
      api: {
        supportedNetworks: {
          ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1', '0x89', '0xaa36a7'] }),
          '0xa4b1': 'https://arb1.arbitrum.io/rpc',
        },
      },
      ui: {
        headless: false,
        preferExtension: true,
        showInstallModal: true,
      },
      eventHandlers: {
        displayUri: (uri: string) => {
          console.log('QR URI:', uri);
        },
      },
      debug: false,
    });
  }
  return clientPromise;
}
```

`getInfuraRpcUrls({ infuraApiKey, chainIds? })` returns a `Record<Hex, string>` mapping hex chain IDs to Infura RPC URLs for all Infura-supported EVM chains. Pass an optional `chainIds` array (hex strings, e.g. `['0x1', '0x89']`) to limit the output to specific chains. Spread it into `supportedNetworks` and add custom RPCs for any additional chains.

### Step 3: Build the wallet component

Use `useRef` to hold the client instance and `useState` for reactive UI state:

```tsx
// src/WalletConnect.tsx
import { useEffect, useRef, useState, useCallback } from 'react';
import { getClient } from './metamask';
import type { MetamaskConnectEVM } from '@metamask/connect-evm';
import type { Hex, Address } from '@metamask/connect-evm';

export function WalletConnect() {
  const clientRef = useRef<MetamaskConnectEVM | null>(null);
  const [accounts, setAccounts] = useState<Address[]>([]);
  const [chainId, setChainId] = useState<Hex | null>(null);
  const [balance, setBalance] = useState<string>('');
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const client = await getClient();
      if (!mounted) return;
      clientRef.current = client;

      const provider = client.getProvider();

      provider.on('accountsChanged', (accs: Address[]) => {
        if (mounted) setAccounts(accs);
      });

      provider.on('chainChanged', (id: Hex) => {
        if (mounted) setChainId(id);
      });

      provider.on('disconnect', () => {
        if (mounted) {
          setAccounts([]);
          setChainId(null);
          setBalance('');
        }
      });
    }

    init();
    return () => { mounted = false; };
  }, []);

  const handleConnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    setConnecting(true);
    setError(null);

    try {
      const result = await client.connect({ chainIds: ['0x1'] });
      setAccounts(result.accounts as Address[]);
      setChainId(result.chainId as Hex);
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Connection rejected. Please try again.');
        return;
      }
      if (err.code === -32002) {
        setError('A connection request is already pending. Check MetaMask.');
        return;
      }
      setError(err.message ?? 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.disconnect();
    setAccounts([]);
    setChainId(null);
    setBalance('');
  }, []);

  const fetchBalance = useCallback(async () => {
    const client = clientRef.current;
    if (!client || accounts.length === 0) return;

    const provider = client.getProvider();
    const wei = await provider.request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest'],
    }) as Hex;

    const ethBalance = parseInt(wei, 16) / 1e18;
    setBalance(ethBalance.toFixed(6));
  }, [accounts]);

  // chainConfiguration must match the target chain (and include its chainId) —
  // the wallet receives it verbatim as wallet_addEthereumChain params
  const handleSwitchToPolygon = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    try {
      await client.switchChain({
        chainId: '0x89',
        chainConfiguration: {
          chainId: '0x89',
          chainName: 'Polygon',
          nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
          rpcUrls: ['https://polygon-rpc.com'],
          blockExplorerUrls: ['https://polygonscan.com'],
        },
      });
    } catch (err: any) {
      if (err.code === 4001) {
        setError('Chain switch rejected by user.');
      }
    }
  }, []);

  const isConnected = accounts.length > 0;

  if (!isConnected) {
    return (
      <div>
        <button onClick={handleConnect} disabled={connecting}>
          {connecting ? 'Connecting...' : 'Connect MetaMask'}
        </button>
        {error && <p style={{ color: 'red' }}>{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <p>Account: {accounts[0]}</p>
      <p>Chain ID: {chainId}</p>
      <p>Balance: {balance || '—'} ETH</p>
      <button onClick={fetchBalance}>Refresh Balance</button>
      <button onClick={handleSwitchToPolygon}>Switch to Polygon</button>
      <button onClick={handleDisconnect}>Disconnect</button>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
}
```

### Step 4: Use provider.request for RPC calls

Once connected, use the EIP-1193 provider for any Ethereum JSON-RPC method:

```typescript
const provider = client.getProvider();

// Get current block number
const blockNumber = await provider.request({ method: 'eth_blockNumber' });

// Get chain ID
const chainId = await provider.request({ method: 'eth_chainId' });

// Get accounts
const accounts = await provider.request({ method: 'eth_accounts' });

// Get balance
const balance = await provider.request({
  method: 'eth_getBalance',
  params: [accounts[0], 'latest'],
});

// Get transaction count (nonce)
const nonce = await provider.request({
  method: 'eth_getTransactionCount',
  params: [accounts[0], 'latest'],
});
```

### Step 5: Switch chains

Use `client.switchChain` to request a network change. The `chainConfiguration` fallback triggers `wallet_addEthereumChain` if the chain is not already in the user's wallet:

```typescript
await client.switchChain({
  chainId: '0xaa36a7', // Sepolia
});

// With fallback configuration for unknown chains
await client.switchChain({
  chainId: '0xa4b1', // Arbitrum One
  chainConfiguration: {
    chainId: '0xa4b1', // optional in the type, but set it to the target chain — if omitted it falls back to the currently selected chain (likely the wrong chain to add)
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io'],
  },
});
```

### Step 6: Handle errors

Always catch and handle known error codes:

```typescript
try {
  await client.connect({ chainIds: ['0x1'] });
} catch (err: any) {
  switch (err.code) {
    case 4001:
      // User rejected the request — show retry UI
      break;
    case -32002:
      // Request already pending — tell user to check MetaMask
      break;
    default:
      console.error('Unexpected error:', err);
  }
}
```

## Important Notes

- **Call `createEVMClient` once at app startup** — store the promise and reuse it; never call it per render. Each call returns a *new* EVM client wrapper, but they all share one underlying multichain core (the core is the singleton, and its options are merged across calls).
- **Chain IDs are always hex strings** — use `'0x1'` (Ethereum), `'0x89'` (Polygon), `'0xaa36a7'` (Sepolia). Never use decimal numbers.
- **`0x1` (Ethereum mainnet) is always auto-included** in `connect()` regardless of the `chainIds` you pass.
- **The provider exists before connection** — `client.getProvider()` never returns `undefined`. But node-routed reads (`eth_blockNumber`, `eth_getBalance`, `eth_call`, …) require a **selected chain** and throw `No chain ID selected` until one is set (after `connect()` or a restored session). Only the intercepted methods `eth_chainId` and `eth_accounts` (served from cached state) are safe before connecting.
- **Register event listeners early** — set up `accountsChanged`, `chainChanged`, and `disconnect` listeners in `useEffect` before the user connects.
- **Error code 4001 is not an application error** — it means the user deliberately rejected. Handle it gracefully with a retry option.
- **Error code -32002 means a request is pending** — do not fire another `connect()` call. Wait for the user to act in MetaMask.
