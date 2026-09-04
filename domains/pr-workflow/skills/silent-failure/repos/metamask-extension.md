---
repo: metamask-extension
parent: silent-failure
---

# Silent Failure Surfaces (Extension)

Where the general skill asks *if it breaks, would we know*, extension has four seams where the
answer is structurally no. Each is a place the process boundary or the platform lifecycle
absorbs the failure before anything observable happens.

## The background/UI messaging boundary

A background action that throws returns to the UI as a rejected promise the caller may not
await, or as no message at all. The UI renders its optimistic state and nothing contradicts it.

Induce it by making the background handler throw and watching the UI, not the console. A test
that asserts the handler rejected proves the producer failed; it does not prove the consumer
learned.

## Controller state that never reaches Redux

`controller-integration` names this failure directly — *"debugging a controller whose state
never reaches Redux/the UI or resets on restart."* A controller can update its own state
successfully while the messenger wiring, the `MESSENGER_FACTORIES` entry, or the state-to-Redux
path is missing. Every unit test of the controller passes.

Assert against the Redux store, not the controller instance.

## MV3 service-worker restart

In-flight background work does not survive a restart, and nothing reports the interruption. A
pending request registry, a retry counter, or a debounce window is empty again with no error.

Before attributing a bug here, run `extension-lifecycle-decoupling` — the assumption that the
worker dies frequently mid-session is itself usually wrong, and misattribution is the more
common failure.

## Logged-not-surfaced fetches

`remote-flag-delivery` describes the shape — *"the fetch fails and the error is logged rather
than surfaced"* — and it generalises past feature flags to any remote config, registry, or
price fetch with a default. The default renders, the log line is the only evidence, and no test
reads logs.

The falsifier is a matrix whose two arms were the same arm: if the fetch never succeeded in
either, both cells render the default and the result is indistinguishable from success.

## What to assert

For each seam, the proof obligation is the **observable a user or an operator would have**, not
the internal state:

| Seam | Assert on |
|---|---|
| messaging boundary | rendered UI or dispatched action, after inducing the throw |
| controller to Redux | store contents, not controller instance state |
| SW restart | state after a forced restart, not after the write |
| logged-not-surfaced | delivered value read from state, not the absence of a thrown error |

A green suite under an induced failure is the finding, not a disappointment.
