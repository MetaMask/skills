---
name: consent-gate-diligence
description: >-
  Decide whether a send is permitted at all, while writing it or reviewing it.
  Use when a change adds a network call, an analytics event, a trace or a
  breadcrumb in any feature, or adds any call on an onboarding path, awaited or
  not. Covers the five gates: basic functionality (a parent
  `useExternalServices` over twelve child preferences, held in the background
  until onboarding completes, and forced on for social login), MetaMetrics
  consent and its undecided third state, marketing consent as a separate flag,
  the compliance gate and when it does not run, and geolocation restriction.
  Also covers consent values written by code, calls that skip every gate, and
  the two pre-consent queues and how they drain. What a permitted field may
  carry is a separate review.
maturity: experimental
---

# Consent gate diligence

A correctly masked field sent without consent is a worse failure than an unmasked field sent
with it, and no amount of payload review can see it. Payload review asks *what does this
carry*. This asks *may it go at all, for this user, right now*.

The two questions are independent, and a change can pass one while failing the other.

## When to use

- A PR adds a network call to an external service, a tracked event, a trace, or a breadcrumb.
- A PR collects anything on a path a user reaches before consenting — onboarding, first run,
  social login, an unlock screen. A fire-and-forget call counts: not awaiting it does not make
  it not a send.
- A feature becomes available in a new region, or a region gate is added or moved.
- Review of an existing gate: not whether it exists, but whether it runs.

## Do not use when

- The question is what a field contains once permitted. That is the payload axis.
- The change is to a gate's UI copy or placement without touching its condition.

## A consent value the code wrote is not a decision

