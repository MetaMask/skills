# Sign EVM Transactions via Multichain Client

## When to use

Use this skill when:
- Sending EVM transactions through `invokeMethod` on a multichain client
- Signing messages with `personal_sign` or `eth_signTypedData_v4`
- Understanding which methods route to the RPC node vs the wallet
- Selecting the correct CAIP-2 EVM scope for a target chain

## Workflow

### Step 1: Ensure the client is connected with EVM scopes

```typescript
import { createMultichainClient, getInfuraRpcUrls } from '@metamask/connect-multichain';

const client = await createMultichainClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', caipChainIds: ['eip155:1', 'eip155:137'] }),
    },
  },
});

await client.connect(
  ['eip155:1', 'eip155:137'], // Ethereum mainnet + Polygon
  [],
);
```

### Step 2: Understand RPC routing

The multichain client routes EVM methods based on type:

| Route | Methods | Transport |
|-------|---------|-----------|
| **RPC node** | `eth_call`, `eth_getBalance`, `eth_blockNumber`, `eth_getTransactionReceipt`, `eth_estimateGas`, `eth_getCode`, `eth_getLogs`, `eth_getTransactionCount` | Infura / custom RPC URL from `supportedNetworks` |
| **Wallet** | `eth_sendTransaction`, `personal_sign`, `eth_signTypedData_v4`, `wallet_switchEthereumChain`, `wallet_addEthereumChain` | MetaMask (extension or MWP) |

The scope in `invokeMethod` determines which chain the request targets. Use `'eip155:1'` for Ethereum mainnet, `'eip155:137'` for Polygon, etc.

### Step 3: Send a transaction (eth_sendTransaction)

```typescript
const txHash = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'eth_sendTransaction',
    params: [{
      from: '0xYourAddress',
      to: '0xRecipientAddress',
      value: '0x2386F26FC10000', // 0.01 ETH in hex wei
      gas: '0x5208',            // 21000 gas
      // gasPrice or maxFeePerGas/maxPriorityFeePerGas optional
    }],
  },
});

console.log('Transaction hash:', txHash);
```

**Estimating gas before sending:**

```typescript
const gasEstimate = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'eth_estimateGas',
    params: [{
      from: '0xYourAddress',
      to: '0xRecipientAddress',
      value: '0x2386F26FC10000',
    }],
  },
});
```

### Step 4: Sign a message (personal_sign)

The message must be hex-encoded. The signer address is the second parameter.

```typescript
const message = '0x' + Buffer.from('Hello MetaMask!').toString('hex');

const signature = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'personal_sign',
    params: [message, '0xYourAddress'],
  },
});

console.log('Signature:', signature);
```

### Step 5: Sign typed data (eth_signTypedData_v4)

Pass the signer address as the first parameter and the JSON-stringified typed data as the second.

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
      { name: 'from', type: 'string' },
      { name: 'to', type: 'string' },
      { name: 'contents', type: 'string' },
    ],
  },
  primaryType: 'Mail',
  domain: {
    name: 'My DApp',
    version: '1',
    chainId: 1,
    verifyingContract: '0xContractAddress',
  },
  message: {
    from: 'Alice',
    to: 'Bob',
    contents: 'Hello!',
  },
};

const signature = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'eth_signTypedData_v4',
    params: ['0xYourAddress', JSON.stringify(typedData)],
  },
});

console.log('Typed data signature:', signature);
```

### Step 6: Cross-chain scope selection

Each `invokeMethod` call targets a specific chain via its scope. You do not need to "switch chains" — just use the appropriate scope.

```typescript
// Send on Polygon
await client.invokeMethod({
  scope: 'eip155:137',
  request: {
    method: 'eth_sendTransaction',
    params: [{ from: '0x...', to: '0x...', value: '0xDE0B6B3A7640000' }],
  },
});

// Read balance on Ethereum
const ethBalance = await client.invokeMethod({
  scope: 'eip155:1',
  request: {
    method: 'eth_getBalance',
    params: ['0xYourAddress', 'latest'],
  },
});

// Read balance on Polygon
const polyBalance = await client.invokeMethod({
  scope: 'eip155:137',
  request: {
    method: 'eth_getBalance',
    params: ['0xYourAddress', 'latest'],
  },
});
```

### Step 7: Error handling for signing

```typescript
try {
  const sig = await client.invokeMethod({
    scope: 'eip155:1',
    request: {
      method: 'personal_sign',
      params: [hexMessage, signerAddress],
    },
  });
} catch (err) {
  // Multichain invokeMethod errors are wrapped in RPCInvokeMethodErr (code 53);
  // the wallet's original code is on err.rpcCode
  if (err instanceof RPCInvokeMethodErr && err.rpcCode === 4001) {
    // User rejected the signing request
    return;
  }
  throw err;
}
```

(Import the class with `import { RPCInvokeMethodErr } from '@metamask/connect-multichain';`. Revert reasons / custom error bytes from the wallet are available on `err.rpcData`.)

## Important Notes

- **Scope = chain target:** The `scope` field in `invokeMethod` determines which chain the method executes on. Use `'eip155:<decimal-chainId>'` format (e.g., `'eip155:1'`, `'eip155:137'`, `'eip155:42161'`).
- **No chain switching needed:** Unlike single-chain EVM clients, the multichain client does not require `wallet_switchEthereumChain`. Each call specifies its own scope.
- **Read vs sign routing:** Read-only methods go to the RPC node (fast, no user prompt). Signing methods go to the wallet (requires user approval in MetaMask).
- **Hex encoding:** `personal_sign` expects the message as a hex string (`0x...`). `eth_sendTransaction` expects `value`, `gas`, and other numeric fields as hex strings.
- **`eth_signTypedData_v4`:** The typed data parameter must be a JSON **string**, not an object.
- **Gas estimation:** Always estimate gas with `eth_estimateGas` before sending if you don't have a reliable gas value. This routes to the RPC node and does not prompt the user.
- **Connected scopes:** `invokeMethod` will fail if the target scope was not included in the `connect()` call. Ensure you connect with all chains you intend to use.
