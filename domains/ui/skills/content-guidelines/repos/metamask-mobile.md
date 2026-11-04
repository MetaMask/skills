---
repo: metamask-mobile
parent: content-guidelines
---

# MetaMask Content Design Guidelines — Mobile

Shared rules are in the content-guidelines skill. This overlay is MetaMask Mobile only: where strings live, and drafts that apply to this client. If the two seem to disagree, follow the shared skill.

## Where strings live

- English source: `locales/languages/en.json`. Feature-first nested keys (`perps.order.validation.please_set_a_limit_price`).
- UI reads them with `strings(name, params)` from `locales/i18n.js`. Placeholders are `{{name}}` only.
- Edit the English source. Do not hand-edit the other files in `locales/languages/` to keep them in sync. Translation owns those files.
- Judge the string a person sees, not the key. `transaction.gas_fee`, `swaps.gas_fee`, and `activity_details.gas_token_fee` already display "Network fee".

The generated skill under `.claude/skills/mms-content-guidelines/`, `.cursor/rules/mms-content-guidelines/`, and `.agents/skills/mms-content-guidelines/` is overwritten on the next sync. Change this overlay or the shared skill, then sync.

On mobile, do not say "clicking" in a consent line. "Tap to…" is allowed in this client. It is not allowed in the extension.

Predictions market-type labels are ours: `predict.sports_market_types.*`, `predict.outcome_groups.*`, and `predict.market_groups.*`. Sentence-case those. The question on a market card comes from the Polymarket feed (`question`, `groupItemTitle`, event `title` in `PolymarketProvider`). Do not sentence-case that feed text.

## PROPOSED

1. **Locale file.** If a person can read it, it belongs in `locales/languages/en.json`. That includes accessibility labels and empty states. Hardcoded examples to move when you touch them: "Date of Birth" in `app/components/UI/Card/components/Onboarding/PersonalDetails.tsx`, "Games couldn't be loaded." / "No games available." / "Retry" in `FeedPreviewSection.tsx`, and "Unable to load price history" in `PredictGameChartContent.tsx`.
2. **Do not run `toSentenceCase` on product copy.** `app/util/string/index.ts` lowercases everything after the first character. Bridge quote UI calls it on `bridge.network_fee`. It will also lowercase "NFT" and "Secret Recovery Phrase".
3. **Tap, not click.** Say tap or press. The Apple Pay side button is the exception: "double-click" is the platform's name for that control. `card.apple_pay_confirmation.instructions` says "Simply double-click the Side Button…". Drop "Simply", and keep "double-click" only for that hardware button.
4. **Developer-only strings** (`app_settings.developer_options.*`, debug screens) are out of scope. They may use internal names such as SRP. Do not reuse them as product copy, and do not lint them as product copy.
