# Setup Solana React Native App with MetaMask

## When to use

Use this skill when:
- Integrating MetaMask with Solana in a React Native application
- Setting up the required polyfills and metro shims for `@metamask/connect-solana`
- Building Solana sign and send flows in React Native using `invokeMethod`
- You need Solana support in React Native where `@solana/wallet-adapter-react` is **not** available

## Workflow

### Step 1: Install dependencies

```bash
npm install @metamask/connect-solana @metamask/connect-multichain @solana/web3.js react-native-get-random-values buffer readable-stream @react-native-async-storage/async-storage
```

`@metamask/connect-multichain` is a regular dependency of `@metamask/connect-solana` and is installed transitively — but this skill imports `createMultichainClient` directly (to configure `mobile.preferredOpenLink`, which `createSolanaClient` does not forward), so declare it explicitly to keep strict package managers (pnpm) happy. The SDK warns at runtime if duplicate or mismatched copies are resolved.

### Step 2: Create the polyfills file

Create `polyfills.ts` at the root of your project.

```typescript
// polyfills.ts
import { Buffer } from 'buffer';

// Buffer — connect-multichain self-polyfills this, but set early as a safety
// net for peer deps (e.g. @solana/web3.js) that may load first.
global.Buffer = Buffer;

// window object — required for correct platform detection and deeplink behaviour.
const eventListeners = new Map<string, Set<EventListener>>();
if (typeof global.window === 'undefined') {
  (global as any).window = {
    location: {
      hostname: 'my-rn-app',
      href: 'https://my-rn-app.local',
    },
    navigator: { product: 'ReactNative' },
    addEventListener: (event: string, listener: EventListener) => {
      if (!eventListeners.has(event)) eventListeners.set(event, new Set());
      eventListeners.get(event)?.add(listener);
    },
    removeEventListener: (event: string, listener: EventListener) => {
      eventListeners.get(event)?.delete(listener);
    },
    dispatchEvent: (_event: Event) => true,
  };
}

// NOTE: Event and CustomEvent are NOT needed for standalone connect-solana —
// the SDK uses eventemitter3 internally. Add them only if using wagmi.
```

### Step 3: Import polyfills FIRST in the entry file

`react-native-get-random-values` must be the **very first import** in the entry file — it cannot be inside `polyfills.ts` because Metro may have already touched crypto by the time that file runs.

```typescript
// index.js or App.tsx — import order is critical
import 'react-native-get-random-values'; // MUST be first (needed for RN < 0.72; safe to include on 0.72+)
import './polyfills';

import { AppRegistry } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

### Step 4: Configure metro shims

Add `extraNodeModules` to `metro.config.js` so the bundler can resolve Node.js built-in modules:

```javascript
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// src/empty-module.js: `module.exports = {};`
// Only `stream` needs a real shim — the other Node built-ins are referenced
// by transitive deps but never called at runtime in React Native.
const emptyModule = path.resolve(__dirname, 'src', 'empty-module.js');

const config = {
  resolver: {
    extraNodeModules: {
      stream: require.resolve('readable-stream'),
      crypto: emptyModule,
      http: emptyModule,
      https: emptyModule,
      net: emptyModule,
      tls: emptyModule,
      zlib: emptyModule,
      os: emptyModule,
      dns: emptyModule,
      assert: emptyModule,
      url: emptyModule,
      path: emptyModule,
      fs: emptyModule,
    },
  },
};

module.exports = mergeConfig(getDefaultConfig(__dirname), config);
```

### Step 5: Create the Solana client

`createSolanaClient` does not forward `mobile` options to the underlying multichain core. In React Native, you must call `createMultichainClient` first with `mobile.preferredOpenLink` so the singleton core is configured for deeplinks, then call `createSolanaClient` which reuses that same core.

```typescript
import { createMultichainClient } from '@metamask/connect-multichain';
import { createSolanaClient } from '@metamask/connect-solana';
import { Linking } from 'react-native';

// Initialize the multichain singleton with mobile deeplink handling
await createMultichainClient({
  dapp: {
    name: 'My Solana RN App',
    url: 'https://myapp.com',
  },
  api: {
    supportedNetworks: {},
  },
  mobile: {
    preferredOpenLink: (deeplink: string) => Linking.openURL(deeplink),
  },
});

