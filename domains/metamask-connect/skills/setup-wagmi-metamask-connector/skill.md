---
name: setup-wagmi-metamask-connector
description: Set up a wagmi app with the MetaMask Connect EVM connector using @metamask/connect-evm
maturity: stable
---
# Set Up Wagmi with MetaMask Connect EVM Connector

## When to use
- Building a new wagmi-based dApp that needs MetaMask wallet connectivity
- Adding the MetaMask connector to an existing wagmi config
- Need a working wagmi + MetaMask setup with connection, chain switching, signing, and transactions
- Integrating MetaMask via the new `@metamask/connect-evm` SDK in a wagmi project

## Workflow

### Step 1: Install Dependencies

```bash
npm install wagmi viem @tanstack/react-query

# Check which @metamask/connect-evm range wagmi's connector was built against:
npm info @wagmi/connectors peerDependencies
# ... then install a version inside that range (currently ^1.3.0):
npm install @metamask/connect-evm@"^1.3.0"
```

The connect-evm-backed `metaMask()` connector ships in **wagmi >= 3.6 / `@wagmi/connectors` >= 8**, which declares `@metamask/connect-evm` as an **optional peer dependency**. Install a version that satisfies wagmi's declared peer range — do **not** install `@metamask/connect-evm@latest` blindly: the current 2.x line does not satisfy `^1.3.0`, and pairing the connector with a major it wasn't built against produces peer warnings and undefined behavior. `@metamask/connect-multichain` is installed transitively by `connect-evm`; you do not need to add it.

### Step 2: Create Wagmi Config

```typescript
import { createConfig, http } from 'wagmi'
import { mainnet, sepolia, optimism, polygon } from 'wagmi/chains'
import { metaMask } from 'wagmi/connectors'

export const config = createConfig({
  chains: [mainnet, sepolia, optimism, polygon],
  connectors: [
    metaMask({
      dapp: {
        name: 'My Dapp',
        url: window.location.href,
        iconUrl: 'https://mydapp.com/icon.png',
      },
      debug: false,
    }),
  ],
  transports: {
    [mainnet.id]: http(),
    [sepolia.id]: http(),
    [optimism.id]: http(),
    [polygon.id]: http(),
  },
})

declare module 'wagmi' {
  interface Register {
    config: typeof config
  }
}
```

The connector automatically builds `supportedNetworks` from the configured chains and their default RPC URLs. You do not need to pass RPC URLs manually.

### Step 3: Set Up Providers in React

```tsx
import { WagmiProvider } from 'wagmi'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { config } from './wagmi'

const queryClient = new QueryClient()

function App() {
  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <YourApp />
      </QueryClientProvider>
    </WagmiProvider>
  )
}
```

### Step 4: Connect Wallet

```tsx
import { useConnect, useConnectors, useConnection, useDisconnect } from 'wagmi'

function ConnectButton() {
  const { mutate: connect, status, error } = useConnect()
  const connectors = useConnectors()
  const { address, chainId, status: connectionStatus } = useConnection()
  const { disconnect } = useDisconnect()

  if (connectionStatus === 'connected') {
    return (
      <div>
        <p>Connected: {address}</p>
        <p>Chain: {chainId}</p>
        <button onClick={() => disconnect()}>Disconnect</button>
      </div>
    )
  }

  return (
    <div>
      {connectors.map((connector) => (
        <button
          key={connector.uid}
          onClick={() => connect({ connector })}
        >
          {connector.name}
        </button>
      ))}
      {status === 'pending' && <p>Connecting...</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

### Step 5: Switch Chains

```tsx
import { useSwitchChain, useChains, useChainId } from 'wagmi'

function ChainSwitcher() {
  const chainId = useChainId()
  const chains = useChains()
  const { switchChain, error } = useSwitchChain()

  return (
    <div>
      {chains.map((chain) => (
        <button
          key={chain.id}
          disabled={chainId === chain.id}
          onClick={() => switchChain({ chainId: chain.id })}
        >
          {chain.name}
        </button>
      ))}
      {error && <p>{error.message}</p>}
    </div>
  )
}
```

### Step 6: Sign Messages

```tsx
import { useSignMessage } from 'wagmi'

