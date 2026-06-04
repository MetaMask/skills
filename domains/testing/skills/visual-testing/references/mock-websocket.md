# Mock WebSocket Connections

Use `mm mock-websocket` to intercept and stub WebSocket connections during an active session. Useful for testing flows that depend on real-time WebSocket data (e.g. price feeds, order-book subscriptions, clearinghouse state).

## Contents

- [Modes](#modes)
- [Mock Definition Shape](#mock-definition-shape)
- [Rule Shape](#rule-shape)
- [Examples](#examples)
- [Verification Pattern](#verification-pattern)
- [In mm run-steps](#in-mm-run-steps)

## Modes

Two interception modes per mock:

| Mode | `passthrough` | Behavior |
| --- | --- | --- |
| **Full mock** | `false` (default) | No real server connection. Only matching rules produce responses; unmatched messages are silently dropped. |
| **Passthrough** | `true` | Connects to the real server. Matching messages trigger canned responses; unmatched messages are forwarded to/from the server. |

Mock rules are installed on the active Playwright browser context:

- Run `mm launch` first.
- Add mocks **before** the UI action that opens the WebSocket.
- `mm cleanup` removes all mocks; `mm mock-websocket clear` removes mocks and message history without ending the session.
- Replacing a mock for the same URL closes active connections for that URL so new connections pick up the updated rules.

## Mock Definition Shape

```json
{
  "url": "wss://api.hyperliquid.xyz/ws",
  "rules": [{ "id": "...", "match": { "includes": "..." }, "respond": { ... } }],
  "passthrough": false
}
```

| Field | Description |
| --- | --- |
| `url` | Exact WebSocket URL to intercept. |
| `rules` | Array of message-matching rules (see below). |
| `passthrough` | Optional. `true` to connect to the real server and only intercept matching messages. Default `false`. |

## Rule Shape

```json
{
  "id": "clearinghouse-state",
  "match": { "includes": "clearinghouseState" },
  "respond": { "channel": "subscriptionResponse", "data": { "balances": [] } },
  "delay": 0,
  "followUpResponse": { "channel": "update", "data": { "fills": [] } },
  "followUpDelay": 500
}
```

| Field | Description |
| --- | --- |
| `id` | Stable identifier for the rule. Appears in message records. |
| `match.includes` | String or array of strings. All must appear in the incoming message for the rule to match. |
| `respond` | Optional. Canned response sent back to the client. Objects are JSON-serialized. |
| `delay` | Optional. Milliseconds to wait before sending `respond`. Default `0`. |
| `followUpResponse` | Optional. A second response sent after the initial one. Objects are JSON-serialized. |
| `followUpDelay` | Optional. Additional milliseconds after `delay` before sending the follow-up. Default `0`. |

Matching is first-match: the first rule whose `match.includes` is satisfied wins.

## Examples

```bash
# Single mock — full mock mode (no real connection)
mm mock-websocket add '{"url":"wss://api.hyperliquid.xyz/ws","rules":[{"id":"clearinghouse","match":{"includes":"clearinghouseState"},"respond":{"channel":"subscriptionResponse","data":{"balances":[]}}}]}'

# Single mock — passthrough mode (intercept specific messages, forward the rest)
mm mock-websocket add '{"url":"wss://api.hyperliquid.xyz/ws","rules":[{"id":"clearinghouse","match":{"includes":"clearinghouseState"},"respond":{"channel":"subscriptionResponse","data":{"balances":[]}}}],"passthrough":true}'

# Multiple mocks at once
mm mock-websocket add '{"mocks":[
  {"url":"wss://api.hyperliquid.xyz/ws","rules":[{"id":"clearinghouse","match":{"includes":"clearinghouseState"},"respond":{"channel":"subscriptionResponse","data":{"balances":[]}}}]},
  {"url":"wss://stream.other.io/ws","rules":[{"id":"prices","match":{"includes":"subscribe"},"respond":{"type":"snapshot","prices":{}}}]}
]}'

# Delayed response
mm mock-websocket add '{"url":"wss://api.example.com/ws","rules":[{"id":"delayed","match":{"includes":"query"},"respond":{"result":"ok"},"delay":1000}]}'

# Response with follow-up (simulates initial snapshot then update)
mm mock-websocket add '{"url":"wss://api.example.com/ws","rules":[{"id":"snapshot-then-update","match":{"includes":"subscribe"},"respond":{"type":"snapshot","data":[]},"followUpResponse":{"type":"update","data":{"new":true}},"followUpDelay":500}]}'

# Inspect and manage
mm mock-websocket list
mm mock-websocket messages --limit 20
mm mock-websocket clear
```

## Verification Pattern

1. Add the mock with `mm mock-websocket add ...`
2. Trigger the UI flow that opens the WebSocket connection
3. Run `mm mock-websocket messages --limit 20`
4. Confirm the expected message has `matched: true` and the expected `ruleId`
5. Check `summary.hits` / `summary.misses` for overall coverage

## In mm run-steps

Use tool name `mock_websocket` with the same input shape:

```bash
mm run-steps '{"steps":[
  {"tool":"mock_websocket","args":{"action":"add","mock":{"url":"wss://api.hyperliquid.xyz/ws","rules":[{"id":"clearinghouse","match":{"includes":"clearinghouseState"},"respond":{"channel":"subscriptionResponse","data":{"balances":[]}}}]}}},
  {"tool":"navigate","args":{"screen":"url","url":"https://test-dapp.io"}}
]}'
```
