---
name: mobile-perf-measure
description: >-
  Measure before/after latency and JS-frame metrics for any MetaMask Mobile
  screen, sheet, or interaction on a physical Android device, with alternating
  capture blocks and production trace sampling. Use to verify a performance
  fix, compare exact commits, or expose a pooled gain that fails per-block or
  tail-latency checks. Not a CPU-profile analyzer or an E2E test authoring guide.
maturity: experimental
---

# Paired Mobile performance measurement

Use a real device and the exact source states under comparison. Report measured
latency, frame gaps and spread; source inspection or unit tests do not prove a win.

## When to use

Compare an interaction before/after a change, including its cost on the screen
before or after it. Use `performance` for attribution and `performance-testing`
for permanent E2E tests. This kit coordinates blocks and analyzes captures; it
does not build an app or provide screen navigation and instrumentation.

## Workflow

1. Freeze the device, scenario, source refs, installed dependencies, build mode,
   production tracing configuration, warm-up, settle time and timed-open count.
   Use the same dev client and Metro settings in both states. Dev-bundle times
   are relative comparisons, not release-build timings. If lockfiles differ,
   state which shared dependency tree was used; do not call it an unmodified
   shipping-build comparison. Use an owned measurement checkout/device session.
2. Prepare a screen-specific capture adapter using the [adapter contract](references/capture-adapter.md).
   It checks out the requested source, applies identical diagnostic marks,
   restarts the app, verifies the served source and effective trace sampling,
   settles, performs one unrecorded warm-up, then captures the planned opens.
   The reference method used a physical Pixel 6, a dev bundle, 20 seconds of
   settling and production `tracesSampleRate=0.03`; match the application's
   actual production sampler, including custom sampler overrides. Keep device,
   fixture/account state, network, recorder and HUD settings equal across states.
3. Verify one capture before repeating: correct route/control, unobscured target,
   sampling readback, usable marks and a single chronological rAF sample chain.
   A shared fixture may change the action between blocks. Invalid setup is not
   a slow open. Freeze recipes, probes and driver scripts before the series;
   only planned state/condition switches occur between blocks.
4. Alternate baseline/candidate blocks with an app restart per block. Two blocks
   per state and five timed opens per block give n=10 per state per scenario.
   Keep each warm-up out of the timed files. Run as a tracked job and inspect
   every block's exit status. A failed block stops the driver and invalidates
   the comparison; retain it, fix the recorded setup cause and use a fresh output
   directory. Never discard a block because its numbers are unwelcome.

```bash
SKILL_DIR=.agents/skills/mms-mobile-perf-measure
BASE_SHA=$(git rev-parse 'origin/main^{commit}')
HEAD_SHA=$(git rev-parse 'HEAD^{commit}')
OUT=temp/mobile-perf/paired-01

# The executable adapter is prepared for this screen, not supplied by the kit.
python3 "$SKILL_DIR/scripts/paired-blocks.py" "$OUT" 5 2 \
  "baseline:$BASE_SHA" "candidate:$HEAD_SHA" ./capture-block.sh
python3 "$SKILL_DIR/scripts/report.py" "$OUT" baseline candidate \
  --scenario 'open=data/timed-*.json' --json "$OUT/metrics.json" > "$OUT/report.md"
```

Resolve `SKILL_DIR` to this skill's installed directory if the operator uses a
different skill root. The driver only invokes the adapter; it never resets a
checkout. Its manifest records **requested** refs, not proof of delivered code.

## Timing definitions

Use one monotonic JS clock for marks, rAF timestamps, spans and events. Start is
the `press` handler mark. End is `open-complete`: for a sheet, the later of slide
completion and content layout; for navigation, the declared ready/transition
boundary. These JS timings exclude delay before the handler and do not prove
native input-to-paint latency. rAF callback FPS is JS cadence, not compositor FPS.

| Metric | Definition |
| --- | --- |
| window ms | end minus press |
| fps | rAF callbacks inside the inclusive window divided by its seconds |
| next JS frame ms | press to the first subsequent JS rAF callback |
| >100 ms frames | whole JS frame gaps over 100 ms that overlap the window |
| longest frame | longest whole overlapping JS gap |
| blocked ms | sum of `max(0, gap - 50 ms)` over whole overlapping gaps |

Whole-gap metrics include the portions outside the window at its boundaries;
blocked ms can exceed open ms. This preserves the reference method. Do not mix
them with clipped-window or native jank metrics. Missing end/frame data fails
analysis rather than falling back to a fixed-duration window.

Use `--start-mark` / `--end-mark` for another declared interval. For separate
slide/layout marks, use `--end-mark 'slide-end,content-layout'`: both are required
and the later first occurrence ends the window. Analyze scenarios with different
completion contracts separately. Optional
`--layout-mark`, `--span 'label=actual span name'` and
`--event 'label=actual event key'` retain first layout, product spans and event
timing relative to the end. Event timing has no automatic better/worse direction.
Multiple variants use repeated `--scenario 'name=relative/timed-*.json'` options.

## Report and decide

- Keep raw captures, block/source/build/sampler metadata, n and p50/p75. The
  reporter uses median and linearly interpolated p75 over individual opens,
  and retains each block's median separately. Missing optional spans show their
  actual n; they never become zero.
- `better-separated` means **every** candidate block median beats **every**
  baseline block median, with FPS higher and durations/gaps lower. The reverse
  is `worse-separated`; overlap/ties are `not-separated`. This is a conservative
  drift check, not a significance test or confidence interval. A pooled gain
  without block separation stays inconclusive at this sample size.
- Report tail regressions even when p50 improves. Measure the adjacent screen
  and a declared post-navigation interval when work may have moved there.
  First response, content readiness and deferred work are separate quantities.
  Combined changes do not establish any individual fix's contribution.
- Keep traces and unattributed time separate from measured latency. A starved
  CPU sampler is missing evidence, not proof that no CPU work happened.
