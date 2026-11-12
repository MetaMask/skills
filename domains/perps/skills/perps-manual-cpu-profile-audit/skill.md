---
name: perps-manual-cpu-profile-audit
description: >-
  Investigate a Perps slowdown from a Hermes CPU profile that a person records by hand in the app's shake-menu profiler, from complaint to proven fix. The capture is manual: nothing here drives the app, an emulator, or mm-harness. Each invocation moves one step and saves progress in an investigation file: intake (hypothesis and capture plan), capture check, ranked fixes with a target metric and a ceiling, verify against a baseline with a noise band, and an optional ticket draft. Bundles a standalone node script that counts a raw .cpuprofile with no source map. Use when asked why a Perps screen, sheet, or flow is slow or janky, to plan or check a profile capture, to read a .cpuprofile, or to prove a performance fix with before and after numbers. Not for render counts on a running simulator or automated device runs.
maturity: experimental
---

# Perps manual CPU profile audit

Takes a Perps performance complaint ("this sheet is slow and I don't know why") to a fix that is proven with numbers. A person records a Hermes CPU profile on a phone, one bundled script does all the counting, and this skill decides what to do with the numbers. The same script and the same capture plan are used before and after a fix, so two people get the same answer.

## When to use

- Someone says a Perps screen, sheet, or flow is slow, janky, or hangs, and there is no profile yet or one that needs reading.
- Someone wants a capture plan, or wants to know if a capture they took is usable.
- Someone has a `.cpuprofile` and wants to know what it says.
- Someone made a performance fix and wants before and after numbers that hold up.

Not for:

- Render counts or selector recomputes on a running simulator. Use `react-render-delta` if it is installed.
- Automated, harness-driven device runs. Use `recipe-performance` if it is installed. This skill needs no harness and never drives the app.
- Production p75 or p95 movement across releases. That is Sentry data. `performance-attribution` covers it, but it ships an Extension overlay only, so it may not be installed in a Mobile checkout.
- Profiles that are not Hermes (V8 `.cpuprofile`) or that were already converted to a Chrome trace. The script rejects them and says so.

## Ground rules

- **One step per invocation.** Read the investigation file, do the step its status names, update the file, and end by telling the person exactly what they do next. Never skip ahead: no recommendations before a capture passes the check.
- **The person records the profile.** Never try to start the app, tap, or run a device.
- **Numbers come from the script.** Never count or estimate from the raw profile by hand. Quote the metric row for every claim.
- **Never write to Jira.** A ticket draft is text in the investigation file. The engineer reviews it and files it.

## How to reply

The skill is judged by how fast the person gets to a proven fix, not by how much it explains.

- **Short.** Say only what the person needs for the next action. Details, reasoning, and metric tables go in the investigation file. Point to the file instead of repeating it.
- **Tickets by name.** Never write a Jira key alone. Write the ticket's title in plain words with the key in brackets: "MarketInsights trace fix (TAT-4102)".
- **Phone checklist.** When the person must set something up on the phone, list it under **Before you start**, one line per item in the form `Thing: state` ("Low Power Mode: off"). No reasons.
- **Work quietly.** Write nothing between tool calls. The first text the person sees is the reply.
- **Caveats in the file.** Confidence levels, assumptions, and unverified claims go in the investigation file. The reply gets at most one short line about them, before "What you do next".
- **Ask, don't assign.** Never ask the person to edit the investigation file. Every question goes in "What you do next" (OS version, which variant they saw), and you write the answers in yourself.
- **End with "What you do next".** It is always the last section of the reply. Nothing comes after it.
- **Literal actions.** Each item in "What you do next" is something the person physically does, in order, with waits: "Open BTC market details. Wait 10 s. Shake the phone and tap Start." Never use a capture label such as `lite-1` unless the steps it stands for are written in the same item.

## Workflow

Six steps, one per invocation: intake, capture, check, recommend, verify, and an optional ticket draft. The status in the investigation file says which one is next. Steps 3 to 5 can loop: a failed check goes back to capture, and an unproven fix goes back to recommend.

## The investigation file

