# Troubleshoot MetaMask Connect Issues

## When to use

Use this skill when:
- A connection attempt hangs, fails, or produces an unexpected error
- React Native apps crash on import or at runtime with missing polyfill errors
- QR codes don't appear or deeplinks don't open MetaMask Mobile
- Solana wallet adapter doesn't detect MetaMask
- Sessions are lost after page reload or disconnect behaves unexpectedly
- You need a systematic checklist to verify a MetaMask Connect integration

## Symptom -> Cause -> Fix Reference

---

### 1. Connection hangs / nothing happens after `connect()`

**Cause A:** Extension not detected but `preferExtension` is `true` (the default). The SDK falls through to MetaMask Wallet Protocol (MWP) but no QR code is rendered because headless mode is on and there is no `display_uri` listener.

**Fix:** Register a `display_uri` event listener to render the QR code URI before calling `connect()`

**Cause B:** A concurrent `connect()` call is already in progress over MWP.

**Fix:** Guard against double-clicking. Wrap `connect()` in a loading-state check and match on the `"Existing connection is pending"` error message — on MWP this error has **no numeric code**. (`-32002` only appears on the extension transport.)

---

### 2. User rejected request (code `4001`)

**Cause:** The user clicked "Reject" in MetaMask. This is normal behavior.

**Fix:** Handle gracefully — show a retry button. Do not treat this as an application error or log it to error-tracking services:

```typescript
try {
  await client.connect({ chainIds: ['0x1'] });
} catch (err) {
  if (err.code === 4001) {
    // User rejected — show retry UI
    return;
  }
  throw err;
}
```

---

### 3. Connection already pending (code `-32002`)

**Cause:** A previous `connect()` call has not yet resolved (the user may still have the MetaMask approval dialog open on mobile).

**Fix:** Show a message like "Check MetaMask Mobile to approve the connection." Do **not** call `connect()` again — the original promise will resolve once the user acts.

---

### 4. Chain not configured in `supportedNetworks`

**Cause:** An RPC request was made on a chain whose CAIP scope is missing from `api.supportedNetworks`. This error is thrown by the EIP-1193 provider's `request()` path for the *active* chain's node-routed reads — not by `connect()` (which only checks `chainIds` is non-empty) and not by `wallet_switchEthereumChain` (forwarded to the wallet).

**Fix:** Add every chain the dApp needs to `supportedNetworks` with a valid RPC URL:

```typescript
const client = await createEVMClient({
  dapp: { name: 'My DApp' },
  api: {
    supportedNetworks: {
      ...getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY', chainIds: ['0x1', '0x89', '0xaa36a7'] }),
      '0xa4b1': 'https://arb1.arbitrum.io/rpc',
    },
  },
});
```

---

### 5. `Cannot find variable: Buffer` / `Buffer is not defined` (React Native)

**Cause:** A dependency loaded before `@metamask/connect-multichain` uses `Buffer`. The connect package self-polyfills Buffer via its React Native entry point, but peer dependencies like `eciesjs` may execute first.

**Fix:** Add this to `polyfills.ts` and import it early (after `react-native-get-random-values`, before other imports):

```typescript
import { Buffer } from 'buffer';
global.Buffer = Buffer;
```

---

### 6. `Cannot find variable: Event` / `CustomEvent is not defined` (React Native)

**Cause:** wagmi dispatches DOM events internally, and React Native does not provide `Event`/`CustomEvent` globals. The `@metamask/connect-*` packages themselves never construct DOM events (they use `eventemitter3`) — this error only occurs when wagmi (or another DOM-dependent library) is in the stack.

**Fix:** If you use wagmi in React Native, add standalone class polyfills in `polyfills.ts`. Do **not** `extends Event` — that references the very global that is missing:

```typescript
class EventPolyfill {
  type: string;
  constructor(type: string) {
    this.type = type;
  }
}

class CustomEventPolyfill extends EventPolyfill {
  detail: any;
  constructor(type: string, options?: { detail?: any }) {
    super(type);
    this.detail = options?.detail;
  }
}

global.Event = EventPolyfill as any;
global.CustomEvent = CustomEventPolyfill as any;
```

If you are not using wagmi and still see this error, the source is another dependency — not the MetaMask Connect SDK.

---

### 7. Deeplinks not opening MetaMask app (React Native)