Before reading any gate, find where the path **writes** a consent value itself. The current
example is social login on Chrome, in `welcome.tsx` `handleLogin`: after login it calls
`setParticipateInMetaMetrics(true)` (*"automatically set participate in meta metrics to true for
social login users in chrome"*) and `setPna25Acknowledged(true, true)`, which marks the *Privacy and
product updates* analytics notice acknowledged. The same handler resets metrics to `null` before
login *"to prevent the queued events from being sent"*, so per its own comment, events queued
before consent are sent once the value is `true`.

Search the path for `setParticipateInMetaMetrics(true)`, `setDataCollectionForMarketing`,
`setTermsChecked(true)` and `setPna25Acknowledged` before treating a consent value as the user's.

## The rule the gates serve

**With basic functionality off, nothing reaches an external service.** The gates below are the
mechanisms that enforce that rule, and the rule is the question. A review that checks each named
gate and never asks what else the path calls has checked the mechanisms and not the rule.

During onboarding the background treats basic functionality as off until completion. So any call
on an onboarding path that does not consult a basic-functionality check is ungated in exactly
the window the check would close.

## Five gates, and they are not one switch

| gate | reads | what it controls | the check that is easy to get wrong |
|---|---|---|---|
| **Basic functionality** | `useExternalServices` on `PreferencesController`, a parent over twelve child preferences | external service calls — price APIs, token detection, phishing lists, simulations, not only analytics | there is no shared background helper. `getIsBasicFunctionality` is defined locally in `app/scripts/messenger-client-init/assets/assets-controller-init.ts` and `core-backend/backend-websocket-service-init.ts`; each returns false while `completedOnboarding` is false, and each returns **true when the preference is unset and true on any error**. A call site that defines its own check, or calls none, is a new gate to read |
| **Metrics consent** | `participateInMetaMetrics` | analytics events | `boolean \| null` — three states. `null` is undecided, not "not opted out". And code can write it: on Chrome, social login sets it `true` after login in `ui/pages/onboarding-flow/welcome/welcome.tsx` `handleLogin`, and a `socialCreate` flow skips the metrics screen |
| **Marketing consent** | `dataCollectionForMarketing` | campaign and attribution data | a separate flag. A UTM or campaign property gated on `participateInMetaMetrics` is gated on the wrong one. Its **default** can be set from pre-consent collection — see geolocation as a call, below |
| **Compliance** | `ComplianceController` via `ui/components/app/compliance/useComplianceGate.ts` | actions for addresses under OFAC screening | **fails open** when the prefetch rejects, and is skipped entirely when compliance is disabled. Both deliberate, both mean no screening on that run |
| **Geolocation restriction** | `GeolocationController` | region-restricted features | the gate lives with the feature — e.g. `ui/hooks/musd/useMusdGeoBlocking.ts` — not with the controller, so a new feature reaching a restricted region is a code-review question |

The failure this table exists to catch: **a gate that is present is not a gate that runs.** Four
of the five have a documented path on which they do nothing — basic functionality's error and
unset paths, metrics' undecided state, compliance's two, and geolocation restriction's absence
from any feature that does not call it.

## Basic functionality is a parent over twelve children

The preference is no longer one flag. `shared/lib/basic-functionality-consolidation.ts` defines:

| term | what it is | what to check |
|---|---|---|
| `BFT_CHILD_PREFERENCES` | twelve child preferences — `useCurrencyRateCheck`, `securityAlertsEnabled`, `usePhishDetect`, `useMultiAccountBalanceChecker`, `useSafeChainsListValidation`, `useTokenDetection`, `useTransactionSimulations`, `use4ByteResolution`, `openSeaEnabled`, `useNftDetection`, `useExternalNameSources`, `useAddressBarEnsResolution` | a call site may gate on a child rather than the parent. Name which one, and whether the parent being off also stops it |
| `EXTERNAL_SERVICES_OWNED_PREFERENCES` | the 7 of those that `PreferencesController.toggleExternalServices` overwrites; the other 5 — `securityAlertsEnabled`, `use4ByteResolution`, `useExternalNameSources`, `useMultiAccountBalanceChecker`, `useTransactionSimulations` — it leaves as they were | toggling the parent rewrites 7 children and not 5. A service gated on one of the 5 alone can run with the parent off |
| `isBasicFunctionalityConsistent` | true only when parent and every child are aligned all-on or all-off | there is an **inconsistent** state, and the consolidation exists to migrate users out of it. A service gated on a child alone runs when that child is on and the parent is off |
| `getIsBasicFunctionalityConsolidationGateEnabled` | consolidation is on for a user with the persisted cohort `preferences.isBasicFunctionalityConsolidatedEnabled`, or with the remote flag `extensionBasicFunctionalityToggle` on **and** consistent preferences | rollout-gated for existing users, so two users on one build can be gated differently. The build flag `BFT_CONSOLIDATION_ENABLED` sets the cohort at onboarding, and `builds.yml` sets it in the top-level `env:` for every build |

**Social login onboarding forces it on, in every build.** `getIsBasicFunctionalityForcedOnDuringOnboarding` in
`ui/selectors/multichain/basic-functionality.ts` is true when the build flag is set and the flow
is social login, and the flag is set for every build, and its own comment states the consequence: *"it is on and the user can't turn
it off… onboarding completion saves it as on."* It is read by
`ui/pages/onboarding-flow/hooks/useOnboardingCompletion.ts` and
`privacy-settings/privacy-settings.tsx`.

So on that path two things are true at once. The background check stays closed until completion,
and the value persisted at completion is not a choice the user made. For a diff touching social
login onboarding, check both: whether its calls wait for completion, and whether anything it
does depends on the persisted value reading as consent.

## Geolocation as a call, not only as a gate

The restriction row above treats geolocation as a gate other features consult. A geolocation
**lookup** is itself an external call, and it needs the basic-functionality rule applied to it.

The worked example is `app/scripts/services/oauth/oauth-service.ts`. `startOAuthLogin()` calls
`GeolocationController:getGeolocation` before `#handleOAuthLogin`, fire-and-forget with only a
logging `.catch`, and its comment gives the purpose: the location *"will be used later to
determine if Marketing Opt-in should be enabled by default."* That is a pre-decision call setting
the default of another gate, made during onboarding.

Why the gate has to be at the call site:

- In `@metamask/geolocation-controller` 2.0.0, the controller's `AllowedActions` is only
  `GeolocationApiService:fetchGeolocationData`. It cannot read `PreferencesController` or
  `OnboardingController`, so it cannot gate itself.
- The API service takes `env`, `fetch` and `ttlMs`, with no enable option. The extension builds
  it in `app/scripts/wallet-init/instance-options/geolocation-api-service.ts` with `env` and a
  bound global `fetch`, and nothing else.
- `getGeolocation()` is best-effort: it swallows failures and returns the last known value, so
  nothing downstream fails if the call should not have happened.

What it sends: a `GET` to `https://geolocation.api.cx.metamask.io/v2/geolocation` with no query
parameters or body, so what leaves is the client's IP address and standard request headers. The
service caches the answer in memory for 5 minutes and the controller persists none of its state,
so the first lookup after a fresh install or restart goes to the network.

On shipping builds social login has basic functionality forced on, so this call does not break
*nothing with basic functionality off* there. It breaks the hold: the background keeps asset and
websocket calls back until onboarding completes, and this one runs on the first screen.

For any `GeolocationController:getGeolocation` caller, ask whether a basic-functionality check
runs before it, and whether it waits for onboarding to complete. Other callers exist — `app/scripts/lib/money/money-account-availability.ts` and
`app/scripts/messenger-client-init/money-account-upgrade-controller-init.ts` — and
`app/scripts/controllers/rewards/rewards-data-service.ts` resolves geolocation through its own
URLs, outside the controller entirely.

## Two pre-consent queues, not one

Data collected before a consent decision is buffered rather than dropped. A send correctly held
back can still leave later, so trace what happens to what is already held.

Two independent buffers with two owners. `MetaMetricsController` holds
`tracesBeforeMetricsOptIn` in **persisted** state, so buffered traces survive a restart and sit
on disk until drained. `AnalyticsController` owns a separate pre-consent *event* queue — the
comment in `setParticipateInMetaMetrics` says so explicitly, and calls traces "out of scope"
there. Checking one is not checking the other. The analytics controller's options are set in
`app/scripts/wallet-init/instance-options/analytics-controller.ts`, including
`isPreConsentQueueEnabled` and `isGeolocationEnabled`; read what each enables before assuming a
pre-consent path is quiet.

The three decisions drain them differently, and the difference is the review surface:

| `setParticipateInMetaMetrics(x)` | trace buffer |
|---|---|
| `true` | `trackTracesAfterMetricsOptIn()` then `clearTracesAfterMetricsOptIn()` |
| `false` | `clearTracesAfterMetricsOptIn()` **without** flushing — "they must not be sent after opt-out" |
| `null` | `resetConsentDecision`; the buffer is untouched |

So for a diff that adds buffered collection, three questions: which buffer does it join, or
does it introduce a third; is that buffer persisted; and does the opt-out path clear it, or
only the opt-in path.

## Procedure

1. **Enumerate what the diff sends, and to where.** Network call, event, trace, breadcrumb.
   Count un-awaited calls — a fire-and-forget send is still a send. Group by pipe, because the
   pipes have different gates.
2. **If the diff touches a pre-consent path, enumerate what the whole path calls and what it
   writes**, not only what the diff adds. A consent value set by code on that path is a
   decision made for the user, and it opens every gate keyed on it. The rule is that nothing reaches an external service with basic
   functionality off, and a new call is often safe while an old one beside it is not.
3. **For each send, name the gate it is behind** — by reading the call site, not by assuming the
   controller applies one. A gate applied inside a controller does not gate a caller that
   bypasses it, and some controllers cannot gate at all.
4. **Read the gate's condition, all of it.** Compound conditions are where this goes wrong; so
   is a helper whose name implies one check and whose body performs two, and a helper defined
   locally that differs from its siblings.
5. **Find the path where the gate does nothing.** Every gate here has one — an error path, an
   unset preference, an undecided state, a disabled feature, or a call that never consults it.
   Say what it is, and whether this change is reachable on it.
6. **If anything is collected before a decision, trace its buffer to a drain.** Both drains, and
   the undecided branch.
7. **Sort, do not rule.** Gated correctly / gated on the wrong flag / ungated on a reachable
   path / buffered with no drain. The accept decision belongs to the people who own the
   control.

## Common pitfalls

| Mistake | Correct approach |
|---|---|
| Treating consent as a boolean | There is an undecided state, and marketing consent is a second flag |
| Reading a consent flag as the user's decision | Find whether code on the path wrote it; Chrome social login writes metrics consent `true` |
| Treating basic functionality as one flag | It is a parent over twelve children, with an inconsistent state and a rollout cohort |
| Confirming a gate exists | Read its failure path and its disabled path; presence is not operation |
| Reading the preference flag alone | The background check is compound with onboarding completion and fails open on error |
| Reading social login onboarding as user choice | Basic functionality is forced on there and saved as on at completion |
| Treating geolocation only as a gate | A geolocation lookup is an external call that needs the gate itself |
| Skipping un-awaited calls | Fire-and-forget calls send, and their failures are swallowed |
| Checking only what the diff adds | On a pre-consent path, the rule covers every call the path makes |
| Checking the analytics buffer only | There are two buffers with two owners |
| Reviewing the opt-in path | Opt-out and return-to-undecided drain differently, and one does not drain at all |
| Rendering a verdict | Sort and evidence; the decision belongs to privacy, legal, or compliance |

## Related

- The payload axis — what a field holds once it is permitted to leave — is reviewed separately,
  and a change frequently needs both.
- Instrumentation review covers whether an event is correctly identified and routed, which is a
  third question again.
