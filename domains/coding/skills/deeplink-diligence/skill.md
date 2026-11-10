---
name: deeplink-diligence
description: >-
  Write or review a MetaMask Extension deep-link change against the signature
  boundary: what the signature binds, which parameters reach a route handler,
  and which of them a link author controls. Use when adding or changing a
  route in `shared/lib/deep-links/routes/`, editing `canonicalize`, `parse` or
  `verify`, forwarding a query parameter to a destination, building a page or
  hook a deep link opens, or stating that a parameter is signed. The recurring
  failure is reading "canonical" as "validated": with no `sig_params`, canonical
  is the whole supplied query minus `sig`. `docs/deep-links.md` holds the model
  and the review questions.
maturity: experimental
---