Write it in the working directory as `perps-profile-audit-<slug>.md`, where the slug is the Jira key in lower case or a short kebab-case name for the complaint. Tell the person not to commit it. Keep it short. Sections:

- **Status**, one of: `intake`, `awaiting-capture`, `recommend`, `awaiting-recapture`, `verify`, `closed`.
- **Complaint** in the person's words, and the ticket title and Jira key if there is one.
- **Hypothesis**.
- **Capture plan**.
- **Captures**: one row per file with its label (`baseline-1`, `after-1`), file name, app version, build number and type, device, and the check result.
- **Findings** and **Recommendations**, each with the metric rows that back it.
- **Verification** and the optional **Ticket draft**.

## Step 1: Intake

Input is a Jira key or a plain-English complaint. If the person already described the problem, do not fetch the ticket. If they gave only a key and a Jira tool is available, read that ticket and no linked ones. Otherwise ask them to paste it.

Produce two things and stop:

1. **A hypothesis**: one or two falsifiable sentences that name the frames or the kind of work you expect to dominate. Example: "Opening the close sheet re-renders the whole market screen, so `PerpsMarketDetailsView` and React commit work should dominate the slow moment."
2. **A capture plan** the person can follow without you:
   - **Build**: one build for every capture in this investigation. Same version, same type.
   - **Device**: a physical phone. Record the model and OS. Use the same phone for before and after.
   - **State**: only what the hypothesis needs (account, funded or not, market). Every extra setup item slows the capture.
   - **Steps**: numbered taps with waits, written as one repeatable pass. Repeat the pass inside the capture if the moment is short. Use waits a person can count in their head. Never require a stopwatch or a second device.
   - **Passes**: build them from the complaint. If the person names a slow moment, target exactly that. If the complaint is vague, use one idle pass on the named screen and one interaction pass. If the person points at an existing plan (an earlier investigation file, or a ticket that spells out passes), reuse its steps exactly. Two shapes, filled in from the complaint:
     - **Idle**: open the screen, wait 10 s, start, no taps for a fixed time, stop.
     - **Interaction**: open the screen, wait 10 s, start, do the slow action N times at a fixed spacing, wait 5 s, stop.
   - **Length**: fixed. Choose it once (at least 30 seconds) and keep it for every capture.
   - **Frames to expect**: component names that must show up if the screens were reached. Find them in the code.
   - **Baseline**: at least 2 captures of the unchanged build. The difference between them is the noise band. One capture cannot tell a fix from noise.

Write the full plan to the investigation file and set the status to `awaiting-capture`. The reply has three parts and nothing else:

1. The hypothesis, in one sentence.
2. **Before you start**: the build, device, and state checklist, one line each.
3. **What you do next**: every capture written out as literal steps, in the order to record them, including how to start and stop the profiler and how to get the files off the phone for their platform. Write each pass once and refer back to it for repeats ("Repeat step 2"). Say the order matters because files are matched to passes by their timestamp.

## Step 2: Capture

The person records and hands back the file. Give them the recording steps and the file-transfer steps for their platform. Remind them to keep the file name as it is: the script reads the app version from it.

## Step 3: Check

Run the script with the plan's values:

```bash
node scripts/analyze-profile.cjs <file> --check --expect <frames> --expect-version <x.y.z> --min-seconds <n>
```

Each line is `PASS`, `WARN`, `FAIL`, or `SKIP`. Exit code 2 means a `FAIL`. Do not go on while anything fails. Give the exact redo steps:

| Check | If it is not a pass |
| --- | --- |
| `capture-length` FAIL | Too short to compare. Redo with the planned length. |
| `app-version` FAIL | Wrong build was installed. Install the planned build, log in, and redo. |
| `expect:<frame>` FAIL | The screen was not reached, or the build strips that name. Redo the taps from the plan. If the screen is right, check the component name in the code and fix the plan. |
| `idle-share` WARN | Mostly idle. The interaction may be missing from the capture, or the slowness is not JS work. Ask when in the capture the slowness happened, then see step 4. |
| `sampling-gaps` WARN | Part of the capture has no samples. The profiler paused or the app went to the background. Redo without leaving the app or locking the screen. |
| `app-version` SKIP | The file name has no usable version, or none was expected. Record the build yourself. |
| `expected-screens` SKIP | No `--expect` frames were given, so the screens are not confirmed. Add them and rerun. |

