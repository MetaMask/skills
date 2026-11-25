---
name: deeplink-handler
description: >-
 Use when adding, changing, debugging, or reviewing deep links, universal
 links, or Branch links in MetaMask Mobile or Extension. Enforce client parity,
 keep the router feature-agnostic, and test every new or changed route end to end.
maturity: stable
---

# Deep Link Handlers

Each client must dispatch supported deep links from the link's own URL path,
using an exact path or an explicit route pattern for documented path parameters.

## Mandatory Client Parity

**Never add a deeplink handler to either `metamask-mobile` or
`metamask-extension` without a matching handler in the other client. No
exceptions.** Both routers must dispatch the same public URL paths and aliases
to working handlers with the same URL parameter contract. The implementation
and UI may differ by platform. For a feature available on only one client, an
explicit, tested route that hands off to that client (such as an open-on-Mobile
QR screen) can satisfy parity. An unmatched route, generic fallback (including
`?share=1` - a temporary _hack_ in Extension), or stub does not count.

- **Implementers:** Include both clients in the same work, or verify that
	the other client already handles the same link. If the other client is out of
	scope, unavailable, or cannot provide a working route or explicit handoff,
	stop before adding the handler to either client and tell the user what is
	blocking the work. Do not defer parity to a follow-up.
- **LLM reviewers:** Treat missing or unverified client parity as a
	**blocking finding** in either repo. Require evidence of a working handler in
	the other client's existing code or in a linked companion PR, plus end-to-end
	coverage in both clients for the public route. Do not approve without that
	evidence. Do not merge either PR unless the matching handler in the other
	repo is already merged or in review in the companion PR. A ticket or a
	promise is not evidence of parity.

## Mandatory Router and Feature Boundary

**Deep links support features. Features must not depend on deep links.** A deep
link is an external entry point, not an internal navigation API. In-app banners,
notifications, and screens must use ordinary routes or structured navigation
instructions, not open a public deep-link URL to navigate within the same app.

- The shared router owns URL validation, path matching, security policy, and
	dispatch. Register an explicit, feature-scoped path or documented path pattern;
	do not make a feature take over unmatched URLs.
- A route adapter translates validated URL input into an existing feature
	entry point. Keep feature decisions, state changes, and UI in the feature
	module. If the feature needs a new entry point, add it there so it also works
	without a deep link. Keep parsing and resolution free of navigation side
	effects; navigate or perform an intentional handoff after resolution.
- **LLM reviewers:** Block changes that put feature behavior in shared
	deep-link infrastructure, make a feature depend on deep-link ingress, or
	navigate within the app by opening a public deep link.

## Mandatory End-to-End Coverage

**Every new route and every change to a route's public behavior needs an
automated end-to-end test through the real entry point.** Start with the public
URL, let the client route it, complete any required interstitial, and assert the
actual destination or handoff and the parameters the destination receives.

- Use a focused test per route. Cover a changed alias, parameter, or fallback
	where it changes the outcome. Put shared router and security cases in the
	shared suite instead of copying the entire matrix for every route.
- Handler unit tests, mocks that only assert dispatch, and manual clicks are
	useful supplements. None substitutes for the automated route test.
- **LLM reviewers:** Missing route-level E2E coverage is a **blocking finding**
	even when the handler's unit tests pass. Check the test opens the public link
	and asserts what the user reaches, not merely which handler was called.

## When To Use

Use this skill when adding, changing, debugging, or reviewing a deep link in
Mobile or Extension, or deciding whether a flow needs a deep link at all.

## Workflow

For external links, apply the three requirements above and consult both repo
guides: [Mobile](repos/metamask-mobile.md) and [Extension](repos/metamask-extension.md).
The security model, what a signature covers, and the checks Security reviews
against are in `knowledge/deep-links.md`.

1. Identify the public URL path and any existing aliases. Register each
	 supported path in the client's deep-link router and wire it to a handler.
	 Keep the public path and client registration in sync when changing either.
2. Make the link self-contained for routing. The client must be able to identify
	 the handler and parse and validate its required inputs from the URL itself,
	 without a request to Branch's remote servers. Branch can support attribution
	 or delivery, but a Branch redirect, lookup, or callback must not be required
	 to interpret the link. Extension route resolution must be synchronous and
	 on-device. The website may recover a deferred URL via Branch before passing
	 it to Extension. The destination feature itself need not work offline.
3. Keep existing URL validation and security interstitial behavior intact. Reject
	 unsupported paths and malformed parameters through the client's existing
	 validation and fallback paths. Sign MetaMask-issued public links. A valid
	 signature does not make navigation internal, and explicitly supported
	 unsigned referral or attribution fields do not grant trust. Consult Platform
	 before changing shared deep-link infrastructure and require Security review
	 before changing validation, signature, or interstitial guarantees.
4. Run the route E2E tests in both clients and record the coverage in the PR.
	 Include the public URL and expected destination, the tests run, and the link
	 to the existing counterpart or companion PR. Verify the same URL resolves
	 without Branch; cover unsupported paths and malformed inputs in router tests.