// Create the Solana client — reuses the multichain singleton above
const solanaClient = await createSolanaClient({
  dapp: {
    name: 'My Solana RN App',
    url: 'https://myapp.com',
  },
  api: {
    supportedNetworks: {
      mainnet: 'https://api.mainnet-beta.solana.com',
    },
  },
});
```

### Step 6: Use multichain invokeMethod for Solana operations

**There is no `@solana/wallet-adapter-react` in React Native.** Instead, use the `core` multichain client and `invokeMethod` to call Solana RPC methods on specific CAIP scopes.

#### Connect

```typescript
await solanaClient.core.connect(
  ['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'],
  [],
);
```

Listen for `wallet_sessionChanged` to get accounts after connection:

```typescript
solanaClient.core.on('wallet_sessionChanged', (session) => {
  // Scopes live under session.sessionScopes; accounts are CAIP-10 strings
  // ('solana:<genesisHash>:<address>') — take the last segment for the address
  const caipAccounts =
    session?.sessionScopes?.['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp']?.accounts ?? [];
  const solanaAccounts = caipAccounts.map((a) => a.split(':')[2]);
  console.log('Solana accounts:', solanaAccounts);
});
```

#### Sign a message

```typescript
const message = new TextEncoder().encode('Hello from React Native!');
const messageBase64 = Buffer.from(message).toString('base64');

// Method names have no `solana_` prefix; the account is passed as account: { address }
const result = await solanaClient.core.invokeMethod({
  scope: 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp',
  request: {
    method: 'signMessage',
    params: {
      account: { address: solanaAccounts[0] },
      message: messageBase64,
    },
  },
});

// result: { signature: <base58 string>, signedMessage: <base64>, signatureType: 'ed25519' }
console.log('Signature:', result.signature);
```

#### Sign and send a transaction

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
const senderPubkey = new PublicKey(solanaAccounts[0]);

const tx = new Transaction().add(
  SystemProgram.transfer({
    fromPubkey: senderPubkey,
    toPubkey: new PublicKey('11111111111111111111111111111112'),
    lamports: 0.001 * LAMPORTS_PER_SOL,
  }),
);
tx.recentBlockhash = blockhash;
tx.feePayer = senderPubkey;

const serializedTx = tx.serialize({ requireAllSignatures: false });
const txBase64 = Buffer.from(serializedTx).toString('base64');

const SOLANA_MAINNET = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const sendResult = await solanaClient.core.invokeMethod({
  scope: SOLANA_MAINNET,
  request: {
    method: 'signAndSendTransaction',
    params: {
      account: { address: solanaAccounts[0] },
      transaction: txBase64,
      scope: SOLANA_MAINNET,
    },
  },
});

// sendResult: { signature: <base58 transaction signature> }
console.log('Transaction signature:', sendResult.signature);
```

#### Disconnect

```typescript
await solanaClient.disconnect();
```

### Step 7: Full React Native component

