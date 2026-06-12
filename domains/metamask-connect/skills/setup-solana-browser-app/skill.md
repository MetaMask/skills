---
name: setup-solana-browser-app
description: Set up a vanilla browser (non-React) app with @metamask/connect-solana using wallet-standard features directly. Use when integrating MetaMask Solana without a framework or wallet adapter library.
maturity: stable
---
# Setup Solana Browser App with MetaMask

## When to use

Use this skill when:
- Integrating MetaMask with Solana in a vanilla JavaScript or non-React browser app
- Using wallet-standard features directly without `@solana/wallet-adapter-react`
- Building connect, sign, and send flows with the `SolanaClient` API
- Accessing wallet-standard features like `solana:signTransaction` or `solana:signMessage` directly

## Workflow

### Step 1: Install dependencies

```bash
npm install @metamask/connect-solana @metamask/connect-multichain @solana/web3.js
```

`@metamask/connect-multichain` is a regular dependency of `@metamask/connect-solana` and is installed transitively. (Only the 2.0.0 release briefly made it a peer dependency; 2.1.0 reverted that.) Installing it explicitly is harmless but not required. The SDK warns at runtime if duplicate or mismatched copies are resolved.

### Step 2: Create the Solana client

```typescript
import { createSolanaClient } from '@metamask/connect-solana';

const solanaClient = await createSolanaClient({
  dapp: {
    name: 'My Solana DApp',
    url: window.location.href,
  },
  api: {
    supportedNetworks: {
      mainnet: 'https://api.mainnet-beta.solana.com',
    },
  },
});
```

**`createSolanaClient` returns `Promise<SolanaClient>`:**

| Property | Type | Description |
|----------|------|-------------|
| `core` | `MultichainCore` | The underlying multichain client instance |
| `getWallet()` | `() => Wallet` | Returns the wallet-standard `Wallet` (from `@wallet-standard/base`) |
| `registerWallet()` | `() => Promise<void>` | Manually register the wallet (auto-called unless `skipAutoRegister: true`) |
| `disconnect()` | `() => Promise<void>` | Disconnect and revoke Solana scopes |

### Step 3: Get the wallet and connect

```typescript
const wallet = solanaClient.getWallet();

// The wallet exposes wallet-standard features
console.log('Wallet name:', wallet.name); // "MetaMask"
console.log('Available features:', Object.keys(wallet.features));
```

Connect using the `standard:connect` feature:

```typescript
const connectFeature = wallet.features['standard:connect'];
const { accounts } = await connectFeature.connect();

if (accounts.length > 0) {
  const account = accounts[0];
  console.log('Address:', account.address);
  console.log('Public key:', account.publicKey); // Uint8Array
  console.log('Chains:', account.chains); // e.g. ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']
}
```

### Step 4: Access wallet-standard features

The wallet exposes these wallet-standard features:

| Feature Key | Description |
|-------------|-------------|
| `standard:connect` | Connect and request accounts |
| `standard:disconnect` | Disconnect the wallet |
| `standard:events` | Subscribe to account/chain change events |
| `solana:signIn` | Sign-In-With-Solana (SIWS) authentication |
| `solana:signTransaction` | Sign a transaction without sending |
| `solana:signAndSendTransaction` | Sign and broadcast a transaction |
| `solana:signMessage` | Sign an arbitrary message |

There is **no** `solana:signAndSendAllTransactions` feature — to batch, pass multiple inputs to `signAndSendTransaction(...inputs)` (it is variadic and returns one result per input).

### Step 5: Sign a message

```typescript
const signMessageFeature = wallet.features['solana:signMessage'];

const message = new TextEncoder().encode('Hello from MetaMask on Solana!');

const [{ signature }] = await signMessageFeature.signMessage({
  account: accounts[0],
  message,
});

console.log('Signature:', Buffer.from(signature).toString('hex'));
```

### Step 6: Sign and send a transaction

```typescript
import {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const connection = new Connection('https://api.mainnet-beta.solana.com');
const { blockhash } = await connection.getLatestBlockhash();

const senderPubkey = new PublicKey(accounts[0].address);

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: senderPubkey,
    toPubkey: new PublicKey('11111111111111111111111111111112'),
    lamports: 0.001 * LAMPORTS_PER_SOL,
  }),
);
transaction.recentBlockhash = blockhash;
transaction.feePayer = senderPubkey;

const serializedTransaction = transaction.serialize({
  requireAllSignatures: false,
});

const signAndSendFeature = wallet.features['solana:signAndSendTransaction'];

const [{ signature: txSignature }] = await signAndSendFeature.signAndSendTransaction({
  account: accounts[0],
  transaction: serializedTransaction,
  chain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
});

// txSignature is a Uint8Array — encode with bs58 ('base58' is NOT a Buffer encoding).
// Requires `npm install bs58` and `import bs58 from 'bs58'` at the top of the file.
const signatureBase58 = bs58.encode(txSignature);
console.log('Transaction signature:', signatureBase58);

// confirmTransaction expects the base58 signature string
const confirmation = await connection.confirmTransaction(signatureBase58, 'confirmed');
console.log('Confirmed:', confirmation);
```

