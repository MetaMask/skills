# Setup Multichain App with MetaMask

## When to use

Use this skill when:
- Building an app that needs both EVM and Solana wallet connectivity through a single MetaMask session
- Using `createMultichainClient` from `@metamask/connect-multichain`
- Calling `invokeMethod` with CAIP-2 scopes for cross-chain RPC or signing
- Handling `wallet_sessionChanged` events for multichain session state
- Running in headless mode with custom QR rendering via `display_uri`
- Configuring `getInfuraRpcUrls` for EVM and Solana RPC transport

## Workflow

### Step 1: Install dependencies

```bash
npm install @metamask/connect-multichain
```

For Solana transaction building (optional):

```bash
npm install @solana/web3.js
```

### Step 2: Create the multichain client

`createMultichainClient` is a **singleton** — calling it multiple times returns the same instance with merged options. Never recreate it per render.

```typescript
import { createMultichainClient, getInfuraRpcUrls } from '@metamask/connect-multichain';

const client = await createMultichainClient({
  dapp: {
    name: 'My Multichain DApp',
    url: window.location.href,
    iconUrl: 'https://mydapp.com/icon.png', // optional (or use base64Icon for embedded icons)
  },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_API_KEY', caipChainIds: ['eip155:1', 'eip155:137', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'] }),
    },
  },
  ui: {
    headless: false, // set true for custom QR rendering
  },
});
```

**`getInfuraRpcUrls({ infuraApiKey, caipChainIds? })`** returns a CAIP-2 keyed map of Infura RPC URLs for supported networks (EVM chains and Solana). Pass `caipChainIds` to limit the output to specific chains. Merge with any custom network RPCs.

**Singleton behavior:** The `dapp` object from the first call is used for the lifetime of the client — it is ignored on subsequent calls (not merged). Call `createMultichainClient` once at app startup.

### Step 3: Connect with mixed EVM + Solana scopes

Scopes use CAIP-2 format: `'eip155:N'` for EVM chains, `'solana:<genesisHash>'` for Solana.

```typescript
// connect() resolves with no value (Promise<void>)
await client.connect(
  [
    'eip155:1',      // Ethereum mainnet
    'eip155:137',    // Polygon
    'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp', // Solana mainnet
  ],
  [], // caipAccountIds (empty for initial connection)
);

// Session data arrives via the wallet_sessionChanged event (see Step 6),
// or read it on demand:
const session = await client.provider.getSession();
console.log(session?.sessionScopes); // approved scopes with their accounts
```

**Solana CAIP-2 identifiers:**

| Network  | CAIP-2 ID |
|----------|-----------|
| Mainnet  | `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp` |
| Devnet   | `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1` |
| Testnet  | `solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z` |

All three Solana scopes are modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so don't assume a cluster is present — handle connection errors.

You can optionally pass `caipAccountIds` (second argument) to hint at specific accounts:

```typescript
await client.connect(
  ['eip155:1'],
  ['eip155:1:0xYourAddress'],
);
```

### Step 4: Invoke EVM methods

Use `invokeMethod` with a CAIP-2 scope and a JSON-RPC request object.

**EVM read methods** (eth_call, eth_getBalance, eth_blockNumber, etc.) route through the **RPC node**. **Signing methods** (eth_sendTransaction, personal_sign, etc.) route through the **wallet**.

```typescript
// Read: eth_getBalance via RPC node
const balance = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'eth_getBalance',
    params: ['0xYourAddress', 'latest'],
  },
});

// Sign: personal_sign via wallet
const signature = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'personal_sign',
    params: ['0x48656c6c6f', '0xYourAddress'],
  },
});

// Send transaction via wallet
const txHash = await client.invokeMethod({
  scope: 'eip155:137',
  request: {
    method: 'eth_sendTransaction',
    params: [{
      from: '0xYourAddress',
      to: '0xRecipient',
      value: '0x2386F26FC10000', // 0.01 ETH in wei (hex)
      gas: '0x5208',
    }],
  },
});
```

### Step 5: Invoke Solana methods

**All Solana methods route through the wallet** — only EVM read methods are routed to RPC nodes. (The Solana entries in `supportedNetworks` declare which networks the dapp uses; they are not used to route Solana requests.)

Method names have **no `solana_` prefix**, and params take an `account: { address }` object:

```typescript
const SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';

// Sign a message
const signResult = await client.invokeMethod({
  scope: SOLANA_MAINNET,
  request: {
    method: 'signMessage',
    params: {
      account: { address: 'YourSolanaAddress' },
      message: btoa('Hello from Solana!'), // base64-encoded message bytes
    },
  },
});
// signResult: { signature: <base58 string>, signedMessage: <base64>, signatureType: 'ed25519' }

// Sign and send a transaction
const txResult = await client.invokeMethod({
  scope: SOLANA_MAINNET,
  request: {
    method: 'signAndSendTransaction',
    params: {
      account: { address: 'YourSolanaAddress' },
      transaction: base64EncodedTransaction, // base64-encoded serialized transaction
      scope: SOLANA_MAINNET,
    },
  },
});
// txResult: { signature: <base58 transaction signature> }
```

