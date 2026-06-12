---
name: sign-solana-message
description: Sign an arbitrary message on Solana using MetaMask Connect. Covers both the React wallet-adapter approach (useWallet) and the vanilla browser approach (wallet-standard features).
maturity: stable
---
# Sign Solana Message with MetaMask

## When to use

Use this skill when:
- Signing an arbitrary message on Solana with MetaMask Connect
- Implementing sign-in-with-Solana or message verification flows
- Using `useWallet().signMessage` in a React app
- Using the `solana:signMessage` wallet-standard feature in a vanilla browser app

## Workflow

### Step 1: Encode the message

Solana message signing requires a `Uint8Array`. Use `TextEncoder` to convert a string:

```typescript
const message = new TextEncoder().encode('Sign this message to verify your identity');
```

### Step 2a: Sign with React wallet-adapter (useWallet)

**Prerequisites:** `createSolanaClient` has been awaited before rendering, `WalletProvider` is configured with `wallets={[]}`, and the user is connected. See the `setup-solana-react-app` skill.

```tsx
import { useWallet } from '@solana/wallet-adapter-react';

function SignMessageButton() {
  const { signMessage, publicKey, connected } = useWallet();

  const handleSign = async () => {
    if (!signMessage || !publicKey) {
      console.error('Wallet does not support signMessage or is not connected');
      return;
    }

    try {
      const message = new TextEncoder().encode('Hello from MetaMask on Solana!');
      const signature = await signMessage(message);
      console.log('Signature (bytes):', signature);
      console.log('Signature (hex):', Buffer.from(signature).toString('hex'));
      console.log('Signer:', publicKey.toBase58());
    } catch (err: any) {
      if (err.code === 4001) {
        console.log('User rejected the signature request');
        return;
      }
      console.error('signMessage failed:', err);
    }
  };

  return (
    <button onClick={handleSign} disabled={!connected || !signMessage}>
      Sign Message
    </button>
  );
}
```

### Step 2b: Sign with vanilla browser (wallet-standard feature)

**Prerequisites:** `createSolanaClient` has been called and the wallet is connected via `standard:connect`. See the `setup-solana-browser-app` skill.

```typescript
import { createSolanaClient } from '@metamask/connect-solana';

const solanaClient = await createSolanaClient({
  dapp: { name: 'My DApp', url: window.location.href },
});

const wallet = solanaClient.getWallet();

// Connect first
const connectFeature = wallet.features['standard:connect'];
const { accounts } = await connectFeature.connect();
const account = accounts[0];

// Sign the message
const signMessageFeature = wallet.features['solana:signMessage'];

try {
  const message = new TextEncoder().encode('Hello from MetaMask on Solana!');

  const [{ signature }] = await signMessageFeature.signMessage({
    account,
    message,
  });

  console.log('Signature (hex):', Buffer.from(signature).toString('hex'));
  console.log('Signer:', account.address);
} catch (err: any) {
  if (err.code === 4001) {
    console.log('User rejected the signature request');
  } else {
    console.error('signMessage failed:', err);
  }
}
```

### Step 3: Verify the signature (optional)

Use `tweetnacl` or `@noble/ed25519` to verify the signature off-chain:

```typescript
import nacl from 'tweetnacl';

const message = new TextEncoder().encode('Hello from MetaMask on Solana!');
const isValid = nacl.sign.detached.verify(
  message,
  signature, // Uint8Array from signMessage
  publicKey.toBytes(), // Uint8Array of the signer's public key
);
console.log('Signature valid:', isValid);
```

### Step 4: Error handling

Handle these common error scenarios:

| Error | Cause | Action |
|-------|-------|--------|
| Code `4001` | User rejected the request in MetaMask | Show retry UI, do not treat as app error |
| `signMessage` is `undefined` | Wallet does not support message signing | Check `signMessage` exists before calling |
| `publicKey` is `null` | Wallet not connected | Prompt user to connect first |
| Network error | MetaMask Mobile connection interrupted | Retry or reconnect |

```typescript
try {
  const signature = await signMessage(message);
} catch (err: any) {
  switch (err.code) {
    case 4001:
      // User rejected — show retry button
      break;
    case -32002:
      // Request already pending — wait for user to act in MetaMask
      break;
    default:
      console.error('Unexpected error:', err);
  }
}
```

## Important Notes

- **Messages must be `Uint8Array`** — use `new TextEncoder().encode(string)` to convert. Do not pass raw strings to `signMessage`.
- **`signMessage` may be `undefined`** — always check that `signMessage` exists on the wallet adapter before calling it. Not all wallets support arbitrary message signing.
- **The signature is Ed25519** — Solana uses Ed25519 signatures. The returned `Uint8Array` is 64 bytes.
- **User rejection is code `4001`** — handle it gracefully with a retry option. Do not log it as an error.
- **Wallet name is `"MetaMask"`** — case-sensitive, used to identify the MetaMask wallet in the adapter list.
- **Solana networks** — mainnet, devnet, and testnet scopes are all modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.