Record the passing capture as a row in the investigation file. Note the build number yourself: the file name carries the version only, not the build number or whether it was an RC or exp build.

Reply with one line per capture (passed, or what to redo), then **What you do next**.

## Step 4: Recommend

1. **Find the slow moment.** The default output lists the longest tasks with their offset in seconds from the first sample. Ask the person when the slowness happened, relative to tapping Start. Then isolate it:

   ```bash
   node scripts/analyze-profile.cjs <file> --window <from>:<to> --frames <names>
   ```

2. **Decide whether it is JS at all.** If the window is mostly idle (idle share above about 90%, a rule of thumb) while the person felt the slowness, the JS thread was waiting, not working. Say the cause is not JS work, list what else it could be (native animation, layout, native modules, network), and point to Perfetto on Android or Xcode Instruments on iOS. Do not propose JS fixes.
3. **Rank the candidates.** Take frames from "Top by self time" and "Top by inclusive time", plus any `--frames` you added. For each one give:
   - the fix you propose, with the evidence row behind it
   - the **target metric**: the row that should move
   - the **ceiling**: that frame's inclusive ms and % of busy JS in the window. A fix cannot remove more than this
   - a **prediction**: "this row goes from A to at most B"
   Order by ceiling, highest first.
4. **Do not recommend what you cannot prove.** If a ceiling is smaller than the noise band for its row, say the fix cannot be proven with this method.
5. **Know the limits of names.** Frames with the same name are merged across files. `(anonymous) @<address>` means an unnamed function that cannot be named without a source map: say that instead of guessing.
6. Use the `performance` skill for fix recipes. Use `react-render-delta` to prove a render-count change, if it is installed.

Record findings and the ranked list, set the status to `awaiting-recapture` once a fix exists, and tell the person to recapture the same plan on the fixed build.

## Step 5: Verify

Capture the same plan on the fixed build, then compare against at least 2 captures of the unfixed build:

```bash
node scripts/analyze-profile.cjs <after> --baseline <before-1> --baseline <before-2> [--window <from>:<to>] --check
```

Read the Status column. For each row, `better` and `worse` mean the value is outside the baseline range, and `within-noise` means it is inside. `no-band` means there was one baseline, so there is no noise band and nothing can be called proven.

- The fix is **proven** only if the target metric is `better` and no other row is `worse`.
- `within-noise` is **not proven**. Say so. Capture more runs, or report that the fix is unproven.
- Compare the result with the prediction from step 4 and say how far off it was.
- To keep numbers without keeping large files, save a result with `--json > <file>` and pass it later as a baseline. Use the same `--window` every time.

Close the investigation when the fix is proven, or loop back to step 4 with what you learned.

## Step 6: Draft a ticket (optional)

Turn a confirmed finding into a ticket draft in the investigation file: problem, evidence (metric rows, window, build, device), proposed fix, target metric with its ceiling, and how to verify. The engineer reviews the draft before anything is created. This skill never creates or edits a ticket.

## The script

`scripts/analyze-profile.cjs` runs with plain `node`, with no install and no Claude. Run it with `--help` for every option. It reads a raw Hermes `.cpuprofile` and prints:

- **Idle**: the share of samples whose stack is only the root frame.
- **Tracked frames**: inclusive share of busy JS, meaning the share of non-idle samples that have the frame anywhere in the stack. `--frames` adds more.
- **Tasks**: runs of consecutive busy samples. A new task starts when the gap between busy samples is more than 2.5 times the median sample interval. Counts for tasks of at least 50, 100, and 300 ms, and the longest.
- **Longest tasks** with their offset, **top frames** by self and inclusive time, and `--window` to isolate a moment.

It also drops a leading sample that sits far from the rest (likely a profiler start marker) and says so. Every number is a share of samples at about 12 ms spacing, not a wall-clock measurement. Native and network time that the JS thread does not run are not in the profile.

Task counts scale with capture length, so compare captures of the same planned length. The script warns when a baseline's length differs by more than 20%.