```tsx
import React, { useState, useEffect } from 'react';
import { View, Text, Button, Alert, Linking } from 'react-native';
import { createMultichainClient } from '@metamask/connect-multichain';
import { createSolanaClient, SolanaClient } from '@metamask/connect-solana';
import {
  Connection,
  Transaction,
  SystemProgram,
  PublicKey,
  LAMPORTS_PER_SOL,
} from '@solana/web3.js';

const MAINNET_SCOPE = 'solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp';
const RPC_URL = 'https://api.mainnet-beta.solana.com';

export default function SolanaScreen() {
  const [client, setClient] = useState<SolanaClient | null>(null);
  const [accounts, setAccounts] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      await createMultichainClient({
        dapp: { name: 'My RN App', url: 'https://myapp.com' },
        api: { supportedNetworks: {} },
        mobile: { preferredOpenLink: (dl) => Linking.openURL(dl) },
      });
      const c = await createSolanaClient({
        dapp: { name: 'My RN App', url: 'https://myapp.com' },
        api: { supportedNetworks: { mainnet: RPC_URL } },
      });
      setClient(c);
      c.core.on('wallet_sessionChanged', (session) => {
        const caipAccounts = session?.sessionScopes?.[MAINNET_SCOPE]?.accounts ?? [];
        setAccounts(caipAccounts.map((a) => a.split(':')[2]));
      });
    })();
  }, []);

  const handleConnect = async () => {
    if (!client) return;
    try {
      await client.core.connect([MAINNET_SCOPE], []);
    } catch (err: any) {
      Alert.alert('Connection failed', err.message);
    }
  };

  const handleSignMessage = async () => {
    if (!client || accounts.length === 0) return;
    try {
      const message = Buffer.from('Hello from React Native!').toString('base64');
      const result = await client.core.invokeMethod({
        scope: MAINNET_SCOPE,
        request: { method: 'signMessage', params: { account: { address: accounts[0] }, message } },
      });
      Alert.alert('Signed', JSON.stringify(result.signature).slice(0, 40) + '...');
    } catch (err: any) {
      Alert.alert('Sign failed', err.message);
    }
  };

  const handleSendTransaction = async () => {
    if (!client || accounts.length === 0) return;
    try {
      const connection = new Connection(RPC_URL);
      const { blockhash } = await connection.getLatestBlockhash();
      const sender = new PublicKey(accounts[0]);

      const tx = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: sender,
          toPubkey: new PublicKey('11111111111111111111111111111112'),
          lamports: 0.001 * LAMPORTS_PER_SOL,
        }),
      );
      tx.recentBlockhash = blockhash;
      tx.feePayer = sender;

      const txBase64 = Buffer.from(
        tx.serialize({ requireAllSignatures: false }),
      ).toString('base64');

      const result = await client.core.invokeMethod({
        scope: MAINNET_SCOPE,
        request: {
          method: 'signAndSendTransaction',
          params: { account: { address: accounts[0] }, transaction: txBase64, scope: MAINNET_SCOPE },
        },
      });
      Alert.alert('Sent', result.signature);
    } catch (err: any) {
      Alert.alert('Transaction failed', err.message);
    }
  };

  const handleDisconnect = async () => {
    if (!client) return;
    await client.disconnect();
    setAccounts([]);
  };

  if (accounts.length === 0) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
        <Button title="Connect MetaMask (Solana)" onPress={handleConnect} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: 12 }}>
      <Text>Address: {accounts[0]}</Text>
      <Button title="Sign Message" onPress={handleSignMessage} />
      <Button title="Send 0.001 SOL" onPress={handleSendTransaction} />
      <Button title="Disconnect" onPress={handleDisconnect} />
    </View>
  );
}
```

## Important Notes

- **No wallet-adapter in React Native** — `@solana/wallet-adapter-react` does not support React Native. Use `solanaClient.core.invokeMethod` with CAIP-scoped Solana RPC methods instead.
- **Polyfill import order is critical** — `react-native-get-random-values` must be the very first import in the entry file, not inside `polyfills.ts`. `Buffer` is self-polyfilled by `@metamask/connect-multichain` but set it early in `polyfills.ts` as a safety net for peer deps. `Event`/`CustomEvent` are NOT needed for standalone connect-solana (the SDK uses eventemitter3); only add them if using wagmi.
- **Metro shims are required** — the SDK and its dependencies reference Node.js built-ins (`stream`, `crypto`, `http`, etc.) that Metro cannot resolve without explicit shims in `metro.config.js`.
- **`mobile.preferredOpenLink` is required** — `createSolanaClient` does not forward `mobile` options. Call `createMultichainClient` first with `mobile: { preferredOpenLink: (dl) => Linking.openURL(dl) }` to configure the singleton core for deeplinks, then call `createSolanaClient` which reuses it.
- **Solana networks** — mainnet, devnet, and testnet scopes are all modeled by the SDK; non-mainnet availability depends on the connected MetaMask build/version, so handle connection errors rather than assuming a cluster is present.
- **`skipAutoRegister` option** — pass `skipAutoRegister: true` to `createSolanaClient` to prevent automatic wallet-standard registration.
- **`disconnect()` only revokes Solana scopes** — EVM sessions remain active if present.
- **Call `createSolanaClient` once** — each call returns a *new* Solana client wrapper, but they share the singleton multichain core (whose options merge across calls). Create it once (e.g., in a `useEffect` or before app registration), don't recreate per render.
