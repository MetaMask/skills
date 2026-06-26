# Evidence trustworthiness (anti-reward-hacking)

A green result is not proof. An agent — or an eager run — can produce evidence that *looks* like it validates the claim but doesn't. Before believing or publishing any lane, run it through this gate. The Claim Card's **Falsifier** is the anchor: trustworthy evidence is evidence that *could* have shown the falsifier and didn't.

## The gate (per lane, before publish)

1. **Non-empty & expected media** — the run produced artifacts of the expected kind. A "pass" with zero artifacts (a skipped or errored step) is not a pass.
2. **Shows the claimed surface** — the screenshot/recording is the Claim Card surface in the asserted state — not a loading spinner, an error toast, the wrong screen, or a pre-action frame. Eyeball it.
3. **Exercises the changed code** — the test/flow actually hits the diff. For a test: it **fails on `main`**. For a flow: the changed component/route is on the path. A green test that never imports the changed module proves nothing.
4. **Signal exceeds noise** — a perf delta is beyond run-to-run variance (paired A/B, multiple iterations). A 3% move on a noisy metric is not evidence.
5. **Could have failed** — the assertion has a reachable failure mode. Always-true assertions (`expect(true)`, a screenshot with no assertion, a query with no time bound) can't falsify anything.
6. **Right baseline** — "before" is the actual base ref / prior version / pre-window, not a stale or mismatched comparison.

## Lane-specific traps

- **Visual:** spinner/skeleton mistaken for the loaded state; the toggle (privacy/redaction) not actually flipped; a cached screenshot from a prior run; a fallback surface shown without saying so.
- **Perf / benchmark:** a frozen/stale baseline (verify it's current; prefer paired A/B); single sample; warm-vs-cold mismatch; measuring a different interaction than the claim.
- **Test:** a snapshot regenerated to match the bug (`--updateSnapshot` masking a regression); the test mocks out the changed path; it passes on `main` too (so it isn't a regression test).
- **Telemetry:** query window excludes the release; the error regrouped under a different fingerprint; sample-rate makes "0 events" meaningless.
- **Migration:** only the happy path asserted; `changedKeys` not checked against actual mutations; no real prior-version fixture.
- **Coverage:** a line covered ≠ a behavior asserted (executed but never checked).

## When evidence fails the gate

Don't publish it. Either re-capture correctly, **downgrade the verdict to inconclusive** and name what's missing, or — if the evidence shows the claim is false — report the refutation (the validation succeeded; the change didn't). Never round a weak pass up to "proven."
