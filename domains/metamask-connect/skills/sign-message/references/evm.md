# Sign EVM Messages with MetaMask Connect

## When to use

Use this skill when:
- Signing a plaintext message with `personal_sign` for authentication or verification
- Signing structured EIP-712 typed data with `eth_signTypedData_v4` for permits, orders, or typed messages
- Using the `connectAndSign` shortcut to connect and sign in a single user approval
- Handling signature errors and user rejections

## Workflow

### Step 1: Get the provider and connected account

Ensure the client is connected before requesting a signature:

```typescript
import { createEVMClient, getInfuraRpcUrls } from '@metamask/connect-evm';

const client = await createEVMClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1'] }),
    },
  },
});

const { accounts } = await client.connect({ chainIds: ['0x1'] });
const provider = client.getProvider();
const account = accounts[0]; // Address (0x-prefixed hex)
```

### Step 2: Sign with personal_sign

`personal_sign` signs a UTF-8 message. The params order is `[message, account]` where `message` is a hex-encoded string:

```typescript
// Convert message to hex
const message = 'Hello, MetaMask!';
const hexMessage = '0x' + Array.from(new TextEncoder().encode(message))
  .map((b) => b.toString(16).padStart(2, '0'))
  .join('');

try {
  const signature = await provider.request({
    method: 'personal_sign',
    params: [hexMessage, account],
  });

  console.log('Signature:', signature);
  // signature is a Hex string: 0x...
} catch (err: any) {
  if (err.code === 4001) {
    console.log('User rejected the signature request');
    return;
  }
  throw err;
}
```

MetaMask also accepts a raw UTF-8 string for the message parameter, but hex encoding is the canonical format per EIP-191.

### Step 3: Sign EIP-712 typed data with eth_signTypedData_v4

Build the full EIP-712 typed data structure with `types`, `primaryType`, `domain`, and `message`, then pass it as a JSON string:

```typescript
const typedData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Mail: [
      { name: 'from', type: 'Person' },
      { name: 'to', type: 'Person' },
      { name: 'contents', type: 'string' },
    ],
    Person: [
      { name: 'name', type: 'string' },
      { name: 'wallet', type: 'address' },
    ],
  },
  primaryType: 'Mail',
  domain: {
    name: 'Ether Mail',
    version: '1',
    chainId: 1,
    verifyingContract: '0xCcCCccccCCCCcCCCCCCcCcCccCcCCCcCcccccccC',
  },
  message: {
    from: { name: 'Alice', wallet: '0xAliceAddress' },
    to: { name: 'Bob', wallet: '0xBobAddress' },
    contents: 'Hello Bob!',
  },
};

try {
  const signature = await provider.request({
    method: 'eth_signTypedData_v4',
    params: [account, JSON.stringify(typedData)],
  });

  console.log('Typed data signature:', signature);
} catch (err: any) {
  if (err.code === 4001) {
    console.log('User rejected the typed data signature');
    return;
  }
  throw err;
}
```

### Step 4: ERC-20 Permit (EIP-2612) example

A common use case for `eth_signTypedData_v4` is signing ERC-20 permit approvals:

```typescript
const permitData = {
  types: {
    EIP712Domain: [
      { name: 'name', type: 'string' },
      { name: 'version', type: 'string' },
      { name: 'chainId', type: 'uint256' },
      { name: 'verifyingContract', type: 'address' },
    ],
    Permit: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
      { name: 'value', type: 'uint256' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
  },
  primaryType: 'Permit',
  domain: {
    name: 'USD Coin',
    version: '2',
    chainId: 1,
    verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
  },
  message: {
    owner: account,
    spender: '0xSpenderContractAddress',
    value: '1000000', // 1 USDC (6 decimals)
    nonce: 0,
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  },
};

const signature = await provider.request({
  method: 'eth_signTypedData_v4',
  params: [account, JSON.stringify(permitData)],
});
```

### Step 5: Use connectAndSign for single-approval flow

`connectAndSign` connects and signs a `personal_sign` message in one user interaction:

```typescript
// For authentication, never sign a static string — it is replayable.
// Use an EIP-4361 (SIWE) formatted message with a server-issued nonce:
const siweMessage = [
  `${window.location.host} wants you to sign in with your Ethereum account:`,
  '', // account is filled by your SIWE library or template
  'Sign in to My DApp',
  '',
  `URI: ${window.location.origin}`,
  'Version: 1',
  `Chain ID: 1`,
  `Nonce: ${serverIssuedNonce}`, // fetched from your backend
  `Issued At: ${new Date().toISOString()}`,
].join('\n');

const { accounts, chainId, signature } = await client.connectAndSign({
  message: siweMessage,
  chainIds: ['0x1'],
});

console.log('Connected account:', accounts[0]);
console.log('Signature:', signature);
```

This is ideal for sign-in-with-Ethereum (SIWE) flows where you want the user to connect and prove ownership in a single step — verify the signature, nonce, and domain server-side.

### Step 6: Handle errors

```typescript
try {
  const signature = await provider.request({
    method: 'personal_sign',
    params: [hexMessage, account],
  });
} catch (err: any) {
  switch (err.code) {
    case 4001:
      // User rejected — show a message, offer retry
      break;
    case -32002:
      // Request pending — another signing request is in progress
      break;
    default:
      // Unexpected error
      console.error('Signing failed:', err);
  }
}
```

## Important Notes

- **`personal_sign` params order is `[message, account]`** — not `[account, message]`. Getting this wrong will produce an invalid signature or an error.
- **`eth_signTypedData_v4` params are `[account, typedDataJSON]`** — the typed data must be passed as a `JSON.stringify`'d string, not as a raw object.
- **The `EIP712Domain` type must be declared in `types`** even though `primaryType` is never `EIP712Domain`. It defines the domain separator fields.
- **`connectAndSign` only supports `personal_sign`** — for typed data signing during connection, use `connectWith` with `method: 'eth_signTypedData_v4'` instead.
- **Chain IDs in typed data `domain.chainId` are integers** (e.g., `1`), while chain IDs in SDK calls are hex strings (e.g., `'0x1'`). Don't mix them up.
- **Error code 4001 is a deliberate user rejection** — handle gracefully with a retry option.
- **Error code -32002 means a request is pending** — do not fire another sign request until the user responds.
- **Always connect before signing** — `personal_sign` and `eth_signTypedData_v4` require an active account. Call `client.connect()` first or use `connectAndSign`.
