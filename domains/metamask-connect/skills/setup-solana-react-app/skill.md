---
name: setup-solana-react-app
description: Set up a React app with @metamask/connect-solana and the Solana wallet adapter. Use when integrating MetaMask with Solana in React, configuring WalletProvider, or building connect/sign/send flows with useWallet.
maturity: stable
---
# Setup Solana React App with MetaMask

## When to use

Use this skill when:
- Integrating MetaMask with Solana in a React web application
- Configuring `@solana/wallet-adapter-react` with MetaMask Connect's wallet-standard discovery
- Building connect, sign message, or send transaction flows using `useWallet`
- The MetaMask wallet is not appearing in the Solana wallet adapter

## Workflow

### Step 1: Install dependencies

```bash
npm install @metamask/connect-solana @metamask/connect-multichain @solana/wallet-adapter-react @solana/wallet-adapter-react-ui @solana/wallet-adapter-base @solana/web3.js
```

`@metamask/connect-multichain` is a regular dependency of `@metamask/connect-solana` and is installed transitively. (Only the 2.0.0 release briefly made it a peer dependency; 2.1.0 reverted that.) Installing it explicitly is harmless but not required. The SDK warns at runtime if duplicate or mismatched copies are resolved.

### Step 2: Create the Solana client early in app startup

Initialize `createSolanaClient` early (e.g. in your bootstrap before rendering). It does **not** need to resolve before the first `WalletProvider` render — wallet-standard supports late registration, and the SDK registers the wallet about 1 second after the factory resolves. The adapter picks it up via the wallet-standard register event whenever it lands. If your UI asserts "MetaMask is available" synchronously, gate that specific UI on the client being ready.

```typescript
// src/main.tsx (or index.tsx)
import { createSolanaClient } from '@metamask/connect-solana';
import { createRoot } from 'react-dom/client';
import App from './App';

async function bootstrap() {
  await createSolanaClient({
    dapp: {
      name: 'My Solana DApp',
      url: window.location.href,
    },
  });

  const root = createRoot(document.getElementById('root')!);
  root.render(<App />);
}

bootstrap();
```

**`createSolanaClient` options:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `dapp.name` | `string` | **Required.** Display name of your dApp |
| `dapp.url` | `string` | Optional. dApp URL |
| `dapp.iconUrl` | `string` | Optional. dApp icon |
| `api.supportedNetworks` | `Partial<Record<'mainnet' \| 'devnet' \| 'testnet', string>>` | Map network names to RPC URLs |
| `debug` | `boolean` | Reserved — accepted in the options type but **not currently forwarded** by `createSolanaClient` (no effect yet) |
| `skipAutoRegister` | `boolean` | Skip automatic wallet-standard registration |
| `analytics.integrationType` | `string` | Optional. Tag analytics events with an integration identifier (added in `@metamask/connect-solana` 0.8.0) |

**Solana CAIP chain IDs:**

| Network | CAIP ID |
|---------|---------|
| Mainnet | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Devnet | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Testnet | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` |

### Step 3: Configure the WalletProvider

Pass an **empty** `wallets` array. MetaMask registers via the wallet-standard auto-discovery protocol and must not be added manually.

```tsx
// src/App.tsx
import { ConnectionProvider, WalletProvider } from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { clusterApiUrl } from '@solana/web3.js';
import '@solana/wallet-adapter-react-ui/styles.css';
import { SolanaDemo } from './SolanaDemo';

const endpoint = clusterApiUrl('mainnet-beta');

export default function App() {
  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>
          <SolanaDemo />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
```

### Step 4: Find the MetaMask wallet

When using `useWallet`, you can verify MetaMask is connected by checking the wallet name. The wallet-standard name is exactly `"MetaMask"` (case-sensitive).

```typescript
import { useWallet } from '@solana/wallet-adapter-react';

const { wallet } = useWallet();
const isMetaMask = wallet?.adapter.name === 'MetaMask';
```

### Step 5: Build the full component

```tsx
// src/SolanaDemo.tsx
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

export function SolanaDemo() {
  const { publicKey, sendTransaction, signMessage, connected, wallet } = useWallet();
  const { connection } = useConnection();

  const handleSignMessage = async () => {
    if (!signMessage) return;
    const message = new TextEncoder().encode('Hello from MetaMask on Solana!');
    try {
      const signature = await signMessage(message);
      console.log('Signature:', Buffer.from(signature).toString('hex'));
    } catch (err) {
      console.error('Sign message failed:', err);
    }
  };

  const handleSendTransaction = async () => {
    if (!publicKey || !sendTransaction) return;
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('11111111111111111111111111111112'),
          lamports: 0.001 * LAMPORTS_PER_SOL,
        }),
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const txSignature = await sendTransaction(transaction, connection);
      const confirmation = await connection.confirmTransaction(txSignature, 'confirmed');
      console.log('Transaction confirmed:', txSignature);
    } catch (err) {
      console.error('Transaction failed:', err);
    }
  };

  return (
    <div>
      <WalletMultiButton />
      {connected && publicKey && (
        <div>
          <p>Wallet: {wallet?.adapter.name}</p>
          <p>Address: {publicKey.toBase58()}</p>
          <button onClick={handleSignMessage}>Sign Message</button>
          <button onClick={handleSendTransaction}>Send 0.001 SOL</button>
        </div>
      )}
    </div>
  );
}
```

### Step 6: Chrome on Android workaround

Chrome on Android has a known bug where the page may unload before MetaMask can respond. Add a `beforeunload` patch in your entry file:

```typescript
window.addEventListener('beforeunload', (e) => {
  e.preventDefault();
  e.returnValue = '';
});
```

## Important Notes

- **Initialize `createSolanaClient` early, but rendering need not wait** — wallet registration happens shortly *after* the factory resolves (the SDK defers it ~1s), and the wallet adapter discovers late registrations via the wallet-standard register event. Only gate UI that assumes MetaMask is already in the wallet list.
- **`wallets` prop must be `[]`** — MetaMask uses wallet-standard auto-discovery. Passing wallet adapter instances manually will not work and may cause duplicates with other wallets.
- **The wallet name is exactly `"MetaMask"`** — case-sensitive. Use this to identify the MetaMask wallet in the adapter list. Renamed from `"MetaMask Connect"` in `@metamask/connect-solana` 1.0.0; since that release, the client will also defer to an already-injected Solana provider (e.g. the MetaMask browser extension) instead of announcing a second `"MetaMask"` entry.
- **Eager provider initialization + stable `getWallet()`** — since `@metamask/connect-solana` 1.1.0, `createSolanaClient()` eagerly initializes the Solana wallet provider during creation; if the underlying multichain session already contains Solana scopes, the provider's accounts are populated by the time the client resolves (no need to wait for `wallet_sessionChanged` on cold start). `getWallet()` also returns the same wallet instance on every call now — safe to cache in a `useRef` / `useMemo` value, no need to call it on every render.
- **`getInfuraRpcUrls` helper** — use `getInfuraRpcUrls({ infuraApiKey: 'YOUR_KEY', networks: ['mainnet', 'devnet'] })` from `@metamask/connect-solana` to auto-generate `supportedNetworks` from Infura.
- **Solana networks** — mainnet, devnet, and testnet scopes are all modeled by the SDK and wallet-standard layer. Non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.
- **`disconnect()` only revokes Solana scopes** — if the user also has EVM sessions, those remain active. Each chain family manages its own session lifecycle.
- **Chrome on Android** — a known browser bug can interrupt the connection flow. Apply the `beforeunload` workaround shown in Step 6.
