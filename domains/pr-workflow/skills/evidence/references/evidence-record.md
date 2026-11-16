# The run record

The private record of an evidence run is machine-facing: later runs, re-runs at a new head, and anything that counts lanes or verdicts across runs read it. Every field below takes a value from a closed set, so two runs that did the same thing write the same strings. This file is the only definition of those sets; the PR-body section and any `/pr-comment` drafted from the record translate them (see [Publishing](#publishing)) and never invent their own.

## Ids

### Lane ids

A lane id is the bare catalog token, exactly as the catalog heads it, and nothing else:

| Family | Ids | Defined in |
|---|---|---|
| A to G | `A1`–`A3`, `B1`–`B7`, `C1`–`C9`, `D1`–`D7`, `E1`–`E3`, `F1`–`F8`, `G1`–`G6` | [evidence-catalog.md](evidence-catalog.md) |
| H (mobile only) | `H1`–`H13` | [repos/metamask-mobile.md](../repos/metamask-mobile.md) |

- **One token per field.** What the lane looked at goes in its own `subject` field: `lane: B3`, `subject: compare radio`, never `B3/compare radio`, `B3 compare radio` or `b3`.
- **One lane per row.** A row that ran two lanes is two rows. A lane with separately run halves (a mobile lane's JS half and device half) takes one row per half, the half named in `subject`.
- **A check that matches no catalog lane** takes `lane: unlisted` and names the check in `subject`. An `unlisted` row that recurs is a catalog gap: add the lane to the catalog.
- **`G1` and `G2` are not lanes** (the catalog says so) and never take a ledger row. The `G1` mutation check is recorded as the skip reason `closed-by-ci` on the lane it closes.

### Claim and finding ids

- **Claims:** `claim-1`, `claim-2`, … one per Claim Card, in the order the cards are written.
- **Findings:** `finding-1`, `finding-2`, … one record-wide sequence across all claims, in order of first observation. A finding is anything the run puts in front of a reviewer: a falsifier that fired, a concern with its falsifier named, drift between the PR body and the diff, a residue no lane reached.
- **Stable across runs on one PR.** A re-run at a new head keeps the id of every claim and finding it observes again, gives a new one the next unused number, and marks one no longer present `retired`. An id is never renumbered or reused, so `finding-3` means the same thing in every run of the record.
- The `claim-` and `finding-` prefixes keep these out of the lane-id namespace: `C1` is a lane, never a claim.

## Input ledger

One row per input, before any lane runs. Each row is `available`, `unavailable` or `failed`, plus the command or tool that established it. `unavailable` means the input does not exist or cannot be reached from here; `failed` means it exists and the attempt to read or build it errored.

| Input | What it covers |
|---|---|
| `pr-body` | title, description, manual testing steps |
| `linked-issue` | the issue the PR addresses |
| `diff` | the PR diff at the frozen head |
| `base-build` | a runnable build at the base SHA |
| `head-build` | a runnable build at the head SHA |
| `aep-stack` | the local AEP harness |
| `device` | a simulator, emulator or device-farm session (mobile lanes) |
| `error-tracker` | query access to the error tracker |
| `trace-backend` | query access to the trace backend |
| `ci-runs` | the PR's workflow runs and logs |
| `test-fork` | a fork where a changed workflow's trigger conditions hold (`G5`) |

Record base and head as full SHAs from command output, never `HEAD`. A lane that needs an input this table does not list is a defect in this table: add the row here.

## Lane ledger

One row for every lane the claim type calls for, and one for every other lane started. A lane the claim calls for is never absent from the ledger.

| Field | Values |
|---|---|
| `lane` | a lane id |
| `claim` | the claim id it tests |
| `lead` | `true` for the lane whose output is the claim (see *Synthesising a run from several runners* in [skill.md](../skill.md)) |
| `status` | `ran` · `skipped` · `failed` |
| `reason` | `skipped` only, from the closed list below |
| `input` | the input id, when `reason` is `input-unavailable` |
| `artifact` | `ran` only: the link, file or run id the result rests on |
| `exit` | the runner's exit code, when a runner produced the result |

**Statuses.**

- **`ran`**: the lane produced a result a reader can inspect. Runner exits `0`, `1` and `2` are all `ran`; what the result means for the claim goes in the claim status, not here.
- **`skipped`**: the lane was not started, for one of the five reasons below.
- **`failed`**: the lane was started and produced nothing usable. The runner crashed or exited `3`, the bundle's `artifactRefs` came back empty, or the artifact failed the [trustworthiness gate](evidence-trustworthiness.md) (name the gate item).

**Skip reasons, closed:**

| Reason | When |
|---|---|
| `not-applicable` | The claim has no surface this lane observes (a background change has nothing for a visual lane to capture). Never valid on a lead lane. |
| `closed-by-ci` | The `G1` mutation check: the PR's committed test fails when the mechanism is mutated, so CI already closes this lane's falsifier. On a high-stakes surface it closes only the falsifier the author intended (catalog `G1`). |
| `gated` | An earlier lane's result makes this one unreadable: a correctness lane failed, so a performance number over the changed behavior is not a result. Name the gating lane. |
| `input-unavailable` | An input the lane needs is `unavailable` or `failed` in the input ledger. Name it in `input`. |
| `declined` | The person running the skill said not to run it. |

Cost and time are not skip reasons. A lane that costs more than expected is started; if it cannot finish, it is `failed` with what stopped it.

## Claim status

Each claim takes exactly one status, and the status describes the **claim**, never its falsifier. A falsifier that was looked for and did not fire means the claim `held`. Writing `refuted` there, because the falsifier was refuted, is the inversion this field exists to prevent.

| Status | Meaning | Derived from the ledger |
|---|---|---|
| `held` | The falsifier was looked for and did not fire. | The lead lane `ran` (or is `closed-by-ci`), every lane that `ran` is free of the falsifier, and none exited `2`. |
| `refuted` | Evidence shows the claim is false. | A lane that `ran` and passed the trustworthiness gate shows the falsifier. This holds even when the lead lane did not run: one trustworthy counterexample refutes. |
| `inconclusive` | The run tried and could not tell. | Neither of the above, and at least one lane `ran`, `failed`, or was `skipped` as `gated` or `input-unavailable`. |
| `not-run` | The run did not attempt this claim. | The claim has no lane rows, or every row is `skipped` as `declined` or `not-applicable`. |

A required lead lane left unrun caps the claim at `inconclusive`, however many secondary lanes ran: secondary lanes that passed are recorded under it, never in its place. A lead lane skipped for a missing input (a mobile lane with no `device`) is `inconclusive`, not `not-run`, because the run attempted the claim.

The run's verdict: `refuted` if any claim is refuted; otherwise `held` only if every claim held; otherwise `inconclusive`, unless every claim is `not-run`.

## Shape

```json
{
  "pr": "<owner>/<repo>#<n>",
  "base": "<40-character SHA>",
  "head": "<40-character SHA>",
  "date": "<YYYY-MM-DD>",
  "inputs": [{ "input": "device", "status": "unavailable", "via": "xcrun simctl list" }],
  "claims": [{ "id": "claim-1", "text": "Given …, when …, then …", "falsifier": "…", "status": "inconclusive" }],
  "lanes": [
    { "lane": "H13", "claim": "claim-1", "lead": true, "status": "skipped", "reason": "input-unavailable", "input": "device" },
    { "lane": "B3", "claim": "claim-1", "lead": false, "status": "ran", "artifact": "<run link>", "exit": 0 }
  ],
  "findings": [{ "id": "finding-1", "claim": "claim-1", "lanes": ["B3"], "text": "…", "state": "open" }]
}
```

`findings[].state` is `open` or `retired`. The `summary.json` of the [artifact contract](evidence-publishing.md#artifact-contract-adr-0058-alignment) renders from this record.

## Publishing

Published text never carries a lane id, a claim id or a finding id; it names the check in words (see *The reader is a reviewer on this PR* in [skill.md](../skill.md)). The record's values translate as follows:

| Record | PR-body ledger and verdict | `/pr-comment` |
|---|---|---|
| claim `held` | `✅ proven` | the finding as the ask, no verdict token |
| claim `refuted` | `❌ refuted` | the falsifier that fired, as the ask; only on your own PR or when the author asks |
| claim `inconclusive` | `⚠️ inconclusive`, naming what is missing | what is missing, if anything is posted |
| claim `not-run` | `⏳ not-captured` | nothing |
| lane `skipped`, `not-applicable` | `➖ N/A — <reason in words>` | nothing |
| lane `skipped`, `closed-by-ci` | omitted (catalog `G1`) | nothing |
| lane `skipped` for any other reason, or `failed` | the claim's status, with the lane named in words as what is missing | nothing |
