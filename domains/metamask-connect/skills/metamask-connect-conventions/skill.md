---
name: metamask-connect-conventions
description: Core conventions, constraints, and common mistakes for the MetaMask Connect SDK across EVM, Solana, multichain, wagmi, and React Native. Consult before writing or reviewing any MetaMask Connect integration code — covers hex chain IDs, supportedNetworks validation, EIP-1193 provider events, multichain session lifecycle, Solana constraints, React Native polyfills, and testing patterns.
maturity: stable
---
# MetaMask Connect — Conventions & Guardrails

Always-on guardrails for the MetaMask Connect SDK, distilled from the [MetaMask Connect Cursor plugin](https://github.com/MetaMask/metamask-connect-cursor-plugin) rules. Apply these whenever you generate or review MetaMask Connect (`@metamask/connect-evm` / `-multichain` / `-solana`) or wagmi `metaMask()` connector code.

## MetaMask Connect Best Practices

> Best practices for MetaMask Connect SDK — import paths, singleton behavior, required config, error handling, and connection state management

## Import Paths

- Import EVM client from `@metamask/connect-evm`
- Import multichain client from `@metamask/connect-multichain`
- Import Solana client from `@metamask/connect-solana`
- Never import from internal sub-packages like `@metamask/connect/dist/...` or `@metamask/connect-evm/src/...`
- Use the wagmi connector from the published entrypoint your installed version exposes; do not assume `@metamask/connect-evm/wagmi` exists unless your package version exports it
- `@metamask/connect-multichain` is a **regular dependency** of both `@metamask/connect-evm` and `@metamask/connect-solana` (since 2.1.0) and is installed transitively — you do not need to add it yourself. (Only the 2.0.0 releases briefly made it a peer dependency.) Both clients warn at runtime on duplicate or mismatched `@metamask/connect-multichain` resolutions; if you do depend on it directly (e.g. to use `createMultichainClient`), use `^1.0.0` — it is a stable 1.x package following strict semver

## Required Configuration

- `dapp.name` is always required — it appears in the MetaMask connection prompt
- `dapp.url` is required in Node.js and React Native environments (no `window.location` available)
- `dapp.url` in browser can default to `window.location.href` but explicit is safer
- `dapp.iconUrl` is optional — displayed in MetaMask connection UI
- `dapp.base64Icon` is an alternative to `iconUrl` — pass a base64-encoded icon string directly (useful when a hosted URL is unavailable, e.g., in React Native)

## Supported Networks

- Every chain the dApp interacts with must be in `api.supportedNetworks` with a reachable RPC URL
- Use `getInfuraRpcUrls({ infuraApiKey: 'API_KEY', chainIds?: Hex[] })` to populate common EVM chains — it returns a hex-keyed map for `createEVMClient`
- Use `getInfuraRpcUrls({ infuraApiKey: 'API_KEY', caipChainIds?: string[] })` to populate CAIP-2 chains for `createMultichainClient`
- Use `getInfuraRpcUrls({ infuraApiKey: 'API_KEY', networks: SolanaNetwork[] })` from `@metamask/connect-solana` to populate a network-name-keyed map for `createSolanaClient` — `networks` is required
- Chain `0x1` (Ethereum mainnet) is auto-included in the EVM `connect()` permission request if not specified — but it is **not** auto-added to `supportedNetworks`, which must list every chain explicitly
- Making an RPC request whose active chain is missing from `supportedNetworks` throws "not configured in supportedNetworks" (the check runs in the provider's `request()` path, not in `connect()`)

## Singleton Behavior

- `createMultichainClient` is the singleton shared core instance
- `createEVMClient` and `createSolanaClient` create chain-specific wrappers on top of that shared multichain core
- Repeated client creation still reuses the existing multichain session and merged core options, but EVM/Solana wrappers can attach fresh listeners
- The multichain core keeps the `dapp` object from the first call and does not overwrite it later
- Never call `create*Client` inside a React component render — call it once at app startup
- Do not wrap client creation in `useEffect` or other hooks that may re-run

## Error Handling

- Code `4001`: User rejected the request — show retry UI, do not log as application error. On the EVM provider it appears as `err.code`; on the multichain client it appears as `err.rpcCode` (see below)
- Code `-32002` ("request already pending") comes from the **extension transport only** — multichain MWP concurrent `connect()` instead throws a plain `Error` ("Existing connection is pending...") with no numeric code
- Wrap all `connect()`, `invokeMethod()`, and signing calls in try/catch
- Multichain `invokeMethod()` errors are wrapped in `RPCInvokeMethodErr` (its own `code` is `53`); the wallet's original code/message/data are preserved on `rpcCode` / `rpcMessage` / `rpcData`:
  ```typescript
  import { RPCInvokeMethodErr } from '@metamask/connect-multichain';

  try {
    await client.invokeMethod({ scope, request });
  } catch (err) {
    if (err instanceof RPCInvokeMethodErr && err.rpcCode === 4001) {
      // user rejection
    }
  }
  ```
- Other exported error classes: `RPCHttpErr` (code 50), `RPCReadonlyResponseErr` (51), `RPCReadonlyRequestErr` (52) — for RPC-node-routed read calls. (There are no `ProtocolError`/`StorageError`/`RpcError` exports.)

## Connection State

- Check connection state before making signing requests
- Listen for `wallet_sessionChanged` to track session state reactively
- Do not call `connect()` on page reload if a session already exists — listen for session restoration via events
- **Multichain client:** `disconnect()` with no arguments revokes all scopes and terminates the session; `disconnect(scopes)` revokes only those scopes
- **EVM client:** `disconnect()` revokes only the `eip155:*` scopes — Solana scopes on the same session survive; full teardown requires the multichain client
- `disconnect(scopes)` with specific scopes only revokes those scopes

## Unsupported Methods

- The EVM client **rejects** certain methods with `Method: <name> is not supported by Metamask Connect/EVM` (they are not silently ignored)
- Since `@metamask/connect-evm` 2.0.0, `wallet_requestPermissions` resolves to a spec-shaped requested-permissions array — but `connect()` remains the canonical way to establish permissions

---

## EVM Chain ID Format

> EVM chain ID formatting rules — hex string requirements, common chain IDs, CAIP-2 conversion, switchChain fallback, and supportedNetworks validation

## Hex String Requirement

- Chain IDs in MetaMask Connect must always be hex strings: `'0x1'` not `1` or `'1'`
- All `chainIds` arrays, `supportedNetworks` keys, and `switchChain` parameters expect hex format
- Passing a number or decimal string will cause silent failures or runtime errors
- Use `'0x' + chainId.toString(16)` to convert from decimal to hex

## Common Chain IDs

| Network | Decimal | Hex | CAIP-2 Scope |
|---------|---------|-----|-------------|
| Ethereum Mainnet | 1 | `0x1` | `eip155:1` |
| Sepolia | 11155111 | `0xaa36a7` | `eip155:11155111` |
| Polygon | 137 | `0x89` | `eip155:137` |
| Arbitrum One | 42161 | `0xa4b1` | `eip155:42161` |
| Optimism | 10 | `0xa` | `eip155:10` |
| Base | 8453 | `0x2105` | `eip155:8453` |
| Avalanche C-Chain | 43114 | `0xa86a` | `eip155:43114` |
| BNB Smart Chain | 56 | `0x38` | `eip155:56` |
| Celo | 42220 | `0xa4ec` | `eip155:42220` |
| Linea | 59144 | `0xe708` | `eip155:59144` |

## CAIP-2 Conversion

- EVM CAIP-2 format is `eip155:<decimal-chainId>` — always uses decimal, not hex
- EVM RPC / EIP-1193 format uses hex strings (`0x1`)
- Multichain `invokeMethod` scope uses CAIP-2 (`eip155:1`)
- EVM client `connect({ chainIds })` uses hex strings (`['0x1']`)
- Convert: hex `0x89` → decimal `137` → CAIP-2 `eip155:137`

## Auto-Included Chain

- `0x1` (Ethereum mainnet) is automatically included in the EVM client's `connect()` **permission request** even if you don't pass it in `chainIds`
- It is **not** injected into `api.supportedNetworks` — that map must explicitly contain every chain you use (including mainnet), and `createEVMClient` throws if it is empty
- All chains need valid RPC URLs in `supportedNetworks`
- If you use Infura RPC URLs, make sure the needed chains are enabled for your Infura project/API key

## Wagmi Connector

- The wagmi MetaMask connector is imported from `wagmi/connectors`: `import { metaMask } from 'wagmi/connectors'` — it requires `@metamask/connect-evm` as a peer dependency
- Use `getInfuraRpcUrls({ infuraApiKey: 'API_KEY', chainIds?: Hex[] })` from `@metamask/connect-evm` to populate `supportedNetworks` — returns a hex-chain-ID-keyed map of Infura RPC URLs (e.g. `{ '0x1': 'https://...', '0x89': 'https://...' }`); `chainIds` is optional and filters to specific hex chain IDs
- The multichain equivalent in `@metamask/connect-multichain` is `getInfuraRpcUrls({ infuraApiKey: 'API_KEY', caipChainIds?: string[] })` — returns a CAIP-2-keyed map (e.g. `{ 'eip155:1': 'https://...' }`) and accepts CAIP-2 IDs for filtering

## Switch Chain Fallback

- Use `client.switchChain({ chainId, chainConfiguration? })` to switch the active EVM chain
- If the chain is not already added in MetaMask, `wallet_switchEthereumChain` can fail
- Pass `chainConfiguration` directly to `client.switchChain()` as the `wallet_addEthereumChain` fallback payload
- In wagmi flows, the connector passes the same fallback config through to the underlying SDK `switchChain()` call
- Since `@metamask/connect-evm` 1.2.0, calling `switchChain({ chainId })` without a `chainConfiguration` now surfaces the wallet's **original** `Unrecognized chain ID` error (EIP-1193 code `4902`) instead of the previous `No chain configuration found.` wrapper. Catch the raw code in your `catch` block and either retry with a `chainConfiguration` fallback, call `wallet_addEthereumChain` explicitly, or prompt the user to add the chain — do not pattern-match on the legacy `"No chain configuration found"` message string
- Since `@metamask/connect-evm` 2.0.0, MWP-backed (Mobile Wallet Protocol) EIP-1193 requests reject with the wallet's error consistently with the default transport, so `switchChain()` no longer inspects returned error payloads — wallet errors (including `4902`) always arrive as a **rejected promise**. Handle switch-chain failures purely in `catch`; do not check for an error object in the resolved value of `switchChain()` or a `provider.request({ method: 'wallet_switchEthereumChain' })` call

## Validation Error

- Making an RPC request whose **active** chain's CAIP scope is missing from `supportedNetworks` throws `Chain eip155:<id> is not configured in supportedNetworks. Requests cannot be made to chains not explicitly configured in supportedNetworks.`
- This check lives in the EIP-1193 provider's `request()` path — **not** in `connect()`. `connect()` only validates that `chainIds` is a non-empty array, and `wallet_switchEthereumChain` is forwarded to the wallet (it is not gated by `supportedNetworks`).
- Fix: add every chain the dApp reads from to `supportedNetworks` with a valid RPC URL before selecting it

---

## EVM Provider Event Handling

> EVM provider and connect-evm event handling — EIP-1193 events, SDK eventHandlers, payload types, display_uri timing, and transport events

## EIP-1193 Events (EVM Provider)

- **`connect`** — fired when the provider establishes a connection; payload: `{ chainId: Hex; accounts: Address[] }`
- **`disconnect`** — fired when the provider loses connection; **no payload**
- **`accountsChanged`** — fired when the user's accounts change; payload: `string[]` (array of addresses)
- **`chainChanged`** — fired when the active chain changes; payload: `string` (**hex** chain ID, not decimal)
- **`message`** — part of the EIP-1193 provider event *type* (payload: `{ type: string; data: unknown }`), but **not currently emitted** by `@metamask/connect-evm`; don't rely on it for subscription delivery

```typescript
const provider = client.getProvider();

provider.on('accountsChanged', (accounts: string[]) => {
  console.log('New accounts:', accounts);
});

provider.on('chainChanged', (chainId: string) => {
  // chainId is HEX (e.g., '0x1'), NOT decimal
  console.log('New chain:', chainId);
});

provider.on('connect', ({ chainId, accounts }: { chainId: string; accounts: string[] }) => {
  console.log('Connected to chain:', chainId, 'accounts:', accounts);
});

provider.on('disconnect', () => {
  // No payload — the event itself is the signal
  console.log('Disconnected');
});
```

## chainChanged Payload Type

- `chainChanged` emits a **hex string** (e.g., `'0x1'`, `'0x89'`), **not a decimal number**
- Never compare directly with decimal numbers: `chainId === 1` will always be false
- Convert if needed: `parseInt(chainId, 16)` to get the decimal chain ID
- This is a common source of bugs — always treat chainChanged payload as a hex string

## SDK eventHandlers (Client Options)

- Configure event callbacks directly in client options via `eventHandlers`:
  - `connect` — same as EIP-1193 connect
  - `disconnect` — same as EIP-1193 disconnect
  - `accountsChanged` — same as EIP-1193 accountsChanged
  - `chainChanged` — same as EIP-1193 chainChanged
  - `displayUri` — fires with the connection URI string for QR code rendering
  - `connectAndSign` — fires with the signature result from `connectAndSign` flow
  - `connectWith` — fires with the result from `connectWith` flow

```typescript
const client = await createEVMClient({
  dapp: { name: 'My DApp' },
  eventHandlers: {
    accountsChanged: (accounts) => updateUI(accounts),
    chainChanged: (chainId) => updateChain(chainId),
    displayUri: (uri) => renderQrCode(uri),
  },
});
```

## display_uri Timing

- `display_uri` only fires during the `'connecting'` state — between calling `connect()` and the connection resolving
- Register the `display_uri` listener **before** calling `connect()` — registering after may miss the event
- The URI is a one-time-use pairing token; once used or expired, it cannot be reused
- On connection error, do not attempt to regenerate or reuse the QR — call `connect()` again for a new URI
- In non-headless mode, the SDK renders its own QR modal; `display_uri` is mainly useful in headless mode

## Multichain stateChanged Event

- The multichain core client emits `stateChanged` whenever the connection status changes
- Listen via `client.on('stateChanged', (status) => ...)` on the multichain client, where `status` is a `ConnectionStatus` string
- This is available on the multichain client (`createMultichainClient`) and on the Solana client's public `.core` property. The EVM client does **not** expose `.core` (it is private) — use `client.status` / provider events there

## Transport Events

- For the Mobile Wallet Protocol (MWP) transport, the SDK attempts to resume an interrupted session — including a reconnection check when the browser tab regains focus — so you generally don't need to wire this up manually. This resumption logic is MWP-specific; the browser-extension transport does not use it.
- The provider's `disconnect` event carries no error payload — treat the event itself as the signal, and do not expect legacy json-rpc-engine codes (e.g. `1013`) from the connect-* packages

## EIP-6963 Provider Announcement

- Since `@metamask/connect-evm` 2.0.0, the MMConnect-managed EIP-1193 provider is announced through **EIP-6963** (`eip6963:announceProvider`) **by default** when native MetaMask has not already announced its own provider — so wallet-discovery UIs (RainbowKit, ConnectKit, Web3Modal, wagmi's `injected`/`metaMask` discovery, etc.) can surface the MMConnect provider automatically
- The auto-announce is suppressed when native MetaMask (extension) has already announced, and EIP-6963 extension detection is restricted to native MetaMask RDNS values so MMConnect announcements do not get mistaken for — or select — the browser-extension transport
- Pass `skipAutoAnnounce: true` to `createEVMClient()` to opt out of the automatic announcement (e.g. when you want to control discovery manually or avoid a duplicate entry alongside another integration)
- Call `client.announceProvider()` to re-announce on demand — useful after `skipAutoAnnounce`, or to re-emit in response to a late `eip6963:requestProvider` event from a discovery library that mounted after the SDK initialized

## Cached State Methods

- `eth_accounts` and `eth_chainId` return locally cached state from the SDK rather than making RPC calls
- The cached values are kept in sync via `accountsChanged` and `chainChanged` events, so they reflect the current state after connection
- Use `client.getChainId()` to get the current hex chain ID (returns `Hex | undefined`)
- Use `client.getAccount()` to get the current account address (returns `Address | undefined`)
- Since `@metamask/connect-evm` 1.3.1, the intercepted EIP-1193 account requests return method-specific shapes that match the spec: `provider.request({ method: 'eth_requestAccounts' })` resolves to an accounts array (`Address[]`), and `provider.request({ method: 'eth_coinbase' })` resolves to the **currently selected account** (`Address`), **not** the full accounts array. Do not destructure `eth_coinbase` as an array (`const [acct] = await provider.request({ method: 'eth_coinbase' })`) — treat it as a single address string
- Since `@metamask/connect-evm` 2.0.0, more intercepted EIP-1193 requests return spec-compatible values: `provider.request({ method: 'wallet_requestPermissions' })` resolves to the **requested permissions** array, while successful `wallet_switchEthereumChain` and `wallet_addEthereumChain` requests resolve to **`null`** (per EIP-3326 / EIP-3085). Do not expect a truthy value back from a successful switch/add — branch on the absence of a thrown error, not on the resolved value

## Client Status Property

- On the EVM client (`createEVMClient`), `client.status` is `ConnectEvmStatus`: `'connecting'`, `'connected'`, or `'disconnected'` (since `@metamask/connect-evm` 0.11.0 it no longer proxies `MultichainClient.status`)
- On the multichain client (`createMultichainClient`), `client.status` is the 5-value `ConnectionStatus`: `'loaded'`, `'pending'`, `'connecting'`, `'connected'`, or `'disconnected'`
- Use this for UI state management instead of tracking connection state manually

## Event Listener Best Practices

- Register event listeners before calling `connect()` to catch all events including initial state
- Remove listeners on component unmount to prevent memory leaks: `provider.removeListener('event', handler)`
- Do not register duplicate listeners — check if a listener is already registered before adding
- In React, use `useEffect` cleanup to remove listeners:

```typescript
useEffect(() => {
  const provider = client.getProvider();
  const handler = (accounts: string[]) => setAccounts(accounts);
  provider.on('accountsChanged', handler);
  return () => provider.removeListener('accountsChanged', handler);
}, [client]);
```

---

## Multichain Session Lifecycle

> Multichain session lifecycle rules — singleton merging, concurrent connect guard, session data shape, wallet_sessionChanged events, headless mode, timeouts, and permission handling

## Singleton Merging

- `createMultichainClient` is a singleton — calling it multiple times returns the same instance
- On subsequent calls, new options merge into the existing instance
- The `dapp` object from the first call is used for the client's lifetime — it is **excluded from option merging** entirely (later `dapp` values are ignored)
- `api.supportedNetworks` entries merge by spreading the new map over the old — new chains are added and **existing keys are overwritten** by later calls
- Call `createMultichainClient` once at app startup and store the returned client reference

## Concurrent Connect Guard

- Only one `connect()` call can be active at a time over MetaMask Wallet Protocol (MWP)
- Calling `connect()` while a previous MWP `connect()` is pending throws a plain `Error` ("Existing connection is pending. Please check your MetaMask Mobile app to continue.") with **no numeric code** — match on the message. (`-32002` is an extension-transport RPC-queue code, not an SDK error code)
- Guard against double-clicks with a loading state or disable the connect button during connection
- The original pending `connect()` promise will resolve once the user acts in MetaMask

## Session Data Shape

- Multichain `connect()` resolves with **no value** (`Promise<void>`) — session data arrives via the `wallet_sessionChanged` event or on demand from `client.provider.getSession()`
- Session data is `SessionData`: scopes live under `sessionScopes` (e.g., `session.sessionScopes['eip155:1'].accounts`), and accounts are CAIP-10 strings (`eip155:1:0x...`)
- `sessionProperties` may be present — if empty, it is `undefined` (not an empty object)
- Always null-check `sessionProperties` before accessing its fields
- Since `@metamask/connect-evm` 1.2.0, every `wallet_createSession` request issued by `connect-evm` attaches `sessionProperties: { 'eip1193-compatible': true }`. Sessions established through `createEVMClient` will surface this flag on the resolved session, letting wallets and analytics consumers distinguish EIP-1193-style connections from pure Multichain API connections or other provider types (e.g. Solana Wallet Standard). Do not rely on it being present for sessions created directly via the multichain client

## dapp.url Requirement

- In browser environments, `dapp.url` falls back to `window.location.href` if not specified
- In Node.js and React Native, `dapp.url` is **required** — there is no `window.location` to fall back to
- Omitting `dapp.url` in non-browser environments throws `Error: You must provide dapp url` during client creation (in the browser it is auto-filled from `window.location`, which is absent in Node.js / React Native)

## Multichain Events

- **`wallet_sessionChanged`** — fires when any part of the multichain session changes (accounts, scopes, permissions)
- Listen on the multichain client directly with `client.on('wallet_sessionChanged', handler)`
- Payload contains the updated session object with all active scopes and accounts
- Fires on: initial connection, account changes, scope additions/removals, session restoration

```typescript
// Payload is SessionData | undefined — iterate sessionScopes, not the payload itself
client.on('wallet_sessionChanged', (session) => {
  for (const [scope, data] of Object.entries(session?.sessionScopes ?? {})) {
    console.log(`Scope ${scope}:`, data.accounts); // CAIP-10 account IDs
  }
});
```

## Session Persistence and Resumption

- The SDK persists session state and attempts to resume on subsequent page loads
- Listen for `wallet_sessionChanged` on startup to detect restored sessions
- Do not call `connect()` again if a session already exists — check session state first
- `createEVMClient` and `createSolanaClient` perform an initial session sync before returning, but session state should still be treated as event-driven
- Do not assume a usable session exists unless your startup logic has observed the current session state or a `wallet_sessionChanged` event

## Headless Mode

- Set `ui: { headless: true }` to suppress the default QR code modal
- Register a `display_uri` event listener **before** calling `connect()` to receive the connection URI
- `display_uri` only fires during the connecting phase — after connection or on error, it stops
- On connection error in headless mode, do **not** try to regenerate the QR from the old URI — start a new `connect()` call
- The URI is a one-time-use pairing token

## Timeouts

- Default request timeout is **60 seconds**
- Mobile Wallet Protocol uses an extended **120 second** connection timeout while waiting for user action in MetaMask Mobile
- Pending-session resumption waits about **10 seconds** before giving up
- These are internal SDK timeouts — do not implement your own shorter timeouts that race against them

## Bundle / Lazy-loaded Transport

- Since `@metamask/connect-multichain` 0.13.0, the MWP transport modules — `@metamask/mobile-wallet-protocol-core`, `@metamask/mobile-wallet-protocol-dapp-client`, and `eciesjs` — are dynamically imported only when MWP transport is actually used
- Bundlers (webpack, Vite, Rollup, Metro) can now code-split the entire MWP + crypto dependency tree out of the main chunk for consumers who only use the browser-extension flow
- Do not statically import the MWP modules yourself in app code — that defeats the code-split and re-inflates the bundle
- Since `@metamask/connect-multichain` 0.14.0, the QR-code MWP flow (desktop web and Node.js) omits the initial `wallet_createSession` request from the deeplink URI and sends it as a separate request after the wallet completes the MWP handshake. The result is a shorter deeplink URI and a less dense QR code. The native deeplink (non-QR MWP) flow used on mobile web and React Native is unchanged — no app-side action required

## Permission Handling

- Use `connect(scopes, [], undefined, true)` when you need a fresh permission prompt even if permissions already exist — `forceRequest` is the fourth positional argument
- The multichain `connect` signature is `connect(scopes, caipAccountIds, sessionProperties?, forceRequest?)` — all positional arguments, not an options object
- `wallet_requestPermissions` itself does not take a `forceRequest` parameter; the SDK handles that through `connect()`
- Without `forceRequest`, the SDK may reuse an existing compatible session
- `connect()` internally handles the underlying permission request flow, so you rarely need to call `wallet_requestPermissions` directly
- For multichain, `connect(scopes, [])` is the canonical way to request permissions for specific chains

## Analytics

- The SDK emits dapp-side analytics events and attaches wallet-correlation metadata by default. To opt out, pass `analytics: { enabled: false }` to the client factory — supported by `createMultichainClient` (`@metamask/connect-multichain` 0.15.0+), `createEVMClient` (`@metamask/connect-evm` 1.4.0+), and `createSolanaClient` (`@metamask/connect-solana` 1.2.0+)
- Setting `analytics.enabled: false` on `createMultichainClient` also omits the `analytics.remote_session_id` field from connection metadata; on the EVM/Solana clients it disables dapp-side events and wallet-correlation metadata
- To disable analytics at runtime after the client exists (rather than at construction), call `analytics.disable()` (`@metamask/analytics` 0.6.0+) — it stops event collection and clears any queued analytics events
- Respect user privacy preferences (e.g. a Do-Not-Track or cookie-consent setting) by wiring them to `analytics.enabled` / `analytics.disable()` rather than trying to intercept or block the network requests yourself

---

## Solana Integration Constraints

> Constraints and requirements for Solana integration with MetaMask Connect — wallet adapter config, CAIP-2 IDs, network support per platform, RPC routing, and platform limitations

## Wallet Adapter Configuration

- The wallet name registered by `createSolanaClient` is `"MetaMask"` (renamed from `"MetaMask Connect"` in `@metamask/connect-solana` 1.0.0). Match on exactly `"MetaMask"` — do not branch on the old `"MetaMask Connect"` literal.
- Since `@metamask/connect-solana` 1.0.0, `createSolanaClient` no longer announces its own wallet-standard provider if an injected Solana provider (e.g. the MetaMask browser extension) is already present. Treat the already-injected provider as MetaMask; your UI should not expect two wallet entries.
- `WalletProvider` must receive `wallets={[]}` — MetaMask uses the wallet-standard auto-discovery protocol
- Never manually add MetaMask to the wallets array — it will not be found and may cause duplicates
- Initialize `createSolanaClient` early in app startup, but it does not need to resolve before the first `WalletProvider` render
- If your UI depends on MetaMask already being registered, gate that UI until `createSolanaClient` resolves
- Since `@metamask/connect-solana` 1.1.0, `createSolanaClient()` eagerly initializes the Solana wallet provider during creation — if the underlying multichain session already contains Solana scopes, the provider's accounts are populated by the time the client resolves. Apps no longer need to wait for a separate `wallet_sessionChanged` event to read accounts on cold start
- Since `@metamask/connect-solana` 1.1.0, `getWallet()` returns the same wallet instance on every call instead of constructing a new one. It is safe to cache the result in a module-level constant, React `useRef`, or `useMemo` — do not call `getWallet()` on every render expecting a fresh instance

## CAIP-2 Genesis Hash Identifiers

- Solana mainnet: `solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`
- Solana devnet: `solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`
- These are genesis hash identifiers, not cluster URLs or chain IDs
- Always use the full CAIP-2 string as the scope in multichain `invokeMethod` and `connect`

## Devnet and Testnet

- The SDK and the wallet-standard layer model three Solana scopes — mainnet (`solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp`), devnet (`solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1`), and testnet (`solana:4uhcVJyU9pJkvQyS88uRDiswHXSCkY3z`)
- Non-mainnet availability ultimately depends on the connected MetaMask build/version — don't assume a given cluster is present. Handle `connect()` / `invokeMethod` errors rather than treating devnet/testnet as guaranteed
- For Solana read calls, point a `@solana/web3.js` `Connection` at the matching cluster RPC (the SDK routes signing through the wallet, not reads)

## RPC Routing

- **All Solana methods route through the wallet** — there is no RPC node fallback
- Unlike EVM (where read methods like `eth_getBalance` go to Infura), every Solana `invokeMethod` call goes to MetaMask
- This means every Solana call may prompt the user or require wallet availability
- For Solana read operations (balance, account info), use `@solana/web3.js` `Connection` directly against an RPC endpoint

## Disconnect Scopes Behavior

- On the Solana client (`createSolanaClient`), `disconnect()` revokes **only** the Solana scopes (mainnet/devnet/testnet) — it does not touch EVM scopes. (Full-session teardown across all scopes is the *multichain* client's `disconnect()` with no arguments.)
- On the multichain client (`createMultichainClient`), `disconnect(['solana:5eykt4UsFv8P8NJdTREpY1vzqKqZKvdp'])` revokes only Solana mainnet — EVM scopes stay active
- Disconnecting a Solana scope does not affect any active EVM connections

## Chrome Android Bug

- There is a known issue with `@solana/wallet-adapter-react` on Chrome Android when used with the wallet-standard provider from `@metamask/connect-solana`
- The connect monorepo carries a patch for the wallet-adapter behavior in that setup
- Treat Solana wallet-adapter flows on mobile Chrome as fragile until you verify them explicitly
- Test Solana flows on desktop Chrome and MetaMask browser extension wallet before targeting mobile

## React Native Limitation

- The Solana wallet adapter (`@solana/wallet-adapter-react`) is **not supported** in React Native
- For Solana in React Native, use the multichain client (`createMultichainClient`) with `invokeMethod` directly
- Do not attempt to import `@solana/wallet-adapter-react` or `@solana/wallet-adapter-react-ui` in RN — they depend on browser APIs

---

## React Native Polyfills for MetaMask Connect

> Required polyfills and configuration for MetaMask Connect SDK in React Native — import order, Buffer, window, Event/CustomEvent, metro config, and persistence

## Per-Package Polyfill Requirements

Different integrations need different polyfills. Do not blindly copy the full set:

| Polyfill | connect-evm / connect-solana (standalone) | + wagmi |
|---|---|---|
| `react-native-get-random-values` | RN < 0.72 only (see below) | RN < 0.72 only |
| `Buffer` | Safety net only (self-polyfilled by connect-multichain) | Safety net only |
| `window` object | **Required** for correct deeplink/platform detection | **Required** |
| `Event` | Not required | **Required** (wagmi uses DOM events) |
| `CustomEvent` | Not required | **Required** (wagmi uses DOM events) |

## Import Order (Critical)

```typescript
// Entry file (_layout.tsx / index.js) — order is critical
import 'react-native-get-random-values'; // MUST be first (if used)
import './polyfills';                     // window shim, and Event/CustomEvent if using wagmi
```

Incorrect order causes `crypto.getRandomValues is not a function` at runtime.

## react-native-get-random-values

- Required only for **React Native < 0.72** — Hermes 0.72+ exposes `globalThis.crypto.getRandomValues` natively
- Still recommended as an explicit safety net — especially if any dependency has its own minimum RN version assumptions
- Must be the **very first import** in the entry file, before anything that touches crypto

## Buffer Polyfill

- `@metamask/connect-multichain` self-polyfills `Buffer` via its React Native entry point — not needed for the SDK itself
- Still recommended to set `global.Buffer = Buffer` in `polyfills.ts` as a safety net for peer deps (e.g. `eciesjs`, `@solana/web3.js`) that may load before connect-multichain
- Install: `npm install buffer`

## window Object Polyfill

- **Required** for correct platform and deeplink behaviour — `getPlatformType()` in connect-multichain inspects `window` and `global.navigator.product` to decide between the deeplink path and the install-modal path
- All `window.*` accesses inside the SDK are guarded, so code will not crash without it, but `isSecure()` returns the wrong value and deeplinks will not trigger
- Provide at minimum: `location`, `addEventListener`, `removeEventListener`, `dispatchEvent`

## Event and CustomEvent Polyfills

- **Not required** by the connect-* packages themselves — the SDK uses `eventemitter3` for all internal eventing; DOM `Event`/`CustomEvent` are never constructed in React Native code paths
- **Required when using wagmi** — wagmi core dispatches DOM events internally
- Add only if your integration uses wagmi:

```typescript
class EventPolyfill { /* ... */ }
class CustomEventPolyfill extends EventPolyfill { detail: any; /* ... */ }
global.Event = EventPolyfill as any;
global.CustomEvent = CustomEventPolyfill as any;
```

## Metro extraNodeModules

- The MetaMask Connect SDK has transitive dependencies on Node.js built-in modules
- Metro cannot resolve them without explicit shims in `metro.config.js`
- **`stream`** must map to `readable-stream` (not `stream-browserify`) — it is the only built-in that needs a real implementation
- Map every other referenced built-in to an **empty stub module** (`module.exports = {};`) — they are referenced by transitive deps but never called at runtime in React Native (this matches the SDK's own react-native-playground):

```javascript
// metro.config.js
const path = require('path');
const emptyModule = path.resolve(__dirname, 'src', 'empty-module.js'); // module.exports = {};

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
}
```

- Only `readable-stream` needs to be installed — do not install `react-native-crypto`, `@tradle/react-native-http`, `https-browserify`, or `os-browserify`; they are obsolete for this SDK

## preferredOpenLink (Required)

- `mobile.preferredOpenLink` must be set in React Native for deeplinks to open MetaMask Mobile
- Pass: `(deeplink: string) => Linking.openURL(deeplink)`
- Without this, connection attempts via MWP will hang — no deeplink is triggered

## Async Storage for Persistence

- Browser localStorage is not available in React Native
- Use `@react-native-async-storage/async-storage` for session persistence
- With wagmi: use `createAsyncStoragePersister` from `@tanstack/query-async-storage-persister`
- Without wagmi: the MetaMask Connect SDK handles persistence internally when AsyncStorage is provided

---

## MetaMask Connect Testing Patterns

> Testing patterns for MetaMask Connect SDK — provider mocking, client mocking, singleton cleanup, and event testing

## Provider Mocking

- Mock the EIP-1193 provider's request method for unit tests
- Create a mock provider factory that returns controlled responses
- Example: `const mockProvider = { request: vi.fn(), on: vi.fn(), removeListener: vi.fn() }`
- Mock different responses for different methods (eth_accounts, eth_chainId, etc.)

## Client Mocking

- Mock createEVMClient to return a controlled client object
- Mock client.connect(), client.disconnect(), client.getProvider(), client.switchChain()
- For multichain: mock createMultichainClient, client.invokeMethod(), client.on()

## Singleton Cleanup

- createMultichainClient is a singleton — tests that create clients will share state
- Clear or reset the singleton between test runs
- Use beforeEach/afterEach to ensure clean state

## Test Networks

- Use Sepolia (0xaa36a7) for E2E tests, never mainnet
- For Solana E2E: use devnet — supported in the MetaMask browser extension (mobile supports mainnet only)
- Mock RPC responses for unit tests; use real RPCs only for integration tests

## Async Client Initialization

- createEVMClient and createMultichainClient are async — tests must await them
- In React testing, await the client before rendering components that depend on it
- Use act() wrapper for React state updates triggered by SDK events

## Error Simulation

- Test user rejection: throw { code: 4001, message: 'User rejected' }
- Test pending connection: throw { code: -32002, message: 'Already pending' }
- Test network errors: simulate RPC failures
- Test disconnect scenarios

## Event Testing

- Test that components react to accountsChanged, chainChanged events
- Simulate events by calling the mock provider's event handlers
- Test display_uri event handling for headless mode

## Solana Testing

- Mock wallet-standard wallet object
- Mock signMessage, signAndSendTransaction features
- Test wallet discovery with mocked wallet registry
