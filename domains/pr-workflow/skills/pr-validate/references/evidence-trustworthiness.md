# Evidence trustworthiness (anti-reward-hacking)

A green result is not proof. An agent — or an eager run — can produce evidence that *looks* like it validates the claim but doesn't. Before believing or publishing any lane, run it through this gate. The Claim Card's **Falsifier** is the anchor: trustworthy evidence is evidence that *could* have shown the falsifier and didn't.

The gate is conjunctive — a fix for one item must re-pass all the others. Items 1–6 govern whether the evidence is real; items 7–16 govern whether a reader can trust and audit it.

## The gate (per lane, before publish)

1. **Non-empty & expected media** — the run produced artifacts of the expected kind. A "pass" with zero artifacts (a skipped or errored step) is not a pass.
2. **Shows the claimed surface** — the screenshot/recording is the Claim Card surface in the asserted state — not a loading spinner, an error toast, the wrong screen, or a pre-action frame. Eyeball it.
3. **Exercises the changed code** — the test/flow actually hits the diff. For a test: it **fails on `main`**. For a flow: the changed component/route is on the path. A green test that never imports the changed module proves nothing.
4. **Signal exceeds noise** — a perf delta is beyond run-to-run variance (paired A/B, multiple iterations). A 3% move on a noisy metric is not evidence.
5. **Could have failed** — the assertion has a reachable failure mode. Always-true assertions (`expect(true)`, a screenshot with no assertion, a query with no time bound) can't falsify anything.
6. **Right baseline** — "before" is the actual base ref / prior version / pre-window, not a stale or mismatched comparison.
7. **Independent & honestly labeled** — checksum every capture set. Byte-identical files across supposedly independent runs can't stand as separate observations: explain the identity (deterministic rendering, with provenance that does differ) or re-capture. Labels describe the observation, not the interpretation the claim hopes for.
8. **Findings ship with artifacts** — a findings write-up carries functional links to the re-hosted artifacts at draft time, not descriptions of files that exist only on the capturing machine. Code permalinks and a repro recipe corroborate the observation; they don't substitute for it.
9. **Signal is surfaced** — evidence is judged at the reader's eyes, not the author's disk. Every exhibit leads with what to open, where to look, and what it should show; a reader who didn't run the session should confirm the claim in ~30 seconds. Deltas are presented *as* deltas (annotated side-by-side, diff, cropped to the differing region), and bulk artifacts are excerpted to the discriminating lines with the full file linked as appendix. The converse also holds: never omit a valid, relevant dimension because it duplicates another's signal — exclusion requires invalidity or irrelevance, stated in one line.
10. **Sibling exhibits are format-uniform** — parallel rows, scenarios, or A/B legs carry the same evidence format and quality. The bar is the best sibling: if the presentation improves mid-session, re-normalize the whole document before publishing. An unexplained format gap reads as an evidence gap.
11. **Lanes derive from the claim, not from existing links** — validation rows are generated from the claim and the PR's Manual testing steps, and each row's payload is the captured output of executing that step. A row restating CI status duplicates the Checks tab and is deleted; a validation surface carries no CI references. Borrowed evidence (a sibling PR's capture, a unit test standing in for a named live surface) never upgrades an uncaptured lane to proven.
12. **Identifiers resolve in one click** — a bare trace/event/run id is a digging assignment, not evidence. Hyperlink each id to its resolving surface (a permalink, or a query pre-filtered to exactly those ids over an absolute window) or include the re-hosted captured output showing the discriminating fields. Ids captured locally that never reached the backend have no permalink — the capture is the only admissible form.
13. **Terminal exhibits are reader-native** — a positive verdict rests on a live link into the resolving system or a visual capture. Raw dumps (`.log`/`.json`/`.har`) are appendix-only: a link whose target is a dump moved the digging one hop away, it didn't remove it.
14. **The audit chain is mechanical** — inline data is a verbatim, greppable excerpt of its artifact (full-length identifiers, exact capture lines, fenced), and every repo-hosted artifact link is commit-pinned and line-anchored (`/blob/<sha>/…#Lx-Ly`). Hand-transcribed digests read as claims in the shape of data; branch-ref links are mutable and not tamper-evident; unanchored file links land the reader at the top of a dump.
15. **Evidence is captured in its environment** — correct data alone cannot show it was captured live from a functioning system; extracted data is indistinguishable from data typed by hand. For a claim observable in a system of record (telemetry dashboards), the exhibit includes an in-environment capture: the resolving UI with the query, scope selectors, absolute time window, and result rows in frame, beside the live permalink. Quoted excerpts and data files sit in the appendix, never as the exhibit.
16. **"Proven" is an evidence predicate, not a run status** — success vocabulary (proven, validated, successful) applies only when the published surface already carries the exhibits this gate requires. A completed run without them is run-complete, evidence-owed. For telemetry-observable claims the default exhibit pair is fixed in advance — in-environment screenshot plus live permalink — and the capture executes before any write-up closes the session.

## Lane-specific traps

- **Visual:** spinner/skeleton mistaken for the loaded state; the toggle (privacy/redaction) not actually flipped; a cached screenshot from a prior run; a fallback surface shown without saying so.
- **Perf / benchmark:** a frozen/stale baseline (verify it's current; prefer paired A/B); single sample; warm-vs-cold mismatch; measuring a different interaction than the claim.
- **Test:** a snapshot regenerated to match the bug (`--updateSnapshot` masking a regression); the test mocks out the changed path; it passes on `main` too (so it isn't a regression test).
- **Telemetry:** query window excludes the release; the error regrouped under a different fingerprint; sample-rate makes "0 events" meaningless.
- **Migration:** only the happy path asserted; `changedKeys` not checked against actual mutations; no real prior-version fixture.
- **Coverage:** a line covered ≠ a behavior asserted (executed but never checked).

## When evidence fails the gate

Don't publish it. Either re-capture correctly, **downgrade the verdict to inconclusive** and name what's missing, or — if the evidence shows the claim is false — report the refutation (the validation succeeded; the change didn't). Never round a weak pass up to "proven."
