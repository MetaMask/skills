# Send Solana Transaction with MetaMask

## When to use

Use this skill when:
- Sending SOL or interacting with Solana programs via MetaMask Connect
- Building a `Transaction` with `@solana/web3.js` and submitting it through the wallet
- Using `sendTransaction` from `useWallet` in a React app
- Using the `solana:signAndSendTransaction` wallet-standard feature in a vanilla browser app

## Workflow

### Step 1: Build the transaction

Use `@solana/web3.js` to construct the transaction. Every transaction needs a recent blockhash and a fee payer.

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

const senderPubkey = new PublicKey('SENDER_PUBLIC_KEY');
const recipientPubkey = new PublicKey('RECIPIENT_PUBLIC_KEY');

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: senderPubkey,
    toPubkey: recipientPubkey,
    lamports: 0.001 * LAMPORTS_PER_SOL,
  }),
);
transaction.recentBlockhash = blockhash;
transaction.feePayer = senderPubkey;
```

### Step 2a: Send with React wallet-adapter (useWallet)

**Prerequisites:** `createSolanaClient` has been awaited before rendering, `WalletProvider` is configured with `wallets={[]}`, and the user is connected. See the `setup-app` skill (`references/solana-react.md`).

```tsx
import { useWallet, useConnection } from '@solana/wallet-adapter-react';
import {
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

function SendTransactionButton() {
  const { publicKey, sendTransaction, connected } = useWallet();
  const { connection } = useConnection();

  const handleSend = async () => {
    if (!publicKey || !sendTransaction) return;

    try {
      const { blockhash } = await connection.getLatestBlockhash();

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: publicKey,
          toPubkey: new PublicKey('RECIPIENT_PUBLIC_KEY'),
          lamports: 0.001 * LAMPORTS_PER_SOL,
        }),
      );
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = publicKey;

      const signature = await sendTransaction(transaction, connection);
      console.log('Transaction submitted:', signature);

      const confirmation = await connection.confirmTransaction(signature, 'confirmed');
      console.log('Transaction confirmed:', confirmation);
    } catch (err: any) {
      if (err.code === 4001) {
        console.log('User rejected the transaction');
        return;
      }
      console.error('Transaction failed:', err);
    }
  };

  return (
    <button onClick={handleSend} disabled={!connected || !publicKey}>
      Send 0.001 SOL
    </button>
  );
}
```

### Step 2b: Send with vanilla browser (wallet-standard feature)

**Prerequisites:** `createSolanaClient` has been called and the wallet is connected via `standard:connect`. See the `setup-app` skill (`references/solana-browser.md`).

```typescript
import { createSolanaClient } from '@metamask/connect-solana';
import {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const solanaClient = await createSolanaClient({
  dapp: { name: 'My DApp', url: window.location.href },
});

const wallet = solanaClient.getWallet();

// Connect first
const connectFeature = wallet.features['standard:connect'];
const { accounts } = await connectFeature.connect();
const account = accounts[0];
const senderPubkey = new PublicKey(account.address);

// Build the transaction
const connection = new Connection('https://api.mainnet-beta.solana.com');
const { blockhash } = await connection.getLatestBlockhash();

const transaction = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: senderPubkey,
    toPubkey: new PublicKey('RECIPIENT_PUBLIC_KEY'),
    lamports: 0.001 * LAMPORTS_PER_SOL,
  }),
);
transaction.recentBlockhash = blockhash;
transaction.feePayer = senderPubkey;

// Serialize and send
const serializedTransaction = transaction.serialize({
  requireAllSignatures: false,
});

const signAndSendFeature = wallet.features['solana:signAndSendTransaction'];

// The `chain` field accepts the wallet-standard short forms ('solana:mainnet',
// 'solana:devnet', 'solana:testnet') or the full genesis-hash CAIP-2 scope
// (e.g. 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'). It is optional and
// defaults to mainnet. Bare 'mainnet' (without the 'solana:' prefix) is
// INVALID here and throws 'Unsupported chainId' — the SolanaNetwork short
// names apply only to createSolanaClient's api.supportedNetworks keys.

// Requires `npm install bs58` and `import bs58 from 'bs58'` at the top of the file
try {
  const [{ signature }] = await signAndSendFeature.signAndSendTransaction({
    account,
    transaction: serializedTransaction,
    chain: 'solana:mainnet', // wallet-standard short form; full genesis-hash CAIP-2 IDs also accepted
  });

  // signature is a Uint8Array — encode with bs58 ('base58' is NOT a Buffer encoding)
  const signatureBase58 = bs58.encode(signature);
  console.log('Transaction submitted:', signatureBase58);

  // confirmTransaction expects the base58 signature string
  const confirmation = await connection.confirmTransaction(signatureBase58, 'confirmed');
  console.log('Transaction confirmed:', confirmation);
} catch (err: any) {
  if (err.code === 4001) {
    console.log('User rejected the transaction');
  } else {
    console.error('Transaction failed:', err);
  }
}
```

### Step 3: Sign without sending (sign-only flow)

If you need to sign a transaction without broadcasting it (e.g., for offline signing or multi-sig):

**React:**

```typescript
const { signTransaction } = useWallet();

