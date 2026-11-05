---
name: content-guidelines
description: >-
  MetaMask product copy rules for user-facing strings in metamask-mobile
  and metamask-extension. Canonical source for sentence case, voice,
  buttons, wallet and account, network fee, spending cap, Secret Recovery
  Phrase, and errors. Use when writing or reviewing locale files (en.json,
  messages.json), buttons, toasts, empty states, errors, confirmations, or
  the same standards in stories, constants, and README examples.
maturity: stable
---

# Content guidelines

This file is the canonical source for MetaMask product UI copy. Mobile and extension overlays add file paths and client examples. They do not replace these rules.

The Notion MetaMask Content Design Style Guide, the design-system Cursor rule, and component READMEs are background. When they disagree with this file, follow this file.

## How to apply

- Unmarked rules are confirmed. Follow them.
- **PROPOSED** rules are drafts for Ali Forrest. Use one for new copy only when it does not conflict with a confirmed rule. Do not rewrite existing copy only to satisfy a PROPOSED rule.
- [Open questions](#open-questions) are not rules. Do not enforce them and do not lint them.

## When to use

- Writing or reviewing user-facing product strings in locale files
- Checking the same standards in stories, constants, README examples, and accessibility text a person can read
- Choosing a term (wallet, account, network fee, spending cap, Secret Recovery Phrase)

## Out of scope

- Marketing or external comms
- Code style, TypeScript, or component API decisions (`ui-development`)
- A prop-level detail this file does not mention. Component READMEs may still document that prop. If the README disagrees with this file, follow this file.

## Workflow

1. Write the string against the confirmed rules below.
2. Use the glossary before inventing a term.
3. Match a [do / don't](#do--dont) example.
4. Read the repo overlay for where the string lives. On install, that overlay is already appended to this skill. In a source checkout, open `repos/metamask-mobile.md` or `repos/metamask-extension.md`.
5. Edit the English source in the app repo. Do not edit the generated `mms-content-guidelines` copy under `.claude/`, `.cursor/`, or `.agents/`. The next sync overwrites it.
6. Skip [Open questions](#open-questions). Apply a **PROPOSED** rule only as the note above allows.

## Voice and tone

Use active voice.

```
✅ "We're investigating the problem."
❌ "The problem is being investigated."
```

Point of view:

- The user's things are **your**. Never "my" for the user's things (`drawer.share_address` is "Share my public address"; use "Share your public address").
- MetaMask is **we / our**.
- MetaMask never says I, me, or my.
- First person is allowed only in a consent checkbox: "I understand that…". Questionnaire answers (including `scam_questionnaire.*`) are neutral, not first person.
- The consent line is second person, not a checkbox. See [Consent](#consent).

Use contractions. No exceptions.

```
✅ "We're here to help."   ✅ "This can't be undone."
❌ "We are here to help."  ❌ "This cannot be undone."
```

**PROPOSED.** MetaMask sounds direct and calm. It names the object and the next step. It does not apologize, cheer, or warn with punctuation.

### Words to avoid

| Avoid | Instead |
| --- | --- |
| successfully, "was successful", "has been" on a success | Past participle. "Order placed", "{{name}} added" |
| please | Name the action. "Enter a limit price" |
| sorry, unfortunately | State what happened, then the action |
| click here | Name the destination. "Tap to…" is allowed on mobile only |
| fiat | The currency name (USD, EUR). "Local currency" only for the setting that picks one |
| gas, gas fee, transaction fee in a default flow | network fee. See [Fees](#fees). Leadership confirmed this |
| dapp, dApp, DAPP, ÐApps | site |
| native currency | network currency |
| allowance, spend limit, token allowance | spending cap. On Tron, do not say "allowance" for daily resources either |
| cryptocurrency | crypto |
| coins | tokens. "coin" is allowed only on Perps market screens |
| delete wallet, erase, erase wallet | reset wallet |
| seed phrase, SRP, mnemonic | Secret Recovery Phrase |
| sign in, when it is the same action as log in | log in. Social login buttons stay "Sign in with Apple" and "Sign in with Google" |

"Tap to…" is allowed on mobile only. Do not use it in the extension. Name the control there. The older ban on that phrase is retired for mobile.

Do not use "allowance" for Tron daily resources. It clashes with spending caps. Name the resource without that word.

Do not write "fiat". Use the currency's name. Use "local currency" only when the screen is the setting that chooses a currency, and no single currency is named.

"coin" is allowed only on Perps market screens. Everywhere else, say "tokens".

## Capitalization

**Default: sentence case.** Capitalize the first word and the exceptions below. If a name is not on the list, it is sentence case.

### Title case is correct for

| Category | Examples |
| --- | --- |
| Recovery term | Secret Recovery Phrase |
| MetaMask product names | MetaMask, MetaMask Card, Metal Card, Virtual Card, Snaps, Perps, Predictions, Rewards (the product) |
| Legal document names | Terms of Use, Privacy Policy. A partner document uses the partner's own title. Never "T&C" or "Terms and Conditions" for MetaMask's own |
| The Settings screen | "Settings" when it names that screen ("Open Settings"). A sub-screen is sentence case ("Security and privacy") |
| Other proper nouns | Ethereum, OpenSea, Ledger, Apple, Google, Consensys, Hyperliquid, X. Write "X", not "Twitter" or "X (Twitter)". Write "Hyperliquid", not "HyperLiquid" |
| Network names | Ethereum Mainnet, Polygon Mainnet, Arbitrum One |
| Abbreviations | NFT, API, DAO, DeFi, ETH, BTC, SOL, plus the trading abbreviations in [Abbreviations](#abbreviations) |

### Sentence case, including these

"Private key" is sentence case, including in titles and buttons. It is not a title-case pair with Secret Recovery Phrase.

Also sentence case: titles, buttons, menus, settings labels, section headers, tags, and feature names that are not on the list. "Smart transactions", "Hardware wallet", "Smart account", "NFT media", "Money account", "Pix key".

```
❌ "Turn on Device Authentication"
✅ "Turn on device authentication"

❌ "Connect Hardware Device"
✅ "Connect your hardware wallet"

❌ "Smart Account"
✅ "Smart account"

❌ "Date of Birth"
✅ "Date of birth"
```

"Predict" is only a verb. "Predictions" is the product. "predictions" is the generic noun. "Perps" is the product. "perps" is the generic noun. "Rewards" is the product. "rewards" is the generic noun.

"Snaps" is the platform. "A Snap" is one installed instance. Do not write "snap" for the platform.

"Pix" is the proper noun in "Pix key". "Key" stays generic.

No all-caps headlines (`predict.gtm_content.title` is "PREDICT AND WIN"; use "Predict and win").

Predictions market labels we write are sentence case. Keep team names and league names as proper nouns.

```
❌ "Exact Score" (`predict.sports_market_types.exact_score`)
✅ "Exact score"

❌ "1st Half Team Totals" (`predict.sports_market_types.soccer_first_half_team_totals`)
✅ "1st half team totals"

❌ "Both Teams Slay Baron Nashor"
✅ "Both teams slay Baron Nashor"
```

On mobile, those labels are our strings: `predict.sports_market_types.*`, `predict.outcome_groups.*`, and `predict.market_groups.*` in `locales/languages/en.json`. The market question on a card is not one of those strings. `PolymarketProvider` copies Polymarket's `question`, `groupItemTitle`, and event `title`, with light formatting only. Do not sentence-case that feed text in code. Team and league names inside it stay as the feed sent them. Team matching compares `groupItemTitle` to the feed's team name, so a casing rewrite would also break that match.

**PROPOSED.** Transaction Shield, MetaMask Swaps, and Basic functionality are not on the title-case list and are not confirmed as product names. Match the casing already shipped in that flow. Do not invent a third casing, and do not start a migration.

**PROPOSED.** For a feature toggle, prefer "Turn on" and "Turn off" over "Enable" and "Disable". Use one name per feature.

## Punctuation

### Periods

Use a period when the string is a complete sentence. Do not use a period on labels, headings, button text, tags, tab labels, or "Learn more".

```
✅ "Your transaction couldn't be completed, so it was canceled."
✅ "Network fee"
✅ "Turn on notifications"
❌ "Network fee."
❌ "Learn more."
❌ "Incorrect password. Try again"
✅ "Your password is incorrect. Try again."
```

### Exclamation points

Use an exclamation point only on the allowlist. Never on an error, a warning, a quiz result, a security instruction, or a routine success (a token added, an order placed, a login).

Confirmed allowlist:

- Finishing onboarding
- Wallet creation

```
✅ "Your wallet is ready!"
❌ "Let's get started!"
❌ "Wrong!"
❌ "Account successfully imported!"
❌ "“$1” was successfully added!"
```

**PROPOSED** remainder of the allowlist: a new-feature announcement of the same weight as a product milestone. The old example "The Ethereum Merge is here!" is in this unconfirmed set. Do not add other exclamation points.

### Ellipsis

Loading and in-progress text is a present participle. Do not trail off a sentence. Do not use a filler.

```
✅ "Loading your tokens..."
✅ "Processing deposit..."
❌ "Something went wrong...."
❌ "Hang tight"
❌ "Please wait"
```

Whether that ellipsis is three ASCII dots (`...`) or curly punctuation is an [open question](#open-questions). Do not migrate one form to the other. Shortened addresses stay `0x0000...0000`.

### Ampersands, commas, colons

Never use `&` where "and" works. Never use `+` instead of "and". "P&L" is an allowed abbreviation, so its ampersand stays.

Use the Oxford comma in lists of three or more.

Do not use a colon in a label or a heading.

```
❌ "Approve & submit"
✅ "Approve and submit"

❌ "Gas limit:"
✅ "Gas limit"

✅ "Tokens, NFTs, and DeFi"
❌ "Tokens, NFTs and DeFi"
```

### Em dash and bullets

Do not use an em dash. Rewrite with a period or a comma.

A bullet `•` is a data separator only ("Get USDC • Hyperliquid"). Do not use it in a sentence or as a list marker.

### Plurals and line breaks

Do not write "(s)" for one or many. "(s)" does not translate. Use a count and a separate string for the singular and the plural.

```
❌ "Successfully closed {{count}} position(s)" (`perps.close_all_modal.success_message`)
✅ "Closed 1 position" and "Closed {{count}} positions"
```

Do not put a newline inside a string. Split it into separate strings.

```
❌ "You don't have any open positions yet.\nStart trading to see your positions here." (`perps.position.list.empty_description`)
✅ One string for the state, and one string for the next step
```

### Emoji

One emoji is allowed at the end of a title in a celebratory moment, for example a Rewards celebration. No emoji in an error, a warning, or a confirmation.

## Numbers, dates, and durations

- Dates and clock times: `Jun 16 at 5:55 p.m.` Never ordinals (no "16th"). Never 24-hour time.
- Days: Mon, Tue, Wed, Thu, Fri, Sat, Sun
- Months: Jan, Feb, Mar, Apr, May, Jun, Jul, Aug, Sep, Oct, Nov, Dec
- Large amounts: `$500K`, `$20M`, `$100B`
- Thousands: comma separator (`100,000`). No exception for gas units.
- Numeric ranges: `1-20`, hyphen, no spaces (`5x-10x`). A hyphen never joins two phrases. Use a comma, or split the string.
- Duration ranges use words: "1 to 2 days"
- Spell out duration units: "1 minute", "5 minutes", "1 hour". Compact chips may use "1m", "1h", "24h".
- "about" means an estimate. "within" means a maximum. "up to" means an upper limit. Do not write "typically" or "should" for these.
- Addresses: `0x0000...0000`
- Do not hardcode "EST" or "EDT". Show the user's local time. If you cannot, write "ET".
- Written copy keeps `a.m.` and `p.m.` A time the locale formatter generates uses that formatter. Do not hand-build it, and do not switch written copy to `am` / `pm`.

## Buttons and actions

Sentence case. No punctuation. Default length is 1 to 3 words. Up to 5 words when the label includes a variable (a name, a price, or a ticker). Lead with the verb, except "Got it", "Not now", "Learn more", and "Back".

### Primary actions

| Purpose | Use | Do not use |
| --- | --- | --- |
| Move forward | Continue. "Next" only in a numbered step | Proceed, Submit, Accept |
| Transactions, signatures, and final review | Confirm | Sign |
| Spending caps and permissions | Approve | Confirm or Sign for these. Never "spend limit" or "allowance" in the label |

"Sign" is retired as a primary button label. Body copy may still say "sign" for the act on a hardware device ("Sign on your Ledger, then confirm in MetaMask"). The button in MetaMask is Confirm.

```
❌ "Sign" on a signature request
✅ "Confirm"

❌ "Approve spend limit" (`approve`)
✅ "Approve" or "Approve {{symbol}} spending cap" (`approveSpendingCap` is "Approve $1 spending cap")

❌ "Submit" / "Proceed" / "Accept"
✅ "Continue" or "Confirm", by the table
```

### Other buttons

| Label | Use |
| --- | --- |
| Got it | Acknowledge and dismiss. Retire "OK", "Ok", and "Understood" |
| Not now | Decline an optional prompt or upsell. Retire "Maybe later" and "No thanks" |
| Skip | Move past a step in a numbered sequence only |
| Cancel | Abort an action in progress. Nothing changes |
| Close | Dismiss. No action was taken |
| Done | Something was completed or saved |
| Back, Go back | Return to the previous step. Retire "Exit" |
| Try again | The only retry label. Retire "Retry". Offer it only when retrying can work. See [Errors](#errors) |

**PROPOSED.** "Yes" and "No" are allowed only when they are the position itself, as in Predictions. They are not confirmation buttons. `drawer.lock_ok` / `drawer.lock_cancel` are "Yes" / "No"; use "Lock" / "Cancel".

**PROPOSED.** Do not introduce "Reject". To decline a request, use Cancel.

### Remove, clear, delete, reset

| Verb | Use |
| --- | --- |
| Remove | Take something out of view that can be added again (a token, a network, an account) |
| Clear | Empty a list or a filter (search, history, filters) |
| Delete | Permanent destruction of data, such as MetaMetrics data |
| Reset | The wallet. Never "delete wallet" |

Retire "Erase". `login.reset_wallet_desc` says the wallet data "will be erased". Say what reset removes, and use "removed" or "reset", not "erased".

### Add funds

The user-facing action is "Add funds". Use "Deposit" only when it is the transaction type in an activity list.

## Links

| Label | Use |
| --- | --- |
| Learn more | Explanatory content. No period. "Learn more about [topic]" only when the destination is ambiguous |
| See all | Open the full list. Retire "View all", "Show all", and "See more" |
| Read more | Expand truncated text |
| Show more, Show less | Expand or collapse inline |

## Empty states, loading, and success

### Empty states

| Phrase | Situation |
| --- | --- |
| No [thing] found | A search or filter returned nothing |
| No [thing] yet | The user has not done this yet. Add a button for the action |
| No [thing] available | The system has none right now |

Retire "You don't have any…" and "Nothing to see yet…".

```
❌ "Your first perps trade could be your best." (`activity_view.empty_state.perps.description`)
❌ "Nothing to see yet. Add funds to your wallet to get started."
❌ "No tokens. No problem. Explore and buy tokens to batch sell." (`batchSellEmptyStateDescription`)
✅ "No perps trades yet"
✅ "No tokens to sell"
✅ "No quotes found"
```

### Loading

Present participle, then `...`. That includes in-progress statuses. No filler.

```
✅ "Loading your tokens..."
✅ "Checking spending cap..."
❌ "Checking token allowance..."
```

### Success

- Title: past participle. "Order placed", "Password changed", "Card added to Apple Wallet".
- Description, if there is one: a full sentence with a period. "Your deposit will arrive in about 5 minutes."
- No "successfully", "has been", or "was successful".
- An exclamation point only from the allowlist above.

```
❌ "Card Added Successfully" (`card.apple_pay_confirmation.title`)
❌ "was successfully added" (`toast.network_added`)
❌ "“$1” was successfully added!" (`newCustomTokenAdded`)
✅ "{{name}} added"
✅ "Order placed"
```

## Errors

Say what happened, then what the user can do. Pattern: `[Thing] [state]. [One action].`

Use "We couldn't…" only when the system itself failed.

```
✅ "Your password is incorrect. Try again."
✅ "We couldn't load your tokens. Try again."
✅ "We couldn't keep a secure connection with your phone. Check your internet connection and try again." (`add_device_error_connection`)
```

"Try again" only when retrying can work, such as a timeout, a dropped connection, or a password the user can re-enter. Otherwise name the next step. If there is no step, link to support. Never "Please try again" and never "Retry".

```
✅ "Not enough ETH to cover the network fee. Add ETH to continue."
❌ "Insufficient gas" (`bridge.insufficient_gas`, shown on the confirm button)
❌ "Please set a limit price" (`perps.order.validation.please_set_a_limit_price`)
✅ "Enter a limit price"
❌ "Deposit of {{currency}} has failed. Please try again, sorry for the inconvenience."
✅ "Your {{currency}} deposit didn't go through. Check your payment method."
```

In a tight space such as a toast, the fix can be the whole message. It still has to say what happened or what to do.

Never use "Error:", "please", "sorry", "unfortunately", or raw backend text.

Retire these as openers: "Failed to…", "Unable to…", "An unexpected error occurred".

"Something went wrong" is allowed only as a title, and only with a specific body under it. It is never the whole message, never the body, and never the start of a sentence. Prefer a specific title when the failure is known ("Couldn't create your wallet").

```
❌ `error_screen.title` "An error occurred" with no specific next step
❌ "Something went wrong, but don't worry!"
✅ Title "Something went wrong". Body "Your wallet and funds are safe. This screen didn't load. Try again."
```

Do not reuse a page-load string for a different failure. `somethingWentWrong` ("We couldn't load this page.") is for a page that did not load, not for an order, deposit, or withdraw.

```
❌ "Ethereum App Not Open" (`hardware_wallet.error.app_not_open`)
✅ "Open the Ethereum app on your device."
```

**PROPOSED.** Do not split one sentence across locale keys. The consent rule below is already confirmed for consent lines.

## Warnings

The title names the risk. Severity comes from the component (color and icon), not from the words. No "Alert", "Warning", "Heads up!", "Important!", or an inline "Warning:" or "Note:" prefix.

```
❌ "Warning: the transaction gas cost will account for more than {{percentOverDeposit}}% of your deposit."
✅ "The network fee is more than {{percentOverDeposit}}% of your deposit."

✅ "This site is suggesting a higher network fee than necessary. Edit the network fee to pay less." (`alertMessageSuggestedGasFeeHigh`)
✅ "You're sending assets to an address flagged by security partners. If this is a scam, your funds can't be recovered." (`blockaid_banner.transfer_farming_description`)
```

## Destructive confirmations

- The title names the action: "Remove this token?"
- The body says what will happen and what will not.
- The buttons repeat the verb: "Remove" / "Cancel".
- Retire "Are you sure?", "We are about to…", and "Would you like to…" / "Do you want to…".

```
❌ "Do you really want to lock your wallet?" with Yes / No (`drawer.lock_title`, `drawer.lock_ok`)
✅ "Lock your wallet?" with Lock / Cancel

❌ "Are you sure?" (`areYouSure`, `login.are_you_sure`)
✅ "This removes browser history from this device."
```

## Consent

"By continuing, you agree to [partner]'s Terms of Use."

Use the real document name (Terms of Use, Privacy Policy). One string, with the link inline. Do not split the sentence across keys. On mobile, do not say "clicking".

```
❌ "By continuing, I agree to Transaction Shield $1" (`shieldFooterAgreement`)
✅ "By continuing, you agree to the Terms of Use."
```

A checkbox that records the person's own acknowledgment may say "I understand that…". That is the only first-person exception.

## Forms

### Placeholders

A placeholder is a short action ("Enter amount", "Search tokens") or a format example ("name@domain.com"). Put instructions in helper text so they stay visible. Every field has a visible label.

### Field wording

For new copy, drop possessives in field prompts: "Enter password", "Enter email". Keep "your" in full sentences. Do not migrate existing onboarding strings, including "Enter your Secret Recovery Phrase" and "Enter your password", until content leadership signs off on that migration.

Mark an optional field with "(optional)".

"e.g." is allowed in helper text only, not in a title or in body copy.

### Referring to a UI label

Match the on-screen label exactly. Interpolate the same string key when you can, so the two cannot drift.

Write a path with a greater-than sign: "Settings > Security and privacy".

`wallet.display_nft_media_cta_new_2` and `onboarding_success.setting_security_privacy` say "Security and Privacy". The screen label is "Security and privacy".

## Wallet, account, and other nouns

A wallet holds one or more accounts.

| Term | Means | Use for |
| --- | --- | --- |
| Wallet | Everything controlled by one Secret Recovery Phrase, including all of its accounts | Create, import, back up, lock, reset |
| Account | One address, with its own balance and activity | Add, rename, switch, export the private key |

An account from an imported private key or a hardware wallet is still an account. Describe the origin: "Imported account", "Ledger account". "Ledger" stays capitalized. Do not call that account a wallet.

```
❌ Title "Wallet already exists" while the body treats the account as the thing being created, or the reverse
✅ `login.reset_wallet` "Reset wallet" for the wallet action
❌ A body that says the wallet will be "erased" or tells the user to type "Delete"
```

| Noun | Use |
| --- | --- |
| Tokens | The specific items the user holds |
| Assets | Tokens and NFTs together |
| Funds | Money moving in a flow ("Add funds") |
| Balance | An amount |

Authentication:

- Use the platform name when you know it (Face ID, Touch ID). Use "biometrics" for the generic case.
- Never "your biometric" as a noun.
- "Passcode" is the device passcode. "PIN" is an in-app code. They are not interchangeable.

**PROPOSED.** Say "NFT", not "collectible". `wallet.collectible` is "Collectible" and `wallet.collectibles` is "NFTs".

**PROPOSED.** "Disconnect" is for a site. "Revoke" is for a spending cap ("Revoking spending cap"). Do not swap them.

## Fees

Content leadership confirmed this fee rule, including where "gas" survives.

Name the fee by who is paid.

| Term | Who is paid |
| --- | --- |
| Network fee | The network. This is the fee a default flow shows |
| MetaMask fee | MetaMask |
| Provider fee | A third party. When the screen names the partner, use the partner's name instead. "Total fees" only when every fee is shown |
| Fee | Do not use this alone |

Retire "gas fee", "gas fees", and "transaction fee".

Retire "gas" in default flows, including buttons and errors. `bridge.insufficient_gas` is "Insufficient gas" next to a row labeled "Network fee". Use "Not enough [token] to cover the network fee."

These words appear only inside the advanced gas editor, as the control labels: Gas limit, Max base fee, Priority fee, and Gwei. Do not write "GWEI", "gas price", or "Gas Price: (GWEI)" (`custom_gas.gas_price`). In a sentence on that screen, use sentence case ("Raise the gas limit") and keep "Gwei" capped as the unit.

**PROPOSED.** The editor's user-facing entry point and title are "Advanced network fee". Pending confirmation from Ali Forrest.

Education may say "network fee (also called gas)" on the first mention. After that, say "network fee".

**PROPOSED.** Do not explain a network fee as a payment to miners or a "miner tip". `transaction.gas_education_1` ("Gas fees are paid to crypto miners…") and `edit_gas_fee_eip1559.learn_more_max_priority_fee` ("aka miner tip") are the pattern to retire.

### Paid by MetaMask

Use "Paid by MetaMask" only when MetaMask sponsors a network fee (gas sponsorship). The user would otherwise pay that fee, and MetaMask covers it. Confirmations and Activity may show it next to Network fee on eligible sponsored swaps and sends.

Do not use "Paid by MetaMask" when the MetaMask fee is $0 or waived. That fee is ours, so MetaMask is not paying anyone. Do not add a MetaMask fee row just to show it cancelled.

When the MetaMask fee is zero, prefer no MetaMask fee row, or a signal under the primary button such as a Promo badge. Honest labels are "No MetaMask fee" or "MetaMask fee waived". Do not show the waived MetaMask fee in dollars on a pre-swap upsell unless research or an A/B test supports it.

```
✅ Network fee row shows "Paid by MetaMask" for gas sponsorship (for example Monad, SEI, or eligible Solana swaps)
❌ MetaMask fee row shows "Paid by MetaMask" when the MetaMask fee is $0
✅ "No MetaMask fee" or a Promo badge under the primary button when the MetaMask fee is waived
```

Scope is product UI in mobile and extension, wherever fee rows, confirmations, or Activity show fee labels. Not marketing. Existing gas-sponsorship surfaces are correct as is.

## Secret Recovery Phrase and private key

Always write "Secret Recovery Phrase". Never "seed phrase", "SRP", or "mnemonic", including in a gloss.

Account group labels are "Secret Recovery Phrase 1", "Secret Recovery Phrase 2", and so on. `accounts.srp_index` is "SRP #{{index}}". Use "Secret Recovery Phrase {{index}}".

```
❌ "Using a 12, 18 or 24-word seed phrase" (`multichain_accounts.add_wallet_srp_description`, `importAWalletDescription`)
✅ "Using a 12, 18, or 24-word Secret Recovery Phrase"

❌ "Hold to reveal SRP" (`holdToRevealSRP`)
✅ "Hold to reveal Secret Recovery Phrase"
```

"Private key" is sentence case everywhere.

```
❌ "Hold to reveal Private Key" (`holdToRevealPrivateKey`)
✅ "Hold to reveal private key"
✅ `reveal_credential.private_key_text` "Private key"
```

## Spelling and word forms

American English. "canceled", not "cancelled". "authorizes", not "authorises". The existing example "so it was canceled" is the spelling to copy.

Two words for the verb, one word for the noun: "log in" / "login", "set up" / "setup", "back up" / "backup". "opt in" is the verb. "opt-in" is the adjective. "Backup and sync" may stay as the feature name. Where "sign in" and "log in" mean the same action, use "log in". Social login buttons are the exception: Apple and Google require "Sign in with Apple" and "Sign in with Google". Do not rewrite those.

## Abbreviations

Established trading terms are allowed: P&L, TP/SL, APR/APY, TWAP, USDC. Define the term on first use on that screen, or put the definition in a tooltip. Do not also write "PnL".

Spell out "Estimated". Use "Est." only when the space cannot fit the word.

Write "Gwei", not "GWEI". It still belongs only in the advanced editor, per [Fees](#fees).

## Network

**PROPOSED.** "Network" is what the user switches. "Chain ID" is the field label, with "ID" capped. Mid-sentence, write "chain ID". Do not use "chain" or "on-chain" as a synonym for network. `app_settings.primary_currency_desc` says "native currency of the chain"; that becomes "network currency" of that network.

## Glossary

| Term | Use | Don't use | Notes |
| --- | --- | --- | --- |
| Wallet | Wallet | account, when you mean the whole Secret Recovery Phrase and its accounts | Create, import, back up, lock, reset |
| Account | Account | wallet, when you mean one address | Add, rename, switch, export private key. "Imported account", "Ledger account" |
| Secret Recovery Phrase | Secret Recovery Phrase | seed phrase, SRP, mnemonic | Always spelled out. Groups: "Secret Recovery Phrase 1" |
| Private key | private key | Private Key, seed | Sentence case, including titles |
| Network fee | Network fee | gas, gas fee, transaction fee, a bare Fee | Default flows. Leadership confirmed this. Education may add "(also called gas)" once |
| MetaMask fee | MetaMask fee | Fee | The fee MetaMask is paid |
| Paid by MetaMask | Paid by MetaMask | Paid by MetaMask on a $0 or waived MetaMask fee | Only for a sponsored network fee. MetaMask covers a fee the user would otherwise pay |
| Provider fee | Provider fee, or the partner's name | Fee | Third party |
| Gas limit, Max base fee, Priority fee, Gwei | Those labels | gas price, GWEI, gas fee | Advanced editor only |
| Advanced network fee | Advanced network fee | Advanced gas, Gas fee | **PROPOSED** editor title |
| Spending cap | spending cap | allowance, spend limit, token allowance | Button is Approve. Do not say "allowance" for Tron daily resources |
| Confirm | Confirm | Sign, Proceed, Submit, Accept | Transactions, signatures, final review |
| Approve | Approve | Confirm, for a spending cap or permission | Spending caps and permissions |
| Continue | Continue | Next, except in a numbered step | Move forward |
| Try again | Try again | Retry, Please try again | Only when a retry can work |
| Got it | Got it | OK, Ok, Understood | Dismiss |
| Learn more | Learn more | Learn more. | No period |
| Network | network | chain, on-chain | **PROPOSED** for the chain synonym. "Chain ID" is the field |
| Site | site | dapp, dApp, ÐApps | |
| Local currency | local currency, or the currency name | fiat | Name the currency (USD, EUR) when one is meant. "Local currency" is the setting |
| Network currency | network currency | native currency | |
| Tokens | tokens | coins, cryptocurrency | "coin" only on Perps market screens. "crypto" is the category. "Assets" is tokens and NFTs. "Funds" move. "Balance" is an amount |
| NFT | NFT | collectible | **PROPOSED** for collectible |
| Reset wallet | Reset wallet | delete wallet, erase | |
| Add funds | Add funds | Deposit, except an activity-list type | |
| Smart account | smart account | smart contract account, Smart Account | |
| Money account | Money account | Money Account | Sentence case |
| Snaps | Snaps, a Snap | snap for the platform | |
| Perps, Predictions, Rewards | Product form, or lower for the generic noun | Predict as a noun | |
| Settings | Settings | settings, when it names the screen | Sub-screens stay sentence case |
| Terms of Use, Privacy Policy | Those titles | T&C, Terms and Conditions | MetaMask's own documents |
| Pix key | Pix key | PIX key, pix key | |
| X | X | Twitter, X (Twitter) | |
| Log in | log in (verb), login (noun) | sign in, for the same action | Social buttons stay "Sign in with Apple" and "Sign in with Google" |
| Back up | back up (verb), backup (noun) | backup as the verb | |
| P&L | P&L | PnL | Define on first use |
| Hyperliquid | Hyperliquid | HyperLiquid | Brand spelling. Migrate the capital L |

## Do / don't

Real strings from MetaMask Mobile (`en.json` keys) and MetaMask Extension (`messages.json` keys).

| Current | Use | Why |
| --- | --- | --- |
| "Insufficient gas" (`bridge.insufficient_gas`) | "Not enough ETH to cover the network fee." | The row beside it already says "Network fee". Name the token. The next step is to add it, not to retry blindly |
| MetaMask fee row labeled "Paid by MetaMask" when the MetaMask fee is $0 | No MetaMask fee row, or "No MetaMask fee" or a Promo badge under the primary button. Keep "Paid by MetaMask" only on a sponsored Network fee | "Paid by MetaMask" means MetaMask covers a network fee. A waived MetaMask fee is not MetaMask paying itself |
| "Gas Price: (GWEI)" (`custom_gas.gas_price`) | "Gas limit", "Max base fee", "Priority fee", "Gwei", and only in the advanced editor | Retired label, colon, and unit casing |
| "Increase allowance" (`transactions.increase_allowance`) | "Spending cap" as the label. "Approve" as the button | "Allowance" is retired. Approve is for a spending cap or a permission |
| "Approve & submit" (`predict_next.order_approval.approve`) | "Confirm" if this is a transaction or final review. "Approve" only if it is a spending cap or permission | Ampersand, and Approve is not a generic submit |
| "Using a 12, 18 or 24-word seed phrase" | "Using a 12, 18, or 24-word Secret Recovery Phrase" | Banned synonym, missing Oxford comma. Same text in `importAWalletDescription` |
| "SRP #{{index}}" (`accounts.srp_index`) | "Secret Recovery Phrase {{index}}" | Produces "Secret Recovery Phrase 1" |
| "Hold to reveal Private Key" | "Hold to reveal private key" | Sentence case |
| "Please, try to visit this page again." (`notificationsPageErrorContent`) | "This page didn't load. Try again." | "please", and a retry is plausible for a page load |
| "Your password is incorrect. Try again." | Keep | State, then an action that can work. Replaces a bare "Incorrect password" |
| "Card Added Successfully" | "Card added to Apple Wallet" | Title case, "successfully" |
| "Wrong! No one can help get your Secret Recovery Phrase back" | "No one can recover your Secret Recovery Phrase." | Exclamation on an error. Same for "Nope!" |
| "Your wallet is ready!" (`onboarding_success.wallet_ready`) | Keep, for finishing onboarding or wallet creation | On the exclamation allowlist |
| "Learn more." (`app_settings.learn_more` and `learnMore` variants) | "Learn more" | No period |
| "Dapp browser" / "Dapps" / "ÐApps" | "Sites" | `trending.tabs.dapps` already says "Sites" |
| "Display fiat values in using a specific currency throughout the application." (`app_settings.conversion_desc`) | "Show values in your local currency throughout MetaMask." | This setting does not name one currency. When a screen does, use that name (USD, EUR), not "fiat" |
| "HyperLiquid" | "Hyperliquid" | Brand spelling. Migrate it |
| "Exact Score" (`predict.sports_market_types.exact_score`) | "Exact score" | Our label, sentence case. The card's question still comes from the Polymarket feed |
| "Select the account(s) to use on this site:" (`accounts.select_accounts_description`) | "Select the account to use on this site." and a plural string | "(s)" does not translate |
| "This site is suggesting a higher network fee than necessary. Edit the network fee to pay less." | Keep | Names the actor, the problem, and the action |
| "Back up your Secret Recovery Phrase to keep your wallet and funds secure." (`backupApprovalNotice`) | Keep | Calm, and the right noun for the wallet |
| "File import not working? Click here!" | "Try a different file" | Question, "click here", and an exclamation |
| "MetaMask is not connected to this site. To connect to a web3 site, find and click the connect button." | "MetaMask isn't connected to this site yet. You'll be asked to connect when the site needs an account." | "web3", "click", and a gesture instead of the situation |

## PROPOSED

Drafts for Ali Forrest. Not confirmed.

1. **Tone.** Direct and calm. Name the object and the next step. Do not apologize, cheer, or warn with punctuation.
2. **Exclamation allowlist, remainder.** New-feature announcements, such as "The Ethereum Merge is here!" Finishing onboarding and wallet creation are already confirmed.
3. **Turn on / Turn off.** Prefer these to Enable / Disable for a feature toggle. One name per feature.
4. **Yes / No.** Only when they are the Predictions position, not a confirmation.
5. **Reject.** Do not introduce it. Decline with Cancel.
6. **Unlisted names.** Transaction Shield, MetaMask Swaps, and Basic functionality: match the casing already shipped. Do not migrate them.
7. **Collectible.** Use NFT, not collectible.
8. **Disconnect / revoke.** Disconnect a site. Revoke a spending cap.
9. **Split strings.** Do not split one sentence across locale keys.
10. **Miners.** Do not explain a network fee as a payment to miners or a miner tip.
11. **Advanced network fee.** Pending Ali. Use this as the advanced editor's entry point and title.
12. **Network vs chain.** Network for what the user switches. Chain ID only as the field. Do not say "chain" or "on-chain" for a network.

Client-specific drafts are in the mobile and extension overlays: `toSentenceCase`, locale files, tap vs click, developer strings, translator descriptions, and activity-row descriptions.

## Open questions

Content leadership has not decided this. Do not enforce it, do not lint it, and do not migrate strings to satisfy either side.

**Loading ellipsis and curly punctuation.** Loading text as three ASCII dots (`...`, rule 10) contradicts curly apostrophes, quotes, and punctuation everywhere (rule 16). Corey Janssen asked for one approach. Until that choice is made, do not require `...`, do not require `…`, and do not require curly quotes or apostrophes. Do not migrate a string from one form to the other. The rest of the loading rule still applies: a present participle, no "Hang tight", and no "Please wait". Address abbreviations stay `0x0000...0000`.

## Checklist

Before you finish a user-facing string:

- Sentence case, unless the word is on the title-case list. "Private key" is sentence case. "Secret Recovery Phrase" is spelled out. Predictions labels we write are sentence case, with team and league names left as proper nouns. "Hyperliquid" uses that spelling.
- Period only on a full sentence. No em dash. No `&` for "and". No "(s)". No newline inside a string. Do not enforce curly quotes or a specific loading ellipsis.
- Button and link come from the tables. No Sign, Proceed, Submit, Accept, Retry, OK, or "Learn more." Social buttons may say "Sign in with Apple" or "Sign in with Google".
- Wallet, account, network fee, and spending cap match the glossary. No "fiat". No "allowance", including on Tron. "coin" only on a Perps market screen.
- "Paid by MetaMask" only for sponsored network fees, never for a $0 MetaMask fee.
- An error is a state plus an action. "Try again" only when a retry can work. "Something went wrong" is only a title with a specific body.
- No "please" or "successfully". Exclamation points only for finishing onboarding or wallet creation.
- Empty state is "No [thing] found", "No [thing] yet", or "No [thing] available".
- No hardcoded EST or EDT. Written clock times use `a.m.` and `p.m.`
- You did not enforce the open punctuation question, and you did not rewrite an existing onboarding field prompt.
