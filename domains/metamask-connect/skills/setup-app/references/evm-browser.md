# Setup EVM Browser App with MetaMask Connect

## When to use

Use this skill when:
- Building a vanilla JavaScript or TypeScript browser app (no React) with MetaMask
- Integrating `createEVMClient` into a plain HTML page or a bundler-based project
- Wiring up EIP-1193 provider event listeners for account and chain changes
- Performing RPC calls through `provider.request` in a non-framework context

## Workflow

### Step 1: Install dependencies

```bash
npm install @metamask/connect-evm
```

`@metamask/connect-multichain` is a regular dependency of `@metamask/connect-evm` and is installed transitively. (Only the 2.0.0 release briefly made it a peer dependency; 2.1.0 reverted that.) Installing it explicitly is harmless but not required. The SDK warns at runtime if duplicate or mismatched copies are resolved.

Or include via CDN/script tag if not using a bundler.

### Step 2: Create the EVM client

```typescript
import { createEVMClient, getInfuraRpcUrls } from '@metamask/connect-evm';

const client = await createEVMClient({
  dapp: {
    name: 'My Browser DApp',
    url: window.location.href,
  },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1', '0x89', '0xa4b1', '0xaa36a7'] }),
    },
  },
  ui: {
    headless: false,
    preferExtension: true,
    showInstallModal: true,
  },
  eventHandlers: {
    // Keys are camelCase — `display_uri`/`wallet_sessionChanged` are NOT valid here
    displayUri: (uri: string) => {
      console.log('QR URI:', uri);
      // Render QR code for mobile connection
    },
    connect: ({ accounts, chainId }) => {
      // Fires on connection and on automatic session restore
      updateUI(accounts, chainId);
    },
  },
  debug: false,
});
```

There is no `wallet_sessionChanged` handler on the EVM client — session restores surface through the `connect` handler / provider event and `accountsChanged`. (`wallet_sessionChanged` is a multichain-client event.)

### Step 3: Register provider event listeners

Set up EIP-1193 event listeners immediately after client creation:

```typescript
const provider = client.getProvider();

provider.on('accountsChanged', (accounts: string[]) => {
  if (accounts.length === 0) {
    // User disconnected their wallet
    updateUI([], null);
    return;
  }
  updateUI(accounts, null);
  fetchBalance(accounts[0]);
});

provider.on('chainChanged', (chainId: string) => {
  // chainId is a hex string, e.g. '0x1'
  document.getElementById('chain')!.textContent = `Chain: ${chainId}`;
  // Refresh balances since the chain changed
  const currentAccount = document.getElementById('account')?.dataset.address;
  if (currentAccount) fetchBalance(currentAccount);
});

provider.on('disconnect', () => {
  // The connect-evm provider emits `disconnect` with no payload
  console.log('Disconnected');
  updateUI([], null);
});
```

### Step 4: Connect and update UI

```typescript
const connectBtn = document.getElementById('connect-btn')!;
const disconnectBtn = document.getElementById('disconnect-btn')!;

connectBtn.addEventListener('click', async () => {
  try {
    connectBtn.textContent = 'Connecting...';
    connectBtn.setAttribute('disabled', 'true');

    const { accounts, chainId } = await client.connect({
      chainIds: ['0x1'],
    });

    updateUI(accounts, chainId);
  } catch (err: any) {
    if (err.code === 4001) {
      showError('Connection rejected. Click Connect to try again.');
      return;
    }
    if (err.code === -32002) {
      showError('A connection request is already pending. Check MetaMask.');
      return;
    }
    showError(err.message ?? 'Connection failed');
  } finally {
    connectBtn.textContent = 'Connect MetaMask';
    connectBtn.removeAttribute('disabled');
  }
});

disconnectBtn.addEventListener('click', async () => {
  await client.disconnect();
  updateUI([], null);
});

function updateUI(accounts: string[], chainId: string | null) {
  const accountEl = document.getElementById('account')!;
  const chainEl = document.getElementById('chain')!;
  const connectedSection = document.getElementById('connected')!;

  if (accounts.length === 0) {
    connectedSection.style.display = 'none';
    connectBtn.style.display = 'block';
    return;
  }

  accountEl.textContent = `Account: ${accounts[0]}`;
  accountEl.dataset.address = accounts[0];
  if (chainId) chainEl.textContent = `Chain: ${chainId}`;
  connectedSection.style.display = 'block';
  connectBtn.style.display = 'none';
}

function showError(message: string) {
  const errorEl = document.getElementById('error')!;
  errorEl.textContent = message;
  setTimeout(() => { errorEl.textContent = ''; }, 5000);
}
```

### Step 5: Make RPC calls via provider.request