**Cause:** The `mobile.preferredOpenLink` callback is not configured.

**Fix:** Pass a function that calls `Linking.openURL`:

```typescript
import { Linking } from 'react-native';

const client = await createEVMClient({
  dapp: { name: 'My DApp', url: 'https://mydapp.com' },
  mobile: {
    preferredOpenLink: (deeplink: string) => Linking.openURL(deeplink),
  },
});
```

---

### 8. App crashes on import of SDK (React Native)

**Cause:** Metro bundler cannot resolve Node.js built-in modules (`stream`, `crypto`, `http`, `https`, `os`, `url`, `assert`, `events`, etc.) that SDK dependencies reference.

**Fix:** Add `extraNodeModules` shims in `metro.config.js`:

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

Install the corresponding shim packages via `npm install`.

---

### 9. `crypto.getRandomValues is not a function` (React Native)

**Cause:** `react-native-get-random-values` is either not installed or not imported as the very first import.

**Fix:** Import it as the **first line** of your entry file — before any other import:

```typescript
import 'react-native-get-random-values';
// all other imports follow
```

---

### 10. MetaMask wallet not appearing in Solana wallet adapter

**Cause A:** `createSolanaClient` was never called (or was called only inside a component that hasn't mounted). Note that registration happens ~1 second *after* the factory resolves, and the wallet adapter discovers late registrations automatically — so a briefly empty wallet list right after startup is normal.

**Fix:** Call client creation once in your bootstrap. Rendering does not need to block on it:

```typescript
import { createSolanaClient } from '@metamask/connect-solana';

// Kick off client creation — no need to await before rendering;
// the wallet registers via the wallet-standard register event (~1s later)
void createSolanaClient({
  dapp: { name: 'My DApp', url: window.location.href },
});

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
```

**Cause B:** The `wallets` prop on `WalletProvider` is not an empty array. MetaMask uses the wallet-standard auto-discovery protocol and must **not** be listed manually.

**Fix:** Always pass `wallets={[]}`:

```tsx
<WalletProvider wallets={[]} autoConnect>
  <WalletModalProvider>
    <App />
  </WalletModalProvider>
</WalletProvider>
```

---

### 11. Solana devnet / testnet not working

**Cause:** The SDK models mainnet, devnet, and testnet Solana scopes, but a given cluster's availability depends on the connected MetaMask build/version — and public cluster RPC endpoints are frequently rate-limited or flaky.

**Fix:** Confirm the connected wallet actually granted the devnet/testnet scope (inspect `session.sessionScopes`), and don't assume a non-mainnet cluster is present — handle the connection error. If the scope is granted but reads fail, the issue is likely an unreliable RPC endpoint; use a dedicated provider instead of the public default:

```typescript
// Public endpoints can be rate-limited or unavailable — use a dedicated RPC:
const endpoint = 'https://api.devnet.solana.com'; // or your own Infura /Helius / QuickNode / Alchemy URL
```

---

### 12. Session lost after page reload

**Cause:** The app is not re-deriving UI state after the automatic session restore. The EVM client syncs any persisted session **before** `createEVMClient` resolves, then re-emits `connect`/`accountsChanged` on the provider. (The EIP-1193 provider never emits `wallet_sessionChanged` — that event exists only on the multichain client.)

**Fix:** Check the cached state right after client creation, and subscribe to the provider events:

```typescript
const client = await createEVMClient({ /* ... */ });

// Synchronous check — a restored session is already reflected here
const account = client.getAccount();
if (account) {
  updateUI([account], client.getChainId());
}

const provider = client.getProvider();
provider.on('connect', ({ accounts, chainId }) => updateUI(accounts, chainId));
provider.on('accountsChanged', (accounts) => updateUI(accounts, client.getChainId()));
```

If you use the multichain client directly, listen there instead: `client.on('wallet_sessionChanged', (session) => session?.sessionScopes ...)`.

Do not call `connect()` again immediately on page load if a session already exists.

---

### 13. `disconnect()` doesn't fully disconnect

**Cause:** Disconnect behavior differs by client. On the **multichain** client (`createMultichainClient`), `disconnect(scopes)` with specific CAIP scopes only revokes those scopes; `disconnect()` with no arguments revokes all. On the **EVM** client (`createEVMClient`), `disconnect()` takes **no arguments** and revokes only `eip155:*` scopes. On the **Solana** client (`createSolanaClient`), `disconnect()` takes no arguments and revokes only the Solana scopes.

**Fix:** To fully terminate a multichain session, call the multichain client's `disconnect()` with no arguments:

```typescript
// Multichain client — partial revoke (only the specified scope)
await multichainClient.disconnect(['eip155:1']);

// Multichain client — full disconnect (all scopes)
await multichainClient.disconnect();

// EVM client — revokes eip155 scopes only (no scope argument)
await evmClient.disconnect();
```

---

### 14. QR code not appearing

**Cause A:** Headless mode is enabled but no `display_uri` listener is registered. The SDK generates the URI but has nowhere to render it.

**Fix:** Register a `displayUri` handler (or a provider `display_uri` listener) **before** calling `connect()`. The EVM client itself has no `.on()` method:

```typescript
const client = await createEVMClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: { supportedNetworks: getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY' }) },
  ui: { headless: true },
  eventHandlers: {
    displayUri: (uri) => renderQrCode(uri), // your QR rendering logic
  },
});

// Equivalent: client.getProvider().on('display_uri', renderQrCode);

await client.connect({ chainIds: ['0x1'] });
```

**Cause B:** The extension is detected and the SDK uses the extension transport instead of MWP. No QR is generated because none is needed.

**Fix:** Force the MWP/QR flow by disabling extension preference:

```typescript
const client = await createEVMClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: { supportedNetworks: getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY' }) },
  ui: { preferExtension: false },
});
```

---

### 15. Extension transport used but want mobile QR

**Cause:** `preferExtension` defaults to `true`. When the MetaMask browser extension is installed, the SDK always prefers it.

**Fix:** Set `ui.preferExtension = false`:

```typescript
const client = await createEVMClient({
  dapp: { name: 'My DApp', url: window.location.href },
  api: { supportedNetworks: getInfuraRpcUrls({ infuraApiKey: 'YOUR_INFURA_KEY' }) },
  ui: { preferExtension: false },
});
```

---

### 16. QR code modal blocked by dapp `Content-Security-Policy`

**Cause:** Older versions of the QR modal created a `blob:` URL for the embedded MetaMask icon. If the host page's CSP `connect-src` directive did not include `blob:`, the `XMLHttpRequest` used to build the blob was rejected and the QR image failed to render.

**Fix:** Upgrade to `@metamask/connect-multichain ^0.12.1` and `@metamask/multichain-ui ^0.4.1` (shipped in connect-monorepo `v30.0.0`). The icon is now embedded as a `data:` URI and `saveAsBlob: false` is set in the QR image options, so no `connect-src blob:` entry is needed:

```bash
npm install @metamask/connect-multichain@^0.12.1 @metamask/multichain-ui@^0.4.1
# or update @metamask/connect-evm to ^0.11.2 / @metamask/connect-solana to ^0.8.1
# which pin the fixed multichain version transitively
```

---

### 17. `eth_coinbase` returns an array / inconsistent account responses

**Cause:** Before `@metamask/connect-evm` 1.3.1, the SDK's intercepted EIP-1193 account requests returned the same accounts array for both `eth_requestAccounts` and `eth_coinbase`. Per spec, `eth_coinbase` should return a single address (`Address`), not an array.

**Fix:** Upgrade to `@metamask/connect-evm` ^1.3.1 (connect-monorepo `v35.0.0`). After upgrade, `eth_requestAccounts` resolves to `Address[]` and `eth_coinbase` resolves to the currently selected account (`Address`). Update any code that destructured `eth_coinbase` as an array:

```typescript
const accounts = await provider.request({ method: 'eth_requestAccounts' });
const coinbase = await provider.request({ method: 'eth_coinbase' });

console.log(accounts[0]); // selected account
console.log(coinbase);    // same address as accounts[0] — a string, NOT an array
```

```bash
npm install @metamask/connect-evm@^1.3.1
```

---

### 18. `wallet_switchEthereumChain` masks `Unrecognized chain ID` with `No chain configuration found.`

**Cause:** Before `@metamask/connect-evm` 1.2.0, calling `client.switchChain({ chainId })` without a `chainConfiguration` fallback (or invoking `wallet_switchEthereumChain` directly) replaced the wallet's original `Unrecognized chain ID` error with the wrapper message `No chain configuration found.`, hiding the underlying `4902` code from the dapp.

**Fix:** Upgrade to `@metamask/connect-evm` ^1.2.0 (connect-monorepo `v33.0.0`). The original wallet error (EIP-1193 code `4902`) is now forwarded to the dapp. Handle it explicitly — either retry with a `chainConfiguration` fallback or call `wallet_addEthereumChain`:

```typescript
try {
  await client.switchChain({ chainId: '0xa4b1' });
} catch (err) {
  if ((err as { code?: number }).code === 4902) {
    await client.switchChain({
      chainId: '0xa4b1',
      chainConfiguration: {
        chainId: '0xa4b1',
        chainName: 'Arbitrum One',
        rpcUrls: ['https://arb1.arbitrum.io/rpc'],
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
      },
    });
    return;
  }
  throw err;
}
```

Do not pattern-match on the legacy `"No chain configuration found"` string — that branch will never fire after the upgrade.

---

### 19. Analytics `_rejected` count looks artificially high / `wallet_unauthorized` mis-classified

**Cause:** Before `@metamask/connect-multichain` 0.14.0, the `isRejectionError` helper that drives the `mmconnect_wallet_action_rejected` analytics event treated EIP-1193 `4100 Unauthorized` (a CAIP-25 permission denial) as a user rejection, matched any error message containing the bare substring `"user"` (catching unrelated phrases like Account Abstraction's `"user operation reverted"`), and masked wallet-side codes behind the router's transport-boundary wrapper (`code: 53`).

**Fix:** Upgrade to `@metamask/connect-multichain` ^0.14.0 (connect-monorepo `v34.0.0`). The classifier now:

- Unwraps `RPCInvokeMethodErr` so wallet-side codes survive the router boundary
- No longer counts `4100 wallet_unauthorized` as a rejection — it's a permission denial, surfaced under `mmconnect_wallet_action_failed` instead
- Narrows the substring match to four explicit phrases: `"user rejected"`, `"user denied"`, `"user cancelled"`, `"user canceled"`

Net effect: `_rejected` becomes more precise, and `_failed` picks up everything `4100` was previously hiding. Update analytics dashboards / alerts that compared `_rejected` counts across the 0.13.x → 0.14.0 boundary — expect `_rejected` to drop and `_failed` to rise without an underlying behavior change.

The same release adds three optional companion fields on `mmconnect_wallet_action_failed` and `mmconnect_connection_failed`:

- `failure_reason` — coarse classifier (transport timeout, transport disconnect, EIP-1193 wallet errors `4100` / `4200` / `4902`, JSON-RPC wallet errors `-32601` / `-32602` / `-32603` and `-32000…-32099`, or `unknown`)
- `error_code` — raw wallet-side JSON-RPC / EIP-1193 code (e.g. `4001`, `-32603`)
- `error_message_sample` — sanitised, 200-char-max preview of the original error message (wallet addresses, hex blobs, URLs, and large decimal numbers scrubbed)

Use these for finer triage in analytics consumers:

```bash
npm install @metamask/connect-multichain@^0.14.0
# or update @metamask/connect-evm to ^1.3.0 / @metamask/connect-solana to ^1.1.0
# which pin the fixed multichain version transitively
```

---

### 20. Module-not-found / peer-version warning for `@metamask/connect-multichain` after upgrading to `connect-evm` 2.0.0 or `connect-solana` 2.0.0

**Cause:** You are on the 2.0.0 releases of `@metamask/connect-evm`/`@metamask/connect-solana`, which (only in that version) made `@metamask/connect-multichain` a **peer dependency** that was not installed transitively. 2.1.0 reverted this — `@metamask/connect-multichain` is a regular dependency again. If a wrong or duplicate version is resolved, the SDK logs a runtime warning about a version mismatch or duplicate `@metamask/connect-multichain` resolutions.

**Fix:** Add it explicitly to your own `dependencies`:

```bash
npm install @metamask/connect-multichain@^1.0.0
```

- Ensure a **single** `@metamask/connect-multichain` resolves in your tree — `npm ls @metamask/connect-multichain` (or `yarn why` / `pnpm why`) should show one `1.x` version. Deduplicate (e.g. `npm dedupe`) if two copies appear, since duplicate resolutions trigger the runtime warning and can break singleton/session sharing.
- `@metamask/connect-multichain` is now a stable 1.0 package following strict semver, so `^1.0.0` is safe for all current ecosystem packages.

---

### 21. MMConnect provider shows up twice in wallet discovery, or the wrong provider is selected

**Cause:** Since `@metamask/connect-evm` 2.0.0, the MMConnect-managed EIP-1193 provider is announced through EIP-6963 **by default** (when native MetaMask hasn't already announced). If your app also announces a provider manually, or a discovery library (RainbowKit / ConnectKit / Web3Modal / wagmi) re-announces, you can end up with a duplicate MetaMask-style entry.

**Fix:**

- Pass `skipAutoAnnounce: true` to `createEVMClient()` to suppress the automatic announcement when you want to control discovery yourself, then call `client.announceProvider()` exactly when you need to surface it.
- Do **not** manually re-emit `eip6963:announceProvider` for the MMConnect provider in addition to the SDK — let the SDK own it, or use `skipAutoAnnounce` + `announceProvider()`, not both.
- Note the SDK restricts EIP-6963 extension detection to native MetaMask RDNS values, so the MMConnect-managed provider will not be mistaken for — or select — the browser-extension transport.

---

## Diagnostic Checklist

Run through this checklist when any MetaMask Connect integration is misbehaving:

- [ ] **`supportedNetworks` has valid RPC URLs** — every chain the dApp uses must have an entry with a reachable URL
- [ ] **Chain IDs are hex strings for EVM** — use `'0x1'` not `1` or `'1'`
- [ ] **Polyfills loaded (React Native)** — `react-native-get-random-values` is first entry-file import (required for RN < 0.72); `window` shim present (required for all); `Event`/`CustomEvent` shims present **only if using wagmi**; `Buffer` set as safety net for peer deps
- [ ] **`preferredOpenLink` set (React Native)** — required for deeplinks to open MetaMask Mobile
- [ ] **Import order correct** — polyfills before SDK imports; `react-native-get-random-values` is the very first import
- [ ] **Error codes handled in catch blocks** — at minimum handle `4001` (user rejected) and `-32002` (pending)
- [ ] **Client not recreated per render** — call `createEVMClient` / `createMultichainClient` / `createSolanaClient` once; the shared multichain core is the singleton (its options merge), but each `create*Client` call still returns a fresh wrapper
- [ ] **`display_uri` listener registered before `connect()`** — required in headless mode for QR codes
- [ ] **Solana `wallets` prop is `[]`** — MetaMask uses wallet-standard discovery, not manual registration
- [ ] **Solana network availability checked** — mainnet/devnet/testnet scopes are all modeled by the SDK; don't assume a non-mainnet cluster is available on the connected wallet — handle connection errors
- [ ] **Analytics consumers use `failure_reason` / `error_code` / `error_message_sample`** — for `mmconnect_wallet_action_failed` / `mmconnect_connection_failed` triage (added in `@metamask/connect-multichain` 0.14.0); expect `_rejected` counts to drop and `_failed` counts to rise after upgrading past 0.13.x

## Important Notes

- Always check the **error code** first — it tells you the category of failure before you need to inspect the message.
- Use typed error classes from `@metamask/connect-multichain` for granular `instanceof` checks: `RPCInvokeMethodErr` (wallet errors from `invokeMethod` — original wallet code on `rpcCode`, revert data on `rpcData`), `RPCHttpErr` / `RPCReadonlyResponseErr` / `RPCReadonlyRequestErr` (RPC-node-routed read calls).
- The underlying multichain core is a **singleton**: `createMultichainClient` merges options into the shared core, and `createEVMClient` / `createSolanaClient` build chain-specific wrappers on top of it. Each `create*Client` call returns a fresh wrapper, so call it once at startup and reuse — do not wrap it in a React component render cycle.
- **Extension detection is synchronous** but **MWP connection is asynchronous** — if the extension is not installed, expect the flow to involve QR scanning or deeplinks with noticeable latency.
- In React Native, **import order matters critically**. `react-native-get-random-values` must be the very first import in the entry file (not inside `polyfills.ts`). The connect-* packages do not use DOM `Event`/`CustomEvent` — those polyfills are only needed when also using wagmi. `@metamask/connect-multichain` self-polyfills `Buffer` but set `global.Buffer` early as a safety net for peer deps.
- When debugging, enable `debug: true` in the client options to get verbose console output from the SDK internals.
