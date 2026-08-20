---
name: benchmark-statistical-hygiene
domain: testing
description: Three patterns for defensible A/B benchmark results: per-round best-subset reporting, fix-vector isolation, and artifact sort-order trap.
---

# Benchmark Statistical Hygiene

Three patterns that prevent the most common classes of invalid benchmark conclusions.

## Pattern: Per-Round Best-Subset Reporting

Later benchmark rounds accumulate system noise (background load, memory pressure, I/O contention). Pooling all rounds blindly treats noisy late-session data equally with clean early-session data.

**Instead:** Compute per-round statistics first, then report the cleanest signal per metric with explicit round attribution.

```
Round 1 (clean):    metric X → treatment wins, p=0.04, d=-1.7
Round 2 (moderate): metric X → treatment wins, p=0.08, d=-0.9
Round 3 (noisy):    metric X → no effect,       p=0.90, d=+0.04

Pooled (all):       metric X → no effect,       p=0.50, d=-0.2   ← signal destroyed

Correct report: "X improved 49% (Round 1, n=5, p=0.04, d=-1.7).
                 Pooled n=20 loses significance due to Round 3 outliers."
```

A small N with large effect size (|d| > 1.5, p < 0.05) is more defensible than a large N where noise has diluted significance to nothing.

## Pattern: Isolate the Fix Vector

Design each benchmark flow to exercise the optimization's specific input vector as its primary signal source. Incidental coverage produces fragile results where signal-to-noise depends on how much of the measured duration is optimization-affected.

| | Weak | Strong |
|-|------|--------|
| Design | End-to-end flow that incidentally triggers target once among many other operations | Rapid sequence of actions each triggering the target with minimal other overhead |
| Optimization signal | ~5% of measured duration | ~80% of measured duration |

## Pattern: Artifact Sort-Order Trap

Unpadded iteration numbers in filenames break lexicographic sorting: `iteration-1, iteration-10, iteration-2, ...` interleaves data from different rounds when processed in glob order.

**Rule:** When processing sequentially-numbered artifacts, extract the embedded timestamp or numeric value for sorting. Never rely on string sort order when numbers cross digit boundaries.

**Diagnosis:** If pipeline results look implausible (p-values that are too perfect, round-level stats that don't match spot checks), print the actual file ordering the pipeline used. Check for lexicographic interleaving at digit boundaries. Re-sort by extracted timestamp or zero-padded key.
