# Wallet Fixture Format

Fixtures are for local MetaMask Mobile and Extension debug runs only. Keep them in a gitignored path such as `.agent/wallet-fixture.json` or `temp/runtime/wallet-fixture.json` and use throwaway test wallets.

## Schema

```json
{
  "password": "throwaway-password",
  "accounts": [
    {
      "type": "mnemonic",
      "value": "test test test test test test test test test test test junk",
      "name": "Primary"
    },
    {
      "type": "privateKey",
      "value": "0xabc123...",
      "name": "Trading"
    },
    {
      "type": "privateKey",
      "value": "0xdef456...",
      "name": "MYXTrading"
    }
  ],
  "settings": {
    "metametrics": true,
    "skipGtmModals": true,
    "skipPerpsTutorial": true,
    "autoLockNever": true,
    "deviceAuthEnabled": true
  }
}
```

## Fields

| Field | Required | Meaning |
|---|---:|---|
| `password` | yes | Debug wallet password used for setup/unlock. |
| `accounts[]` | yes | Accounts to seed. Include at least one throwaway mnemonic for first vault setup. |
| `accounts[].type` | yes | `mnemonic` or `privateKey`. |
| `accounts[].value` | yes | SRP words or `0x` private key. Use throwaway values only. |
| `accounts[].name` | no | Human-readable label for imported accounts when supported. |
| `settings.metametrics` | no | Disable/enable metrics opt-in for debug setup; shared-fixture-compatible fixtures opt in to match prepared slot state. |
| `settings.skipGtmModals` | no | Skip growth/marketing modals where supported. |
| `settings.skipPerpsTutorial` | no | Skip Perps tutorial where supported. |
| `settings.autoLockNever` | no | Keep debug wallet unlocked where supported. |
| `settings.deviceAuthEnabled` | no | Enable device-auth-backed auto-unlock where supported; the Mobile harness only applies this on Android. |

## Security Rules

- Never use production SRPs, private keys, accounts, or funds.
- Never commit fixture files or raw secret material.
- Redact raw `password`, `mnemonic`, and `privateKey` values from command transcripts and PR bodies.
- Fixture seeding is setup/reset only. It is not a valid way to fabricate a mid-test state or bypass the user flow under validation.
- Existing mobile template: `scripts/perps/agentic/wallet-fixture.example.json` in MetaMask Mobile.

## Extension Parity

Mobile fixture shape is canonical for both platforms; Extension derives address/vault/persisted state from it.