```typescript
const provider = client.getProvider();

// Cached/intercepted reads — safe before connect (no chain selection needed)
const chainId = await provider.request({ method: 'eth_chainId' });
const accounts = await provider.request({ method: 'eth_accounts' });

// Node-routed reads need a SELECTED chain — they throw `No chain ID selected`
// until after connect() (or a restored session). Call these post-connect.
const blockNumber = await provider.request({ method: 'eth_blockNumber' });

async function fetchBalance(address: string) {
  const wei = await provider.request({
    method: 'eth_getBalance',
    params: [address, 'latest'],
  }) as string;

  const ethBalance = parseInt(wei, 16) / 1e18;
  document.getElementById('balance')!.textContent =
    `Balance: ${ethBalance.toFixed(6)} ETH`;
}

// Get gas price
const gasPrice = await provider.request({ method: 'eth_gasPrice' });

// Get transaction count (nonce)
const nonce = await provider.request({
  method: 'eth_getTransactionCount',
  params: [accounts[0], 'latest'],
});

// Call a contract (read-only)
const result = await provider.request({
  method: 'eth_call',
  params: [
    {
      to: '0xContractAddress',
      data: '0xEncodedFunctionSelector',
    },
    'latest',
  ],
});
```

### Step 6: Switch chains with chainConfiguration fallback

```typescript
async function switchChain(targetChainId: string) {
  try {
    await client.switchChain({ chainId: targetChainId });
  } catch (err: any) {
    if (err.code === 4001) {
      showError('Chain switch rejected by user.');
    }
  }
}

// Switch to a chain with fallback configuration
// chainConfiguration triggers wallet_addEthereumChain if the chain
// is not already configured in the user's wallet
async function switchToArbitrum() {
  try {
    await client.switchChain({
      chainId: '0xa4b1',
      chainConfiguration: {
        chainId: '0xa4b1', // optional in the type, but set it to the target chain — if omitted it falls back to the currently selected chain (likely the wrong chain to add)
        chainName: 'Arbitrum One',
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        blockExplorerUrls: ['https://arbiscan.io'],
      },
    });
  } catch (err: any) {
    if (err.code === 4001) {
      showError('User rejected the chain addition or switch.');
    }
  }
}

// Switch to well-known chains
document.getElementById('switch-mainnet')!.addEventListener('click',
  () => switchChain('0x1'));
document.getElementById('switch-polygon')!.addEventListener('click',
  () => switchChain('0x89'));
document.getElementById('switch-sepolia')!.addEventListener('click',
  () => switchChain('0xaa36a7'));
document.getElementById('switch-arbitrum')!.addEventListener('click',
  () => switchToArbitrum());
```

### Step 7: Complete HTML structure

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <title>MetaMask Connect</title>
</head>
<body>
  <h1>MetaMask Connect Demo</h1>

  <button id="connect-btn">Connect MetaMask</button>
  <p id="error" style="color: red;"></p>

  <div id="connected" style="display: none;">
    <p id="account"></p>
    <p id="chain"></p>
    <p id="balance"></p>
    <button id="switch-mainnet">Mainnet (0x1)</button>
    <button id="switch-polygon">Polygon (0x89)</button>
    <button id="switch-sepolia">Sepolia (0xaa36a7)</button>
    <button id="switch-arbitrum">Arbitrum (0xa4b1)</button>
    <button id="disconnect-btn">Disconnect</button>
  </div>

  <script type="module" src="./src/main.ts"></script>
</body>
</html>
```

## Important Notes

- **Call `createEVMClient` once at app startup** — each call returns a *new* EVM client wrapper, but they all share one underlying multichain core (the core is the singleton whose options merge across calls). Don't recreate the client repeatedly.
- **Chain IDs are always hex strings** — use `'0x1'`, `'0x89'`, `'0xaa36a7'`. Never pass decimal numbers or decimal strings.
- **`0x1` (Ethereum mainnet) is auto-included** in every `connect()` call regardless of the `chainIds` you specify.
- **The provider exists before connection** — `client.getProvider()` always returns a valid EIP-1193 provider. But node-routed reads (`eth_blockNumber`, `eth_getBalance`, `eth_call`, …) require a **selected chain** and throw `No chain ID selected` until one is set (after `connect()` or a restored session). Only `eth_chainId` and `eth_accounts` (intercepted, served from cache) are safe before connecting.
- **Convenience getters** — use `client.getChainId()` (returns `Hex | undefined`) and `client.getAccount()` (returns `Address | undefined`) instead of `provider.request({ method: 'eth_chainId' })` / `eth_accounts` for cached state.
- **Connection status** — `client.status` returns `'connecting'` | `'connected'` | `'disconnected'`. (The 5-value `'loaded'`/`'pending'` union belongs to the multichain core, not the EVM client.) Use this for UI state instead of tracking manually.
- **Register event listeners before connecting** — set up `accountsChanged`, `chainChanged`, and `disconnect` handlers immediately after getting the provider.
- **`chainConfiguration` is a fallback, not a forced add** — it is only used if the wallet doesn't already have the chain configured. If the chain exists, only `wallet_switchEthereumChain` fires.
- **Page reloads restore automatically** — the EVM client syncs any persisted session before `createEVMClient` resolves and re-emits `connect`/`accountsChanged` on the provider. The EVM client has no `.on()` method and no `wallet_sessionChanged` handler — use the provider events (or `eventHandlers.connect`) to restore UI state.
- **Error code 4001** means the user deliberately rejected — show a retry option, not a crash screen.
- **Error code -32002** means a request is already pending — do not send another `connect()`. Wait for the user to respond in MetaMask.
