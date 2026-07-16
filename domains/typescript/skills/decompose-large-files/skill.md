---
name: decompose-large-files
description: Decompose a large file into coherent, independently-mergeable modules to improve modularity, maintainability, reviewability, and code organization — and to unblock incremental TS migration. Extract by coherent subject/domain cluster; never fragment for its own sake.
maturity: experimental
---

# Decompose Large Files By Coherent Units

A file that has grown to thousands of lines is hard to review, hard to maintain, and — if it is still `.js` — hard to migrate to TypeScript in one pass. Decompose it by moving coherent subject/domain clusters into their own modules. The goal is **modularity, maintainability, reviewability, and code organization**; unblocking an incremental JS→TS migration is a direct benefit, because each extracted module becomes a small, independently-typable unit.

Reference application: `metamask-extension` #41735 (`MetamaskController` decomposition, 9,260 → ~3,500 lines).

## The decision that matters: what is a coherent unit?

Extraction is worth it only when the extracted piece is a **coherent unit that can move independently**. Apply this judgment _before_ proposing any module:

- **Coherent subject.** The cluster is about one thing — one domain, one lifecycle, one concern (phishing detection, metrics emission, badge rendering). A reader can state its responsibility in one sentence.
- **Independently mergeable.** It can be lifted behind a defined seam — injected dependencies, or a messenger action — without dragging half the file with it. Its coupling to shared state and to the composition root is small and nameable.
- **Not fragmentation.** Extraction for its own sake — splitting a cohesive routine across files, or pulling out a 20-line helper that only one caller uses and has no independent identity — makes the code _harder_ to follow, not easier. If pulling the piece out means the two halves must still change together, leave it inline. **Refactoring is a means to modularity, not an end; a change that raises the file count without raising coherence is a regression.**

Some code should **stay** in the original file: the thin **composition / bootstrap root** that wires the modules together. Extracting the wiring itself fragments rather than clarifies — it is the one place the whole is assembled. The tell is code that references _everything_ (the central object plus the shared mutable state every cluster reads); relocating it behind a wide "params bag" just moves the tangle.

## How to extract one unit (self-contained, per #41735)

Each extraction is one self-contained change — no separate "final deletion" or "integration" ticket:

1. **Scaffold** the module (its own file/dir, TypeScript from the start).
2. **Port** the bodies in, unchanged in behavior.
3. **Define the seam** — inject the dependencies the module needs (or register its public methods as messenger actions) instead of reaching back into the file's globals. This is where the human judgment is.
4. **Rewire** the call sites to go through the seam.
5. **Delete the original** in the same change; leave no forwarding stub.
6. **Add a structural unit test** against a stub/mock of the seam — especially valuable when the original file had no tests.

Steps 1, 2, 5, 6 are largely mechanical (codemod territory — `jscodeshift` on the source, `ts-morph` on the module). Step 3/4 is the part that needs a person.

## Sizing and sequencing

- **Size each unit S / M / L / XL** by body size × coupling to rewire. Ship one module (or one subject area) per PR — reviewer context window is usually the binding constraint, so a focused S/M PR merges where an XL one stalls.
- **Sequence lowest-coupling-first.** Extract the clusters with the smallest, cleanest seam first: they establish the pattern and shrink the file so later, more-entangled extractions are easier to see. Save the most coupled cluster (often the core lifecycle) for last, or leave it as the composition root.
- **Enforce the new boundary** so the file cannot silently re-absorb the module — an ESLint `import/no-restricted-paths` rule on the module directory (per #41735).

## When NOT to decompose

- The file is large but **already cohesive** — one subject, read top to bottom. Size alone is not a reason.
- The only available splits are **arbitrary** (by line count, or a catch-all `utils`) rather than by subject. That produces fragments, not modules.
- The extraction **cannot get a clean seam** — everything it touches is shared mutable state with the rest of the file. Fix the coupling first, or leave it inline and say so.