function SignMessage() {
  const { data, signMessage, error, isPending } = useSignMessage()

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() => signMessage({ message: 'Hello from my dapp!' })}
      >
        Sign Message
      </button>
      {data && <p>Signature: {data}</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

### Step 7: Send Transactions

```tsx
import { useSendTransaction, useWaitForTransactionReceipt } from 'wagmi'
import { parseEther } from 'viem'

function SendTransaction() {
  const { data: hash, sendTransaction, isPending, error } = useSendTransaction()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({ hash })

  return (
    <div>
      <button
        disabled={isPending}
        onClick={() =>
          sendTransaction({
            to: '0xRecipientAddress',
            value: parseEther('0.01'),
          })
        }
      >
        {isPending ? 'Sending...' : 'Send 0.01 ETH'}
      </button>
      {isConfirming && <p>Confirming...</p>}
      {isSuccess && <p>Confirmed! Hash: {hash}</p>}
      {error && <p>Error: {error.message}</p>}
    </div>
  )
}
```

### Step 8: Connect and Sign (Optional)

Use `connectAndSign` to prompt the user to connect and sign a message in a single flow:

```typescript
metaMask({
  dapp: { name: 'My Dapp' },
  connectAndSign: 'By signing this message, you agree to our Terms of Service.',
})
```

The signed message is emitted on the provider as a `'connectAndSign'` event:

```typescript
const connector = config.connectors[0]
const provider = await connector.getProvider()
provider.on('connectAndSign', ({ accounts, chainId, signature }) => {
  console.log('Connected accounts:', accounts)
  console.log('Chain ID:', chainId)  // hex string e.g. '0x1'
  console.log('Signature:', signature)
})
```

### Step 9: ConnectWith (Optional)

Use `connectWith` to connect and execute an RPC method in a single flow:

```typescript
metaMask({
  dapp: { name: 'My Dapp' },
  connectWith: {
    method: 'eth_signTypedData_v4',
    params: [address, JSON.stringify(typedData)],
  },
})
```

## MetaMask Connector Parameters Reference

```typescript
type MetaMaskParameters = {
  dapp?: {
    name: string
    url?: string
    iconUrl?: string
  }
  debug?: boolean
  mobile?: {
    preferredOpenLink?: (deeplink: string, target?: string) => void
    useDeeplink?: boolean
  }
  ui?: {
    headless?: boolean
    preferExtension?: boolean
    showInstallModal?: boolean
  }
  // One of:
  connectAndSign?: string
  // OR
  connectWith?: { method: string; params: unknown[] }

  // Deprecated (still functional):
  dappMetadata?: { name: string; url?: string }  // use dapp instead
  logging?: unknown                                // use debug instead
}
```

## React Native Setup

For React Native apps using wagmi with MetaMask:

```typescript
import { Linking } from 'react-native'
import { metaMask } from 'wagmi/connectors'

metaMask({
  dapp: {
    name: 'My RN App',
    url: 'https://myapp.com',
  },
  mobile: {
    preferredOpenLink: (link) => Linking.openURL(link),
    useDeeplink: true,
  },
})
```

Ensure React Native polyfills are set up per the `react-native-polyfills` rule.

## Important Notes
- The connector ID is `'metaMaskSDK'` and the display name is `'MetaMask'`
- The connector RDNS is `['io.metamask', 'io.metamask.mobile']`
- `@metamask/connect-evm` is an optional peer dependency of `@wagmi/connectors` — only needed when you use the `metaMask()` connector, and the installed version must satisfy wagmi's declared peer range (currently `^1.3.0`), not "latest"
- The `supportedNetworks` map is auto-built from wagmi chain config — no manual RPC URL configuration needed
- If no `dapp` config is provided, defaults to `{ name: window.location.hostname, url: window.location.href }` in browsers
- `useAccount()` is deprecated in favor of `useConnection()` — both work but prefer the new name
- `useSwitchAccount()` is deprecated in favor of `useSwitchConnection()` — both work but prefer the new name
- Transport selection is automatic: uses MetaMask extension (postMessage) when available, otherwise MWP (WebSocket relay + QR/deeplinks)
- Error code `4001` = user rejected, `-32002` = request already pending — handle both explicitly
