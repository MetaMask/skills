---
domain: observability
title: Error reporting paths
---

# Error Reporting Paths

What reaches Sentry when something throws, and what a `catch` does to that.

Read at `metamask-extension` [`a5fc11920`](https://github.com/MetaMask/metamask-extension/commit/a5fc11920).

## An uncaught throw already reports

`Sentry.init` in [`app/scripts/lib/setupSentry.ts`](https://github.com/MetaMask/metamask-extension/blob/a5fc11920/app/scripts/lib/setupSentry.ts#L199) passes an `integrations` array and never sets `defaultIntegrations: false`. A grep for `defaultIntegrations` across `app/` and `shared/` returns nothing, so the browser SDK merges its own defaults alongside the listed ones.

That default list includes `globalHandlersIntegration()`, which hooks `onerror` and `onunhandledrejection`. So an uncaught throw and an unhandled rejection both produce a Sentry event with no code at the throw site doing anything.

## Therefore the two states are reported and silent

Adding `.catch(console.debug)` to a path that previously threw does not degrade a feature gracefully. It deletes the only report. The pair is not crash versus degrade, it is reported versus silent, and the second state has no signal anywhere.

The shape that keeps both is a catch that reports:

```ts
import { captureException } from '../../../shared/lib/sentry';

somethingAsync().catch((error) => {
  captureException(error);
});
```

`captureException` is exported at [`shared/lib/sentry.ts:18`](https://github.com/MetaMask/metamask-extension/blob/a5fc11920/shared/lib/sentry.ts#L18) and is already the house value-import at `background.js`, `metamask-controller.js`, `offscreen.ts` and the migrations.

## A reported-but-swallowed path is still quiet

Reporting is not the same as being noticed. A change inside `try { … } catch { captureException(e); return; }` degrades a feature without crashing: nothing goes red, no test fails, and the only signal is an error-tracker entry nobody is watching. The same edit in a hot path is caught in minutes.

Weight findings by observability rather than by likelihood alone. **An unlikely failure in a swallowed path can outrank a likely one in a loud path.**

## Not established

Whether the MV3 service worker's global scope hooks these handlers the way the window scope does. `globalHandlersIntegration` is written against `window` events, and the worker has no `window`. Settling it needs a runtime check in the worker context rather than a reading of the SDK source, and until then the reported-versus-silent claim above is verified for page contexts only.

## Related

- `typescript` domain `skills/tsc-blindspots/skill.md`, "Silent failure modes deserve their own pass" — the same weighting applied to reviewing a diff.
