---
name: setup-evm-react-native-app
description: Scaffold a React Native app with MetaMask EVM integration including required polyfills, metro.config.js shims, import order constraints, mobile deeplinks, and a full component example
maturity: stable
---
# Setup EVM React Native App with MetaMask Connect

## When to use

Use this skill when:
- Creating a React Native app that connects to MetaMask Mobile
- Setting up polyfills for window and other missing globals
- Configuring metro.config.js with Node.js module shims
- Debugging React Native import order or missing polyfill errors

## Workflow

### Step 1: Install dependencies

Install the SDK and all required polyfill/shim packages:

```bash
npm install @metamask/connect-evm @metamask/connect-multichain react-native-get-random-values buffer @react-native-async-storage/async-storage readable-stream
```

`@metamask/connect-multichain` is installed transitively by `@metamask/connect-evm` (only the 2.0.0 release briefly made it a peer dependency; 2.1.0 reverted that) — installing it explicitly is harmless but not required. The SDK warns at runtime on duplicate or mismatched copies. `react-native-get-random-values` provides `crypto.getRandomValues` — strictly required only on React Native < 0.72 (Hermes 0.72+ ships `globalThis.crypto.getRandomValues` natively), but recommended as a safety net on all versions. It **must** be imported before any other SDK-related code. `readable-stream` provides the `stream` shim for Metro. `buffer` is recommended as a safety net for peer dependencies — `@metamask/connect-multichain` self-polyfills Buffer internally, but other deps (e.g. `eciesjs`) may load before it. `@react-native-async-storage/async-storage` is needed for session persistence.

### Step 2: Create polyfills.ts

Create `src/polyfills.ts` with all required global shims. This file must be imported before anything else:

```typescript
// src/polyfills.ts
// IMPORTANT: react-native-get-random-values must be imported in the
// entry file BEFORE this polyfills file. See Step 4.

import { Buffer } from 'buffer';

// Buffer global — connect-multichain self-polyfills this, but set it here
// as a safety net for other deps that may load before connect-multichain.
global.Buffer = Buffer;

// window object — required for correct platform detection and deeplink behaviour.
// connect-multichain inspects window.navigator.product and window.location to
// determine platform type and whether to use deeplinks vs install modal.
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

// NOTE: Event and CustomEvent polyfills are NOT needed for standalone
// @metamask/connect-evm usage — the SDK uses eventemitter3 internally.
// Add them only if you are also using wagmi (wagmi dispatches DOM events).
```

### Step 3: Configure metro.config.js

Metro cannot resolve Node.js built-in modules. Map them to React Native-compatible shims or an empty module:

```javascript
// metro.config.js
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');
const path = require('path');

// Create a path to an empty module for stubs
const emptyModule = path.resolve(__dirname, 'src/empty-module.js');

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

Create the empty module stub:

```javascript
// src/empty-module.js
module.exports = {};
```

### Step 4: Set up the entry file with correct import order

The import order is critical. `react-native-get-random-values` **must** be the very first import:

```typescript
// index.js or App.tsx (entry file)
import 'react-native-get-random-values';  // MUST be first
import './src/polyfills';                   // MUST be second
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

AppRegistry.registerComponent(appName, () => App);
```

If you import anything from `@metamask/connect-evm` before `react-native-get-random-values`, you will get `crypto.getRandomValues is not a function`.

### Step 5: Create the EVM client with mobile configuration

```typescript
// src/metamask.ts
import { createEVMClient, getInfuraRpcUrls } from '@metamask/connect-evm';
import { Linking } from 'react-native';
import type { MetamaskConnectEVM } from '@metamask/connect-evm';

let clientPromise: Promise<MetamaskConnectEVM> | null = null;

export function getClient(): Promise<MetamaskConnectEVM> {
  if (!clientPromise) {
    clientPromise = createEVMClient({
      dapp: {
        name: 'My RN DApp',
        url: 'https://mydapp.com',
      },
      api: {
        supportedNetworks: {
          ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1', '0x89'] }),
        },
      },
      ui: {
        preferExtension: false,
      },
      mobile: {
        preferredOpenLink: (deeplink: string) => Linking.openURL(deeplink),
        useDeeplink: true,
      },
      eventHandlers: {
        // Keys are camelCase — `display_uri`/`wallet_sessionChanged` are NOT valid here
        displayUri: (uri: string) => {
          console.log('Deeplink URI:', uri);
        },
        connect: ({ accounts, chainId }) => {
          // Fires on connection and on automatic session restore at relaunch
          console.log('Connected/restored:', accounts, chainId);
        },
      },
      debug: false,
    });
  }
  return clientPromise;
}
```

`mobile.preferredOpenLink` is **required** for React Native — it tells the SDK how to open deeplinks to the MetaMask Mobile app. Without it, the connection flow will hang silently.

### Step 6: Build the React Native component

```tsx
// src/WalletScreen.tsx
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { getClient } from './metamask';
import type { MetamaskConnectEVM } from '@metamask/connect-evm';
import type { Hex, Address } from '@metamask/connect-evm';