if (signTransaction) {
  const signedTransaction = await signTransaction(transaction);
  // signedTransaction is now signed but NOT sent — broadcast manually if needed
  const rawTransaction = signedTransaction.serialize();
  const signature = await connection.sendRawTransaction(rawTransaction);
}
```

**Browser (wallet-standard):**

```typescript
const signFeature = wallet.features['solana:signTransaction'];

const [{ signedTransaction }] = await signFeature.signTransaction({
  account,
  transaction: transaction.serialize({ requireAllSignatures: false }),
  chain: 'solana:mainnet',
});

// signedTransaction is serialized and signed — broadcast manually
const signature = await connection.sendRawTransaction(signedTransaction);
```

### Step 4: Send multiple transactions (batch)

There is **no** `solana:signAndSendAllTransactions` feature. The `solana:signAndSendTransaction` feature is **variadic** — pass multiple inputs and it returns one result per input:

```typescript
const signAndSendFeature = wallet.features['solana:signAndSendTransaction'];

const results = await signAndSendFeature.signAndSendTransaction(
  { account, transaction: serializedTx1, chain: 'solana:mainnet' },
  { account, transaction: serializedTx2, chain: 'solana:mainnet' },
  { account, transaction: serializedTx3, chain: 'solana:mainnet' },
);

for (const { signature } of results) {
  console.log('Tx signature:', bs58.encode(signature));
}
```

### Step 5: Confirm the transaction

Always confirm after sending. Use `'confirmed'` commitment for most use cases:

```typescript
const confirmation = await connection.confirmTransaction(signature, 'confirmed');

if (confirmation.value.err) {
  console.error('Transaction failed on-chain:', confirmation.value.err);
} else {
  console.log('Transaction succeeded');
}
```

### Step 6: Error handling

| Error | Cause | Action |
|-------|-------|--------|
| Code `4001` | User rejected in MetaMask | Show retry UI |
| Code `-32002` | Request already pending | Wait for user to act in MetaMask |
| `Blockhash not found` | Blockhash expired before submission | Fetch a new blockhash and rebuild |
| `Insufficient funds` | Sender balance too low for transfer + fees | Show balance check UI |
| `Transaction too large` | Transaction exceeds 1232 bytes | Split into multiple transactions |

```typescript
try {
  const signature = await sendTransaction(transaction, connection);
  await connection.confirmTransaction(signature, 'confirmed');
} catch (err: any) {
  switch (err.code) {
    case 4001:
      // User rejected
      break;
    case -32002:
      // Pending — ask user to check MetaMask
      break;
    default:
      if (err.message?.includes('Blockhash not found')) {
        // Retry with fresh blockhash
      }
      console.error('Transaction error:', err);
  }
}
```

## Important Notes

- **Always fetch a fresh blockhash** — blockhashes expire after ~60 seconds. Fetch `getLatestBlockhash()` immediately before building the transaction, not at app startup.
- **Set `feePayer` before signing** — the transaction must have `feePayer` and `recentBlockhash` set before it is signed or serialized.
- **Serialize with `requireAllSignatures: false`** — when using wallet-standard features directly, the wallet will add the signature. Serializing with `requireAllSignatures: true` (the default) will throw because the transaction isn't signed yet.
- **`sendTransaction` vs `signAndSendTransaction`** — in the React adapter, `sendTransaction` handles serialization internally. With wallet-standard features, you must serialize the transaction yourself and pass the bytes.
- **`chain` is only honored by `signAndSendTransaction`** — `signAndSendTransaction` reads the input's `chain` to pick the cluster, but `signTransaction`/`signMessage` ignore any `chain` field and use the **connected session scope** instead. Passing `chain` to `signTransaction` is harmless but doesn't switch networks; connect with the scope you want to sign on.
- **Solana networks** — mainnet, devnet, and testnet scopes are all modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.
- **`disconnect()` only revokes Solana scopes** — EVM sessions remain active.
- **Chrome on Android** — apply the `beforeunload` workaround for the known page-unload bug during wallet interactions.
- **Confirm before reporting success** — a submitted transaction is not finalized until `confirmTransaction` returns. Always confirm before updating the UI.
