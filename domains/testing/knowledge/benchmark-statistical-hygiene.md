---
name: benchmark-statistical-hygiene
domain: testing
description: Three patterns for defensible A/B benchmark results: one primary analysis with per-round sensitivity, fix-vector isolation, and artifact sort-order trap.
---

# Benchmark Statistical Hygiene

Three patterns that prevent the most common classes of invalid benchmark conclusions.

## Pattern: One Primary Analysis, Per-Round Sensitivity

Later benchmark rounds accumulate system noise (background load, memory pressure, I/O contention). Pooling all rounds blindly treats noisy late-session data equally with clean early-session data.

**Instead:** Fix one primary analysis per metric before the runs, including any rule for dropping a round, such as a stability check that does not look at the treatment effect. Compute per-round statistics as sensitivity analyses and report them with explicit round attribution. They cannot change the verdict. Choosing the round with the cleanest signal after seeing the data is cherry-picking a favorable time range.

```
Round 1 (clean):    metric X → treatment wins,           p=0.04, d=-1.7
Round 2 (moderate): metric X → treatment wins,           p=0.08, d=-0.9
Round 3 (noisy):    metric X → not resolvable at this n, p=0.90, d=+0.04

Pooled (all):       metric X → not resolvable at this n, p=0.50, d=-0.2

Report, with pooled as the primary analysis and no round-drop rule fixed in advance:
  "X is not resolvable at this n (pooled p=0.50, d=-0.2).
   Sensitivity: Round 1 alone p=0.04, d=-1.7. Round 3 alone d=+0.04."
```

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
