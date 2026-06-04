# Recipe harness adapters

Adapters may inject a trusted harness overlay into target checkouts.

Why: evals run against many Mobile/Extension revisions, and older revisions may lack the same bridge, selectors, wallet setup, or readiness APIs. Re-injecting the reviewed overlay gives every run an idempotent control surface while keeping the product checkout clean via backup/cleanup and ignored runtime paths.

Mobile uses `app-overlay/` for the in-app AgenticService/HUD plus `scripts/perps/agentic` bridge scripts. Extension uses runtime-only browser/fixture harness files.
