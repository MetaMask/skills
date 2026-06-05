---
name: web-vitals-attribution-import
domain: performance
description: web-vitals/attribution is a module import path, not a separate package — no meaningful bundle cost, gives the symptom→cause link
---

# Web Vitals Attribution Import

`web-vitals/attribution` is a **module import path**, not a separate package. The attribution build:
- Provides which script/element caused each metric
- Does **not** meaningfully increase production bundle size (tree-shaking applies)

Don't skip it for "bundle size" reasons — that's a misread.

## Why it matters
Attribution is the symptom→cause link:
- INP spike of 500ms
- Attribution: `eventTarget: '#confirm-swap-button'`, `eventType: 'click'`
- Combined with tracing → identifies the controller that blocked