export function WalletScreen() {
  const clientRef = useRef<MetamaskConnectEVM | null>(null);
  const [accounts, setAccounts] = useState<Address[]>([]);
  const [chainId, setChainId] = useState<Hex | null>(null);
  const [balance, setBalance] = useState<string>('');
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const client = await getClient();
      if (!mounted) return;
      clientRef.current = client;

      const provider = client.getProvider();

      provider.on('accountsChanged', (accs: Address[]) => {
        if (mounted) setAccounts(accs);
      });

      provider.on('chainChanged', (id: Hex) => {
        if (mounted) setChainId(id);
      });

      provider.on('disconnect', () => {
        if (mounted) {
          setAccounts([]);
          setChainId(null);
          setBalance('');
        }
      });
    }

    init();
    return () => { mounted = false; };
  }, []);

  const handleConnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;

    setConnecting(true);
    try {
      const result = await client.connect({ chainIds: ['0x1'] });
      setAccounts(result.accounts as Address[]);
      setChainId(result.chainId as Hex);
    } catch (err: any) {
      if (err.code === 4001) {
        Alert.alert('Rejected', 'Connection was rejected. Please try again.');
        return;
      }
      if (err.code === -32002) {
        Alert.alert('Pending', 'A request is already pending. Check MetaMask.');
        return;
      }
      Alert.alert('Error', err.message ?? 'Connection failed');
    } finally {
      setConnecting(false);
    }
  }, []);

  const handleDisconnect = useCallback(async () => {
    const client = clientRef.current;
    if (!client) return;
    await client.disconnect();
    setAccounts([]);
    setChainId(null);
    setBalance('');
  }, []);

  const fetchBalance = useCallback(async () => {
    const client = clientRef.current;
    if (!client || accounts.length === 0) return;

    const provider = client.getProvider();
    const wei = await provider.request({
      method: 'eth_getBalance',
      params: [accounts[0], 'latest'],
    }) as Hex;

    const ethBalance = parseInt(wei, 16) / 1e18;
    setBalance(ethBalance.toFixed(6));
  }, [accounts]);

  const isConnected = accounts.length > 0;

  return (
    <View style={styles.container}>
      {!isConnected ? (
        <TouchableOpacity
          style={styles.button}
          onPress={handleConnect}
          disabled={connecting}
        >
          <Text style={styles.buttonText}>
            {connecting ? 'Connecting...' : 'Connect MetaMask'}
          </Text>
        </TouchableOpacity>
      ) : (
        <View>
          <Text style={styles.label}>Account: {accounts[0]}</Text>
          <Text style={styles.label}>Chain: {chainId}</Text>
          <Text style={styles.label}>Balance: {balance || '—'} ETH</Text>
          <TouchableOpacity style={styles.button} onPress={fetchBalance}>
            <Text style={styles.buttonText}>Refresh Balance</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.button} onPress={handleDisconnect}>
            <Text style={styles.buttonText}>Disconnect</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  button: { backgroundColor: '#037DD6', padding: 14, borderRadius: 8, marginVertical: 8 },
  buttonText: { color: '#fff', fontSize: 16, textAlign: 'center' },
  label: { fontSize: 14, marginVertical: 4 },
});
```

## Important Notes

- **Import order is critical** — `react-native-get-random-values` must be the very first import in the entry file, followed by `polyfills.ts`, before any SDK or application code.
- **`mobile.preferredOpenLink` is required** — without it, the SDK cannot open deeplinks to MetaMask Mobile and the connection flow will silently fail.
- **`ui.preferExtension` should be `false`** — React Native has no browser extension. Setting this to `false` (or omitting it) ensures the SDK uses the mobile deeplink/QR flow.
- **Chain IDs are always hex strings** — use `'0x1'`, `'0x89'`, `'0xaa36a7'`. Never decimal.
- **`0x1` is auto-included** in every `connect()` call.
- **The empty module stub** (`src/empty-module.js`) is used for Node built-ins the SDK's transitive dependencies reference but never actually call at runtime in React Native. The `stream` module is the exception — it needs a real shim (`readable-stream`).
- **`createEVMClient` is a singleton** — do not call it on every render or in a component body. Initialize once and store the promise.
- **Session restoration** — the EVM client syncs any persisted session before `createEVMClient` resolves; detect restores via the `connect` / `accountsChanged` events (in `eventHandlers` or on the provider). There is no `wallet_sessionChanged` handler on the EVM client — that event belongs to the multichain client.
- **iOS requires `Linking` permissions** — ensure your `Info.plist` includes the `metamask` URL scheme in `LSApplicationQueriesSchemes` so `Linking.openURL` can open the MetaMask app.