To sign without sending, use `signTransaction` (same params) — it returns `{ signedTransaction: <base64> }`.

### Step 6: Listen for session events

Register event listeners **before** calling `connect()`.

```typescript
// Session state changes (accounts added/removed, scopes changed)
// Payload is SessionData | undefined — scopes live under sessionScopes
client.on('wallet_sessionChanged', (session) => {
  const scopes = session?.sessionScopes ?? {};
  console.log('Approved scopes:', Object.keys(scopes));
  // Accounts are CAIP-10 strings, e.g. 'eip155:1:0xabc...' — take the last segment for the address
});

// Connection status changes
client.on('stateChanged', (status) => {
  // status: 'loaded' | 'pending' | 'connecting' | 'connected' | 'disconnected'
  console.log('Connection status:', status);
});

// display_uri fires during 'connecting' state — headless QR code flow
client.on('display_uri', (uri: string) => {
  renderQrCode(uri);
});
```

**`display_uri` timing:** The event only fires during the connecting phase. Register the listener before `connect()`. In headless mode, if an error occurs during connection, do not attempt to regenerate the QR — start a new `connect()` call instead.

### Step 7: Headless mode

For full control over the connection UI:

```typescript
const client = await createMultichainClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: {
    supportedNetworks: getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_API_KEY' }),
  },
  ui: { headless: true },
});

client.on('display_uri', (uri: string) => {
  // Render your own QR code or deeplink UI
  showCustomQrModal(uri);
});

await client.connect(
  ['eip155:1', 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
  [],
);

// Hide QR modal on successful connection
hideCustomQrModal();
```

### Step 8: Selective disconnect

```typescript
// Disconnect only Solana scope — EVM session stays active
await client.disconnect(['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']);

// Full disconnect — revoke all scopes, terminate session
await client.disconnect();
```

### Step 9: Error handling

```typescript
import { RPCInvokeMethodErr } from '@metamask/connect-multichain';

try {
  await client.connect(['eip155:1'], []);
} catch (err: any) {
  if (err?.message?.includes('Existing connection is pending')) {
    // MWP: a previous connect() is still pending — do NOT retry.
    // Show "Check your MetaMask Mobile app to continue" message.
    // (This error has no numeric code.)
  } else if (err?.code === 4001 || /reject|denied|cancel/i.test(err?.message ?? '')) {
    // User rejected the connection — show retry UI
  } else {
    console.error('Connection error:', err);
  }
}

// invokeMethod errors are wrapped in RPCInvokeMethodErr (err.code === 53).
// The wallet's original EIP-1193 / JSON-RPC code is on err.rpcCode
// (with err.rpcMessage and err.rpcData for revert data).
try {
  await client.invokeMethod({
    scope: 'eip155:1',
    request: { method: 'personal_sign', params: ['0x48656c6c6f', '0xYourAddress'] },
  });
} catch (err) {
  if (err instanceof RPCInvokeMethodErr && err.rpcCode === 4001) {
    // User rejected the signature — not an app error
  } else {
    throw err;
  }
}
```

## Important Notes

- **Singleton:** `createMultichainClient` is a singleton. The `dapp` object from the first call is used for the client's lifetime (later calls' `dapp` is ignored). Call it once at app startup and reuse the returned client.
- **Concurrent connect throws on MWP:** Never call `connect()` while a previous `connect()` is still pending — it throws a plain `Error` ("Existing connection is pending...") with **no numeric code**. (`-32002` only comes from the extension transport's own RPC queue.)
- **EVM read vs sign routing:** EVM read methods (eth_call, eth_getBalance, etc.) go to the RPC node configured in `supportedNetworks`. Signing methods go to the wallet. All Solana methods always go to the wallet.
- **Scope format:** EVM scopes are `'eip155:<chainId-decimal>'` (e.g., `'eip155:1'`). Solana scopes use the genesis hash: `'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'`.
- **`display_uri`:** Only fires during the connecting phase. Register before `connect()`. Do not regenerate QR on connection error — start a fresh `connect()`.
- **Selective disconnect:** Passing specific scopes only revokes those scopes. Omit arguments to fully terminate the session.
- **Node.js / React Native:** `dapp.url` is **required** in non-browser environments (there is no `window.location`).
- **Solana networks:** mainnet, devnet, and testnet scopes are all modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.
