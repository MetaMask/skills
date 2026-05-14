---
name: formatting-rules
domain: perps
description: Decimal and significant-digit formatting rules for perps price display
---

# Formatting Rules

## Significant Digits

A significant digit contributes to precision, excluding leading zeros.

| Rule | Example | Sig Digs |
|---|---|---|
| Non-zero digits always significant | 123.45 | 5 |
| Zeros between non-zeros significant | 1002 | 4 |
| Leading zeros not significant | 0.00123 | 3 |
| Trailing zeros significant with decimal | 1.230 | 4 |

## General Rules

- Max 6 decimals (matches Hyperliquid). Never exceed.
- Hide trailing zeros: `1.230` -> `1.23`, `1.000` -> `1`
- Apply sig digs, cap decimals at 6
- Sig digs by absolute value range:
  - `> $100,000`: 6 sig digs
  - `$100,000 > x > $0.01`: 5 sig digs
  - `< $0.01`: 4 sig digs

## Decimal Display by Price Range (FiatRangeConfig)

| Range | Min Dec | Max Dec | Sig Digs | Example Input | Output |
|---|---|---|---|---|---|
| \|v\| > 10,000 | 0 | 0 | 5 (6 if >100k) | 12345.67 | 12346 |
| \|v\| > 1,000 | 0 | 1 | 5 | 1234.56 | 1234.6 |
| \|v\| > 100 | 0 | 2 | 5 | 123.456 | 123.46 |
| \|v\| > 10 | 0 | 4 | 5 | 12.34567 | 12.346 |
| \|v\| <= 10 | 2 | 6 | 5 (4 if <0.01) | 1.3445555 | 1.3446 |
| \|v\| <= 10 | 2 | 6 | 5 | 0.333333 | 0.33333 |
| \|v\| <= 10 | 2 | 6 | 4 | 0.004236 | 0.004236 |
| \|v\| <= 10 | 2 | 6 | 4 | 0.0000006 | 0.000001 |
| \|v\| <= 10 | 2 | 6 | 4 | 0.0000004 | 0 |

## Platform Status

| Platform | Implementation | Status |
|---|---|---|
| Mobile | `formatPerpsFiat` in `app/components/UI/Perps/utils/formatUtils.ts` | Correct -- adaptive sig-dig by range |
| Extension | `formatCurrencyWithMinThreshold`, `formatNumber({min:2,max:2})`, `.toFixed(2)` | Wrong -- no sig-dig logic |

**Rule**: Do NOT add more `.toFixed(2)` on extension. Use `formatCurrencyWithMinThreshold` as interim. Target: mobile's `formatPerpsFiat` behavior.
