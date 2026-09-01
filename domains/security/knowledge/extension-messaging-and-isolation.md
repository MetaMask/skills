---
name: extension-messaging-and-isolation
domain: security
description: "Who can reach the extension messaging surfaces in MV3, and which trust boundaries actually hold — the facts a reviewer needs before judging a message handler, a content script, or a deeplink route"
---

# Extension Messaging and Isolation

**Scope: MetaMask Extension (MV3).** Facts about who can send what to whom, and which boundaries
actually hold — the things a reviewer needs before deciding whether a message handler, a content
script, or a deeplink route is adequately guarded.

Every claim here was checked against the repo at a pinned commit. Where a review reached the
opposite conclusion first, the correction is recorded, because the wrong answer is usually the
intuitive one.

## Who can reach `runtime.onMessage`

**A page cannot, unless `externally_connectable` says so.** Without that manifest key, page
JavaScript has no `chrome.runtime` to call, so `runtime.sendMessage` is unreachable from a web
page regardless of what the listener does. Check
[`app/manifest/v3/_base.json`](https://github.com/MetaMask/metamask-extension/blob/main/app/manifest/v3/_base.json)
before treating an unauthenticated handler as page-reachable — as of this writing the key is
absent, so the sender set is the extension's own content scripts and extension pages.

**A port-based content script is not in that sender set either.** `runtime.connect` and
`runtime.sendMessage` are different channels: port traffic is delivered to *that port's*
`onMessage`, never to `runtime.onMessage`. `app/scripts/contentscript.js` is port-based and
contains no `runtime.sendMessage` call at all, so a `runtime.onMessage` listener does not hear
from it.

The practical consequence: **"which content scripts can reach this listener" is a narrower
question than "which content scripts exist"**, and answering it requires reading the channel each
one uses, not counting entries in the manifest.

## A sender check does not stop the page borrowing the content script's authority

This is the failure mode that survives every sender guard, because no message is forged.

If a content script renders UI into an **open** shadow root, page JavaScript reaches it:

```js
document.getElementById('some-host').shadowRoot   // works when mode: 'open'
```

From there the page can dispatch an untrusted `click` on any control inside, and the content
script's *own* handler runs with the content script's *own* authority. The message that reaches
the background is genuine, from a legitimate sender, carrying a legitimate payload. A sender
check passes. A payload validator passes.

Two independent guards, either sufficient:

- `attachShadow({ mode: 'closed' })`
- `if (!event.isTrusted) return;` in the handler

**`closed` genuinely holds here, and it is worth knowing why.** `attachShadow` runs in the
content script's ISOLATED world, so page JS can neither patch `attachShadow` before the call nor
read `.shadowRoot` back off the host afterwards. The same code executed from the MAIN world would
be defeatable by patching, so the mitigation's strength is a property of *which world created the
root*, not of the mode alone.

Corollary for reviewers: a control that is rendered but not visible is still in the tree. A
confirm dialog whose `<dialog>` renders unconditionally puts its confirm button within reach
whether or not the dialog is open.

## Worlds, and what LavaMoat covers

- **An ISOLATED-world content script does carry the LavaMoat runtime.** Being a content script is
  not what places a chunk in an unprotected tier. The distinguishing property is the manifest's
  `"world": "MAIN"` registration, which is what separates `inpage.js` from the rest.
- **Scuttling is configured per chunk but acts on the world's shared `globalThis`.** Two chunks in
  the same world therefore cannot have different scuttling states: turning it off for one turns it
  off for everything sharing that global. Any proposal to unscuttle one entry needs to name every
  other chunk in that world.
- **`web_accessible_resources` without a `matches` field is readable by every origin.** MV3 offers
  `matches` precisely to scope this; an entry that omits it — especially a directory glob — is
  exposed to `<all_urls>` even when the extension only ever loads it from one site.

## Deeplinks: what the signature covers

A deeplink is a message too, and its trust model has one non-obvious property.

`canonicalize` treats signed and unsigned links differently:

- **Signed** (a `sig_params` param is present): only the params *named in `sig_params`* are passed
  to the route handler. Anything else is dropped.
- **Unsigned**: every param except `sig` is forwarded.

So the signature covers exactly the enumerated set, and a route that opts into
`handlerSearchParams: 'original'` defeats this — it receives the raw params, meaning an unsigned
parameter rides along on a signed link and inherits the signature's trust without being covered by
it. New routes should leave `handlerSearchParams` unset; the default is `canonical`, whose own doc
comment describes it as removing unsigned params for signed links.

**The interstitial is not keyed on the signature alone.** `shouldShowDeepLinkInterstitial` returns
`false` for a request origin in `TRUSTED_WEB_ORIGINS` *before* it consults the signature status, so
a link initiated from one of those origins reaches its destination with no interstitial and no
signature. When reviewing a new route, the question is not only "is it signed" but "what class of
destination is now reachable through the origin short-circuit" — a settings surface carrying
consent toggles is a different proposition from a content page.

## Reviewer checklist

| Claim in a PR | What to check before believing it |
|---|---|
| "Only our content script can send this" | Which channel does it use — `connect` or `sendMessage`? Port traffic never reaches `runtime.onMessage` |
| "A page can call this handler" | Is `externally_connectable` present? Without it, page JS has no `chrome.runtime` |
| "A sender check makes this safe" | Can the page drive the sender instead of impersonating it? Open shadow root, untrusted events |
| "It's a content script, so it's not under LavaMoat" | ISOLATED-world content scripts do carry the runtime; `"world": "MAIN"` is the distinguishing property |
| "Scuttling is off for just this chunk" | Scuttling acts on the world's shared `globalThis` — name every chunk in that world |
| "This resource is only loaded from our site" | Does the `web_accessible_resources` entry have `matches`? Without it, every origin can read it |
| "The link is signed" | Is the parameter in `sig_params`? Does the route set `handlerSearchParams: 'original'`? |
| "The interstitial protects this route" | `TRUSTED_WEB_ORIGINS` short-circuits before the signature check |
