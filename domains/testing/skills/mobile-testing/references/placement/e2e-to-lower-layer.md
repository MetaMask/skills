# E2E → lower layer sub-pass

Run whenever you write or fix tests for a feature, and as a placement sub-pass. Existing Appium specs in the touched feature that fail the E2E gate in installed `knowledge/testing-layers.md` (source [`../../../../knowledge/testing-layers.md`](../../../../knowledge/testing-layers.md)) move down in the **same change**. Do not ask the engineer; record decisions on the PR checklist.

**Scope:** Appium scenarios whose screen, testID, page object, or flow belongs to the files already in scope for the task. Do not sweep unrelated specs.

## Reason → layer

| If the E2E scenario's reason is… | Target | Action |
| --- | --- | --- |
| Concrete device/native boundary (OS permission or system dialog, app lifecycle, real deep-link dispatch, packaging/native wiring, device-only gesture/runtime) | **Appium** | **KEEP** |
| Screen visibility, presses, navigation (including registerable multi-screen), Redux/stream/HTTP-mock driven UI | **CV** (`*.view.test.tsx`) | **MIGRATE** then delete the E2E case |
| Only an app↔controller seam remains | **Integration** (`*.integration.test.ts`) | **MIGRATE** then delete the E2E case |
| Mixed: device boundary plus UI/state assertions | Both | **SPLIT** — keep the device assertions in Appium, move the rest |
| Boundary unclear | **Appium** | **KEEP** + one-line reason on the PR checklist |

“User journey”, “smoke coverage”, “important feature”, and “multiple screens” are **not** device boundaries.

**KEEP** when either holds, even if each step looks CV-able:

- The outcome needs a real Engine controller to do work CV would stub (create or import a wallet, sign, an auth round-trip), or a native module CV cannot stub. A header comment such as “Device smoke: …” names that intent. State that only toggles Redux or controller state CV can seed does not count.
- No single CV or integration test can drive the whole scenario. Spreading its asserts across existing mocked unit tests is not a migration.

## Steps

1. Inventory: `rg -l "ScreenName|testIdName|PageObjectName" tests/smoke-appium/` for the screens, testIDs, and page objects of the touched files (see [`inventory.md`](inventory.md)). One row per `appiumTest(`: spec, title, screens/testIDs, device boundary yes/no.
2. Classify each row with the table above.
3. **Assert parity before delete** — every E2E assertion (visible/not visible, text, navigation destination, list membership) has an equivalent `expect` in the new CV or integration target test — not in some other existing test. A system dialog, relaunch, or permission the target cannot observe blocks deletion of that part (**SPLIT**).
4. Apply when writing or fixing tests, or in placement IMPLEMENT: add the target test first → run it → delete the migrated `appiumTest(` (the whole spec when empty). Keep page objects, flows, and helpers still imported by another spec. Placement ANALYZE only lists the rows.
5. Record metrics: Appium `appiumTest(` before/after, target tests added, residual KEEP rows with reasons.
