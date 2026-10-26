---
repo: metamask-mobile
parent: perps-manual-cpu-profile-audit
---

# Perps manual CPU profile audit: MetaMask Mobile

This section holds the Mobile specifics: which builds work, the recording and file-transfer steps in plain language, and where the code lives. The upstream guide is `docs/readme/release-build-profiler.md` in the app repo.

## Which builds work

The shake-menu profiler only exists in **RC** and **exp** builds. The app turns it on only when `METAMASK_ENVIRONMENT` is `rc` or `exp` (`app/components/UI/ProfilerManager/ProfilerManager.tsx`). Store builds and dev builds do not show it, and dev builds are not representative anyway. An engineer can produce an RC build with the `Build Mobile App` workflow (iOS installs from TestFlight, Android from the `build_android_main_rc` artifact), as `docs/readme/release-build-profiler.md` describes. Use one build for the whole investigation.

## Recording on a device

Use a physical phone. These steps are for the person recording, in plain language:

1. Install the build, log in, and get to the starting state in the plan.
2. **Shake the phone.** A small card titled **Performance Profiler** appears at the top right, showing **Stopped**.
3. Tap **Start**. The card shows **Recording...**. If the card is in the way, shake again to hide it. Hiding the card does not stop the recording.
4. Do one pass of the plan, exactly as written, for the planned length.
5. Shake again to bring the card back, then tap **Stop**.

Each recording is saved as its own file, and earlier files are not overwritten. The name looks like `io.metamask.MetaMask_v8.15.0_1791215876954.cpuprofile`: the app id, the version, and the time. Do not rename it. The analyzer reads the version from the name.

## Phone settings that change results

Add the ones that apply to **Before you start**:

- **MetaMetrics: on** (Settings › Security and privacy › Participate in MetaMetrics) when the suspected cost is Sentry tracing (`trace`, `_onSpanEnded`, `normalize`). Without consent, `app/util/trace.ts` buffers trace requests instead of opening Sentry spans, so that cost never shows up.
- **Auto-Lock: longer than the capture.** A screen lock mid-capture leaves a gap.
- **Low Power Mode: off.** It throttles the CPU.

## Getting the file off the phone

- **iPhone:** after Stop, tap **Export** on the card. In the share sheet, send the file to yourself with AirDrop, Files, iCloud, or any app you use. iOS saves the file in the app's cache, so Export is how you get it out.
- **Android:** the file is saved to the phone's **Downloads** folder automatically when you tap Stop. Open the Files app, find it in Downloads, and share it with an app you already use, or plug the phone into a computer with a USB cable and copy it from Downloads.

Write down the app version and build number from the phone as you go. The file name carries the version only.

## Source maps and anonymous frames

In the 8.15.0 reference profile, about one in seven JavaScript frames has no name and shows as `(anonymous) @<address>`. The script does not use source maps in this version. To name those frames, convert the profile and apply the build's source maps as `docs/readme/release-build-profiler.md` describes (artifacts `android-sourcemaps-<build-name>` and `ios-sourcemaps-<build-name>` from the build that produced the app). A map from a different build gives plausible but wrong attribution.

## Where the code lives

- Perps UI, hooks, and utilities: `app/components/UI/Perps/`. The Perps team owns it.
- The React Compiler runs over the whole app in real builds, but not under Jest. A unit test that passes says nothing about a regression that comes from compiler output, so a capture is the proof.
- For fix recipes and Mobile-specific traps (selector memoization, effects, context providers), use the `performance` skill.

## Example passes

Examples only; passes come from the complaint. An interaction pass that opens and closes the Lite trade sheet from market details. An interaction pass over the Pro sheets (close, adjust margin, flip). An idle pass on market details with no taps.

## Reference values

On one 8.15.0 RC session recorded on 2026-10-05 (about 236 sampled seconds, Lite and Pro sheet passes), the script printed: idle 74.6%, `[GC Young Gen]` 25.7% of busy JS, `_onSpanEnded` 16.2%, `useMarketInsightsEntryTrace` 10.8%, `dispatch` 10.6%, `propagateParentContextChanges` 8.1%, 280 tasks of at least 50 ms, and a longest task of 648 ms. Treat them as an example of what the table looks like, not as a target. That profile is not stored in this repo.
