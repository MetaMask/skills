---
name: sign-multichain-solana-transaction
description: Sign and send Solana transactions using the multichain client's invokeMethod. Covers signTransaction, signAndSendTransaction, signMessage, building transactions with @solana/web3.js, base64 encoding, mainnet/devnet scopes, and selective disconnect.
maturity: stable
---
# Sign Solana Transactions via Multichain Client

## When to use

Use this skill when:
- Signing or sending Solana transactions through `invokeMethod` on a multichain client
- Building Solana transactions with `@solana/web3.js` and encoding them for the multichain API
- Signing Solana messages through the multichain client
- Selecting the correct Solana CAIP-2 scope (mainnet, devnet)
- Disconnecting only Solana scopes while keeping EVM sessions active

## Workflow

### Step 1: Connect with Solana scopes

```typescript
import { createMultichainClient, getInfuraRpcUrls } from '@metamask/connect-multichain';

const client = await createMultichainClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', caipChainIds: ['eip155:1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'] }),
    },
  },
});

await client.connect(
  [
    'eip155:1',
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // mainnet
  ],
  [],
); // resolves with no value — read session via client.provider.getSession()
```

**Solana CAIP-2 scope identifiers:**

| Network  | CAIP-2 Scope |
|----------|-------------|
| Mainnet  | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Devnet   | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Testnet  | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` |

All three Solana scopes are modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.

### Step 2: Understand Solana RPC routing

**All Solana methods route through the wallet.** Unlike EVM where read calls go to an RPC node, every Solana `invokeMethod` call is handled by MetaMask. There is no RPC node fallback for Solana.

### Step 3: Sign a message (signMessage)

Method names have **no `solana_` prefix**. The message must be **base64 encoded**, and the signing account is passed as `account: { address }`.

```typescript
const message = btoa('Hello from Solana via MetaMask!');

const result = await client.invokeMethod({
  scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  request: {
    method: 'signMessage',
    params: {
      account: { address: 'YourSolanaAddressBase58' },
      message,
    },
  },
});

// result: { signature: <base58 string>, signedMessage: <base64>, signatureType: 'ed25519' }
console.log('Signature:', result.signature);
```

### Step 4: Build a Solana transaction with @solana/web3.js

Build the transaction using `@solana/web3.js`, serialize it, then base64-encode for `invokeMethod`.

```typescript
import {
  Connection,
  PublicKey,
  SystemProgram,
  Transaction,
  clusterApiUrl,
} from '@solana/web3.js';

const connection = new Connection(clusterApiUrl('mainnet-beta'));
const fromPubkey = new PublicKey('YourSolanaPublicKey');
const toPubkey = new PublicKey('RecipientSolanaPublicKey');

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey,
    toPubkey,
    lamports: 1_000_000, // 0.001 SOL
  }),
);

transaction.recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
transaction.feePayer = fromPubkey;

const serialized = transaction.serialize({
  requireAllSignatures: false,
  verifySignatures: false,
});
const base64Transaction = Buffer.from(serialized).toString('base64');
```

### Step 5: Sign a transaction (signTransaction)

Returns the signed transaction without broadcasting it.

```typescript
const SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

const signResult = await client.invokeMethod({
  scope: SOLANA_MAINNET,
  request: {
    method: 'signTransaction',
    params: {
      account: { address: 'YourSolanaAddressBase58' },
      transaction: base64Transaction,
      scope: SOLANA_MAINNET,
    },
  },
});

// The result field is `signedTransaction` (base64), not `transaction`
console.log('Signed transaction:', signResult.signedTransaction);
```

You can then broadcast the signed transaction yourself:

```typescript
const signedBuffer = Buffer.from(signResult.signedTransaction, 'base64');
const txId = await connection.sendRawTransaction(signedBuffer);
console.log('Transaction ID:', txId);
```

### Step 6: Sign and send a transaction (signAndSendTransaction)

Signs and broadcasts the transaction in one step.

```typescript
const sendResult = await client.invokeMethod({
  scope: SOLANA_MAINNET,
  request: {
    method: 'signAndSendTransaction',
    params: {
      account: { address: 'YourSolanaAddressBase58' },
      transaction: base64Transaction,
      scope: SOLANA_MAINNET,
    },
  },
});

// sendResult: { signature: <base58 transaction signature> }
console.log('Transaction signature:', sendResult.signature);
```

### Step 7: Devnet transactions

Connect with the devnet scope and point `@solana/web3.js` at the devnet cluster:

```typescript
const SOLANA_DEVNET = 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1';

await client.connect([SOLANA_DEVNET], []);

const connection = new Connection(clusterApiUrl('devnet'));

// Build transaction with devnet connection...
const base64Tx = buildAndSerializeTransaction(connection);

const result = await client.invokeMethod({
  scope: SOLANA_DEVNET,
  request: {
    method: 'signAndSendTransaction',
    params: {
      account: { address: 'YourSolanaAddressBase58' },
      transaction: base64Tx,
      scope: SOLANA_DEVNET,
    },
  },
});
```

### Step 8: Selective disconnect

Disconnect only Solana scopes while keeping EVM sessions active:

```typescript
// Disconnect only Solana mainnet — EVM scopes remain connected
await client.disconnect(['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']);

// Disconnect all scopes (full session teardown)
await client.disconnect();
```

### Step 9: Error handling

`invokeMethod` errors are wrapped in `RPCInvokeMethodErr` — its own `code` is always `53`, and the wallet's original EIP-1193 / JSON-RPC code (e.g. `4001` user rejection) is on `rpcCode`:

```typescript
import { RPCInvokeMethodErr } from '@metamask/connect-multichain';

try {
  await client.invokeMethod({
    scope: SOLANA_MAINNET,
    request: {
      method: 'signAndSendTransaction',
      params: {
        account: { address: 'YourSolanaAddressBase58' },
        transaction: base64Tx,
        scope: SOLANA_MAINNET,
      },
    },
  });
} catch (err) {
  if (err instanceof RPCInvokeMethodErr && err.rpcCode === 4001) {
    // User rejected the transaction in MetaMask — not an app error
  } else {
    console.error('Solana transaction error:', err);
  }
}
```

## Important Notes

- **All Solana methods go to the wallet.** There is no RPC node routing for Solana — every `invokeMethod` call with a Solana scope prompts MetaMask.
- **Base64 encoding required.** Transactions and messages must be base64-encoded strings, not raw buffers or hex.
- **Use `@solana/web3.js` to build transactions.** Construct `Transaction` objects, set `recentBlockhash` and `feePayer`, serialize with `requireAllSignatures: false`, then base64-encode.
- **CAIP-2 genesis hash IDs.** Mainnet is `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`. Devnet is `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`. These are not cluster URLs — they are genesis hash identifiers.
- **Solana networks.** Mainnet, devnet, and testnet scopes are all modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.
- **Selective disconnect preserves other scopes.** Passing specific Solana scopes to `disconnect()` only revokes those scopes. EVM scopes remain active.
- **Connected scopes required.** `invokeMethod` fails if the Solana scope was not included in the original `connect()` call.
- **Method names have no `solana_` prefix.** The MetaMask Multichain API methods are `signMessage`, `signTransaction`, and `signAndSendTransaction`, each taking `account: { address }` in params. (`solana_*`-prefixed names are WalletConnect's schema, not MetaMask's.)
- **`signTransaction` vs `signAndSendTransaction`:** Use `signTransaction` when you need to inspect or modify the signed output before broadcasting (result field: `signedTransaction`, base64). Use `signAndSendTransaction` for the common case where you want a single atomic operation (result field: `signature`, base58).
