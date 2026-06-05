---
repo: metamask-mobile
parent: simulator-control
---

# Simulator Control — MetaMask Mobile

`agent-device` is installed as a local dependency. All device commands run via `yarn agent-device <command>` in the shell.

## Step 1 — Version Check

```bash
yarn agent-device --version
```

Require `version >= 0.14.0`. If the version is lower, ask the user to bump the `agent-device` dependency in `package.json`.

## Step 2 — Prerequisites

Before any agent-device command:

1. Confirm Metro is running by checking the terminals folder for an active `yarn watch:clean` process. Do NOT start Metro yourself — if it is not running, stop and ask the user to run `yarn watch:clean` in a separate terminal, then wait for confirmation.
2. Confirm a simulator is booted:
   ```bash
   yarn agent-device devices --platform ios
   ```
   If none are booted, ask the user to boot one via Xcode Simulator, then wait for confirmation.

## App Identifiers

| Platform | App identifier              |
|----------|-----------------------------|
| iOS      | `io.metamask.MetaMask`      |
| Android  | `io.metamask`               |

```bash
yarn agent-device open io.metamask.MetaMask --platform ios
yarn agent-device open io.metamask --platform android
```

## Core Loop

```bash
yarn agent-device devices --platform ios
yarn agent-device open io.metamask.MetaMask --platform ios --device "iPhone 17"
yarn agent-device snapshot -i
yarn agent-device screenshot
```

Run `yarn agent-device --help` for the full list of interaction, validation, and evidence commands.

## Deep Link Navigation

To navigate directly to a screen, use the `metamask://` URL scheme instead of tapping through the UI:

```bash
yarn agent-device open "metamask://<route>" --platform ios
yarn agent-device open "metamask://<route>" --platform android
```

Check `app/core/AppConstants.js` and deeplink handler files for available routes.
