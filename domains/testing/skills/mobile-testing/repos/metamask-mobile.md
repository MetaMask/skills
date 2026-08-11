---
repo: metamask-mobile
parent: mobile-testing
---

# MetaMask Mobile

This skill installs only for **metamask-mobile**.

Follow the router in the skill body. Layer policy:
[`references/layers.md`](../references/layers.md) and installed
`knowledge/testing-layers.md`.

When writing Appium or Detox-migration code, treat the live repo as source of
truth:

- Appium smoke: `tests/smoke-appium/`, `docs/testing/appium-smoke-testing.md`
- Unified POM: `tests/docs/UNIFIED_E2E_ARCHITECTURE.md`, `docs/testing/e2e-testing.md`
- CV: `tests/component-view/`
- Integration: `tests/integration/AGENTS.md`

### Running Appium smoke locally (agents)

When asked to **run**, **validate**, or **debug** Appium E2E:

1. Open [`../references/running-appium-locally.md`](../references/running-appium-locally.md)
   and follow the agent execution order.
2. For commands, artifact names, Android ABI / arm64 APK, and troubleshooting,
   open `docs/testing/appium-smoke-testing.md` in this repo — that doc is the
   source of truth (do not re-copy it into the skill).

Quick rules: **main-e2e** release only; set `IOS_APP_PATH`; prefer iOS on Mac;
warn before local native builds.
