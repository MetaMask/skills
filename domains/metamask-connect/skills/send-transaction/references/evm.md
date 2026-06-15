# Send EVM Transactions with MetaMask Connect

## When to use

Use this skill when:
- Sending ETH transfers via `eth_sendTransaction`
- Calling smart contract functions by encoding `data` in the transaction
- Estimating gas with `eth_estimateGas` before sending
- Polling for transaction confirmation with `eth_getTransactionReceipt`
- Using the `connectWith` shortcut to connect and send in a single approval

## Workflow

### Step 1: Get the provider and connected account

```typescript
import { createEVMClient, getInfuraRpcUrls } from '@metamask/connect-evm';
import type { Hex, Address } from '@metamask/connect-evm';

const client = await createEVMClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1', '0x89'] }),
    },
  },
});

const { accounts } = await client.connect({ chainIds: ['0x1'] });
const provider = client.getProvider();
const from = accounts[0] as Address;
```

### Step 2: Convert ETH to hex wei

All `value` fields in transactions must be hex-encoded wei. 1 ETH = 10^18 wei:

```typescript
function ethToHexWei(ethAmount: string): Hex {
  const wei = BigInt(Math.round(parseFloat(ethAmount) * 1e18));
  return `0x${wei.toString(16)}` as Hex;
}

// Examples
ethToHexWei('0.01');   // '0x2386f26fc10000'
ethToHexWei('0.001');  // '0x38d7ea4c68000'
ethToHexWei('1');      // '0xde0b6b3a7640000'
```

### Step 3: Send an ETH transfer

Build the transaction params and call `eth_sendTransaction`:

```typescript
const txParams = {
  from: from,
  to: '0xRecipientAddress' as Address,
  value: ethToHexWei('0.01'),
};

try {
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  }) as Hex;

  console.log('Transaction hash:', txHash);
} catch (err: any) {
  if (err.code === 4001) {
    console.log('User rejected the transaction');
    return;
  }
  if (err.code === -32002) {
    console.log('A transaction request is already pending');
    return;
  }
  throw err;
}
```

### Step 4: Estimate gas before sending

Use `eth_estimateGas` to get a gas estimate, then optionally add a buffer:

```typescript
const txParams = {
  from: from,
  to: '0xRecipientAddress' as Address,
  value: ethToHexWei('0.01'),
  data: '0x', // empty for plain ETH transfer
};

const estimatedGas = await provider.request({
  method: 'eth_estimateGas',
  params: [txParams],
}) as Hex;

// Add 20% buffer to the estimate
const gasWithBuffer = BigInt(estimatedGas) * 120n / 100n;
const gasHex = `0x${gasWithBuffer.toString(16)}` as Hex;

const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{
    ...txParams,
    gas: gasHex,
  }],
}) as Hex;
```

### Step 5: Send a contract interaction

Encode the function call as the `data` field. For an ERC-20 `transfer(address,uint256)`:

```typescript
// ERC-20 transfer function selector: 0xa9059cbb
// Encode: transfer(0xRecipient, 1000000) for USDC (6 decimals)
const recipient = '0xRecipientAddress'.slice(2).padStart(64, '0');
const amount = (1000000).toString(16).padStart(64, '0'); // 1 USDC

const data = `0xa9059cbb${recipient}${amount}` as Hex;

const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [{
    from: from,
    to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' as Address, // USDC contract
    data: data,
    value: '0x0', // no ETH sent with token transfer
  }],
}) as Hex;
```

### Step 6: Poll for transaction receipt

After sending, poll `eth_getTransactionReceipt` until the transaction is confirmed:

```typescript
async function waitForReceipt(
  provider: any,
  txHash: Hex,
  intervalMs = 2000,
  timeoutMs = 120000,
): Promise<any> {
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const receipt = await provider.request({
      method: 'eth_getTransactionReceipt',
      params: [txHash],
    });

    if (receipt !== null) {
      // receipt.status: '0x1' = success, '0x0' = revert
      return receipt;
    }

    await new Promise((r) => setTimeout(r, intervalMs));
  }

  throw new Error(`Transaction ${txHash} not confirmed within ${timeoutMs}ms`);
}

// Usage
const txHash = await provider.request({
  method: 'eth_sendTransaction',
  params: [txParams],
}) as Hex;

const receipt = await waitForReceipt(provider, txHash);

if (receipt.status === '0x1') {
  console.log('Transaction confirmed in block:', parseInt(receipt.blockNumber, 16));
} else {
  console.error('Transaction reverted');
}
```

### Step 7: Use connectWith for single-approval flow

`connectWith` connects the wallet and sends a transaction in one user interaction:

```typescript
const { accounts, chainId, result } = await client.connectWith({
  method: 'eth_sendTransaction',
  // The params function receives the FIRST connected account (a single
  // Address), not the accounts array
  params: (account: Address) => [
    {
      from: account,
      to: '0xRecipientAddress' as Address,
      value: ethToHexWei('0.01'),
    },
  ],
  chainIds: ['0x1'],
});

// result is the transaction hash
const txHash = result as Hex;
console.log('Connected as:', accounts[0]);
console.log('Transaction hash:', txHash);
```

The `params` field accepts a function that receives the first connected account (`(account: Address) => unknown[]`), letting you use the connected address as `from` without knowing it ahead of time.

### Step 8: Handle errors

```typescript
try {
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [txParams],
  });
} catch (err: any) {
  switch (err.code) {
    case 4001:
      // User rejected the transaction — offer retry
      break;
    case -32002:
      // Request already pending — wait for user action in MetaMask
      break;
    case -32000:
      // Execution error (insufficient funds, gas too low, etc.)
      console.error('Execution error:', err.message);
      break;
    default:
      console.error('Transaction failed:', err);
  }
}
```

## Important Notes

- **`value` must be hex-encoded wei** — `'0xde0b6b3a7640000'` is 1 ETH. Never pass decimal strings or ETH-denominated numbers directly.
- **`from` must match the connected account** — MetaMask rejects transactions where `from` doesn't match the active account.
- **`eth_sendTransaction` returns a transaction hash, not a receipt** — poll `eth_getTransactionReceipt` to confirm the transaction was mined.
- **Receipt `status` is hex** — `'0x1'` means success, `'0x0'` means the transaction was mined but reverted.
- **`eth_estimateGas` can throw** — if the transaction would revert, estimation fails. Wrap it in a try/catch and show the error to the user.
- **`connectWith` params can be a function** — `params: (account) => [{ from: account, ... }]` — it receives the first connected account (a single `Address`, not an array).
- **Chain IDs are always hex strings in SDK calls** — `'0x1'`, `'0x89'`, `'0xaa36a7'`. The `chainId` in transaction objects follows the same convention when present.
- **Error code 4001** means the user deliberately rejected — handle gracefully.
- **Error code -32002** means a request is pending — do not send another transaction.
- **`0x1` is auto-included** in every `connect()` / `connectWith()` call.