### Step 7: Listen for account and chain changes

```typescript
const eventsFeature = wallet.features['standard:events'];

eventsFeature.on('change', ({ accounts: newAccounts }) => {
  if (newAccounts) {
    console.log('Accounts changed:', newAccounts.map((a) => a.address));
  }
});
```

### Step 8: Disconnect

```typescript
await solanaClient.disconnect();
```

### Step 9: Full working example

```typescript
import { createSolanaClient } from '@metamask/connect-solana';
import {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

async function main() {
  const solanaClient = await createSolanaClient({
    dapp: {
      name: 'My Solana DApp',
      url: window.location.href,
    },
    api: {
      supportedNetworks: {
        mainnet: 'https://api.mainnet-beta.solana.com',
      },
    },
  });

  const wallet = solanaClient.getWallet();

  // Connect
  const connectFeature = wallet.features['standard:connect'];
  const { accounts } = await connectFeature.connect();
  const account = accounts[0];
  console.log('Connected:', account.address);

  // Sign message
  const signMessageFeature = wallet.features['solana:signMessage'];
  const [{ signature }] = await signMessageFeature.signMessage({
    account,
    message: new TextEncoder().encode('Hello Solana!'),
  });
  console.log('Message signed');

  // Send transaction
  const connection = new Connection('https://api.mainnet-beta.solana.com');
  const { blockhash } = await connection.getLatestBlockhash();
  const senderPubkey = new PublicKey(account.address);

  const tx = new Transaction().add(
    SystemProgram.transfer({
      fromPubkey: senderPubkey,
      toPubkey: new PublicKey('11111111111111111111111111111112'),
      lamports: 0.001 * LAMPORTS_PER_SOL,
    }),
  );
  tx.recentBlockhash = blockhash;
  tx.feePayer = senderPubkey;

  const signAndSendFeature = wallet.features['solana:signAndSendTransaction'];
  const [{ signature: txSig }] = await signAndSendFeature.signAndSendTransaction({
    account,
    transaction: tx.serialize({ requireAllSignatures: false }),
    chain: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  });
  console.log('Transaction sent');

  // Disconnect
  await solanaClient.disconnect();
}

main().catch(console.error);
```

## Important Notes

- **`createSolanaClient` is async** — always `await` it before accessing the wallet. The factory returns a `Promise<SolanaClient>`.
- **`getInfuraRpcUrls` helper** — use `getInfuraRpcUrls({ infuraApiKey: 'YOUR_KEY', networks: ['mainnet', 'devnet'] })` from `@metamask/connect-solana` to auto-generate `supportedNetworks` from Infura. Returns `SolanaSupportedNetworks`.
- **Wallet name is exactly `"MetaMask"`** — case-sensitive. Use this to identify the wallet if you enumerate registered wallets.
- **Feature keys are string constants** — always access features via bracket notation (e.g., `wallet.features['solana:signTransaction']`), not dot notation.
- **Solana networks** — mainnet, devnet, and testnet scopes are all modeled by the SDK and wallet-standard layer. Non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present; for reads, point a `@solana/web3.js` `Connection` at the matching cluster.
- **`skipAutoRegister` option** — pass `skipAutoRegister: true` to `createSolanaClient` to prevent automatic wallet-standard registration. Useful when you want to control when the wallet becomes discoverable.
- **`analytics.integrationType` option** — pass an `analytics: { integrationType: 'your-integration' }` string to `createSolanaClient` (added in `@metamask/connect-solana` 0.8.0) to tag analytics events with your integration identifier.
- **Injected Solana provider wins** — since `@metamask/connect-solana` 1.0.0, if an injected Solana provider is already present (e.g. the MetaMask browser extension), `createSolanaClient` will not announce its own wallet-standard provider. Don't expect two `"MetaMask"` entries in the registered wallets list.
- **Eager provider initialization + stable `getWallet()`** — since `@metamask/connect-solana` 1.1.0, `createSolanaClient()` eagerly initializes the Solana wallet provider during creation; if the underlying multichain session already contains Solana scopes, the provider's accounts are populated by the time the client resolves (no need to wait for `wallet_sessionChanged` on cold start). `getWallet()` also returns the same wallet instance on every call now — safe to cache in a module-level constant, no need to re-await or recreate on subsequent access.
- **`disconnect()` only revokes Solana scopes** — EVM sessions managed by other clients remain active.
- **Chrome on Android** has a known bug where the page may unload during the connection flow. Add a `beforeunload` listener as a workaround:
  ```typescript
  window.addEventListener('beforeunload', (e) => {
    e.preventDefault();
    e.returnValue = '';
  });
  ```
