# Recipe harness adapters

Adapters may inject a trusted harness overlay into target checkouts.

Why: evals run against many Mobile/Extension revisions, and older revisions may lack the same bridge, selectors, wallet setup, or readiness APIs. Re-injecting the reviewed overlay gives every run an idempotent control surface while keeping the product checkout clean via backup/cleanup and ignored runtime paths.

Mobile uses `app-overlay/` only for the in-app AgenticService/HUD; Mobile control scripts live in the installed runner. Extension uses runtime-only browser/fixture harness files.
