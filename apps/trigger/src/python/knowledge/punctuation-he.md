# Punctuation, Numbers, and Units — Hebrew (finance domain)

Typography and number-handling rules for Hebrew finance copy. Pairs with
`bidi-rules.md` (RTL/LTR mixing) and `brand-voice-he.md` (banned punctuation
like `!`).

This file is read by Pass B after the voice and patterns files. Treat every
rule below as a hard constraint.

---

## Quotation marks

| Context | Use | Example |
|---|---|---|
| English keyword inside Hebrew sentence (CTA, quoted command) | Straight ASCII `"..."` | `תגיבו "ROTH" ואני אשלח את המדריך` |
| Hebrew quoting Hebrew (rare) | Hebrew quotation `״...״` | only when truly quoting speech |
| Inline emphasis | **Bold** or *italic* — never quotes | use `body_emphasis` JSON field, not quotes |
| Hebrew acronyms | Gershayim `״` (U+05F4) | `ש״ח`, `ארה״ב`, `מנכ״ל`, `שק״ל` |
| Single-letter abbreviation | Geresh `׳` (U+05F3) | `ד״ר`, `ע׳ 5` |

Default to straight quotes. Never mix curly + straight in the same slide.

---

## Apostrophes (geresh)

The Hebrew geresh `׳` is used for:
- **Foreign letter representation**: `ג׳`, `ז׳`, `צ׳` — for sounds like `ג׳ינס` ("jeans") or `צ׳ק` ("check")
- **Hebrew abbreviation**: `שיב׳ל`, `ע׳`

Never use the ASCII `'` apostrophe inside Hebrew words.

---

## Dashes

| Mark | Width | Use |
|---|---|---|
| **Em-dash** `—` (U+2014) | Widest | Sentence-level separator. `Roth IRA — הקרן ששווה לפתוח עכשיו` |
| **En-dash** `–` (U+2013) | Medium | Avoided in this voice. For ranges, use Hebrew `עד` or `בין X ל-Y`. |
| **Hyphen-minus** `-` (U+002D) | Shortest | Hebrew preposition + English term in body (`ל-Roth IRA`); compound English (`pre-tax`); negative numbers |

Spacing:
- **Em-dash in headlines**: surround with single spaces. `401k — לא מה שחשבת`
- **Em-dash in dense body**: also single-spaced
- **Hyphen in compounds**: no spaces. `pre-tax`, `tax-advantaged`

Banned: double-hyphen `--` (use real em-dash), spaced hyphen as fake en-dash
`5 - 10` (use `5–10` or rewrite to `בין 5 ל-10`).

---

## Numbers

### Digit form

Always use Western Arabic digits (`0–9`). Never spell out in Hebrew letters /
gematria for finance content.

- ✅ `10`, `47,000`, `90%`, `4.5`, `2024`, `$5,000`
- ❌ `י׳`, `מ״ז אלף`

### Thousand separator

Comma `,`:
- ✅ `47,000 ש״ח`, `1,200,000`, `$30,000`
- ❌ `47000`, `47.000`, `47׳000`

For numbers under 1,000: no separator (`500`, `999`).

### Decimal point

Period `.`:
- ✅ `3.14`, `4.5%`, `$0.04`
- ❌ `3,14`

### Percentages

`%` directly attached to the digit, no space:
- ✅ `90%`, `70% מהמשקיעים`, `99%`, `0.04% דמי ניהול`
- ❌ `90 %`, `אחוזים 90`

### Multipliers

Two patterns approved:
- `פי N` for N-times: `פי 10`, `פי 3`
- `xN` for compact display: `x10` (used where space is tight)

### Counting + nouns

Hebrew has dual-form for "two" + masculine/feminine agreement. The voice
cares about how Israelis actually write, not academic correctness:

| English | Acceptable Hebrew | Notes |
|---|---|---|
| 3 mistakes | `3 טעויות` | digit + plural noun is the natural form |
| 5 ETFs | `5 ETFs` | English brand term keeps English plural-s |
| 50 stocks | `50 מניות` | Hebrew plural for translated terms |
| 8 hours | `8 שעות` | digit + plural |
| 1 year | `שנה אחת` or `שנה` | spell out only when emphatic |
| 2 days | `יומיים` | dual form, more natural than `2 ימים` |
| 2 weeks | `שבועיים` | dual form |
| 2 hours | `שעתיים` | dual form |
| 2 years | `שנתיים` | dual form |
| 3 of the mistakes | `שלושת הטעויות` | construct (`שלושת`) before definite plural |

When in doubt: read it aloud. If a real Israeli would say it, ship it.

---

## Currency and money

The two contexts:

### US-context content (Roth IRA, 401k, $/dollar amounts)

- ✅ `$5,000 לשנה`, `$7,000 הוא הספוט המקסימום`, `$0.04 לחיסכון`
- ❌ `5000$`, `$ 5,000`

When discussing per-unit cost: `$0.04 לתמונה`, `$2 לעסקה`.

### Israeli-context content (קרן השתלמות, פנסיה, ש״ח amounts)

- `5,000 ש״ח` (Hebrew form, default)
- `₪5,000` (compact form, acceptable for tight headlines)
- Never `5,000 NIS` (English currency code — feels stiff)

### Conversions

When a US-context source mentions `$5,000` and the Hebrew adaptation
references Israeli context, convert to a round shekel figure (`~17,000 ש״ח`)
rather than a precise FX-pegged number that goes stale. Or keep `$` if the
context is clearly the US system (e.g. specifically about US tax law).

---

## Time and durations

Western digits + Hebrew unit:
- `3 דקות`, `90 שניות`, `8 שעות`, `30 ימים`, `שבועיים` (dual form preferred over `2 שבועות`)

### "Less than" / "more than"

- `פחות מ-3 שנים` (dash form attaching `מ-` to the digit)
- `יותר מ-50 ETFs`
- `מתחת ל-30%`

### Date format

- Code/log/file: ISO `YYYY-MM-DD`
- Slide copy (rendered publicly): natural Hebrew form
  - ✅ `4 במאי 2025`, `מאי 2025`, `אתמול`, `השבוע שעבר`
  - Avoid numeric-only dates in slide copy unless the precision matters

### Year

Bare year is fine: `2025`, `ב-2025`, `מאז 2020`.

---

## Units and finance terms

| Concept | Hebrew | Notes |
|---|---|---|
| dollar | `$` symbol or `דולר` (in flowing prose) | Symbol preferred in headlines |
| shekel | `ש״ח` or `₪` | `ש״ח` is the default; `₪` for tight space |
| stock | `מניה / מניות` | Hebrew |
| ETF | `ETF` (English) | per `english-terms-whitelist.json` |
| bond | `אג״ח` (Hebrew acronym for אגרת חוב) | Standard Hebrew finance term |
| fund | `קרן / קרנות` | Hebrew (e.g. קרן השתלמות, קרן פנסיה) |
| investment | `השקעה / השקעות` | Hebrew |
| portfolio | `תיק (השקעות)` | Hebrew |
| dividend | `דיבידנד` | Loanword, accepted |
| compound interest | `ריבית דריבית` | Hebrew, idiomatic |
| inflation | `אינפלציה` | Loanword, accepted |
| 401k | `401k` (English) | Brand-style, keep verbatim |
| Roth IRA | `Roth IRA` (English) | Same |
| pension | `פנסיה` | Hebrew (Israeli system) |
| mortgage | `משכנתא` | Hebrew |
| tax | `מס / מסים` | Hebrew |
| follower / followers | `עוקב / עוקבים` | Hebrew (social media) |
| post / posts | `פוסט / פוסטים` | Loanword, accepted |
| comment / comments | `תגובה / תגובות` | Hebrew |

---

## Sentence-final punctuation

| Mark | Use |
|---|---|
| `.` | Default sentence end (left edge in RTL render) |
| `?` | Genuine questions only |
| `:` | Lists / labels / dramatic turns. `הסיבה: ריבית דריבית` is a strong pattern. |
| `!` | **BANNED** — typography is the energy |
| `…` | Single character, sparingly |
| `;` | **AVOID** — sounds academic in Hebrew. Split into two sentences. |

### Trailing punctuation in headlines

Slide-1 main headlines and kickers do **not** carry trailing periods:
- ✅ `Roth IRA לפנסיה` (no period)
- ✅ `טופ 5` (no period)
- ❌ `Roth IRA לפנסיה.`

Slide-2 transitions, tip bodies, CTA headlines: **trailing period is correct**:
- ✅ `אבל אף אחד לא טורח להגדיר את זה.`
- ✅ `עקבו לעוד.`

---

## The 5-second test

Before any Hebrew copy ships, scan for:

- [ ] No `!`
- [ ] No `;`
- [ ] No double punctuation (`!?`, `?!`, `..`, `--`)
- [ ] Periods only at logical sentence ends
- [ ] Numbers as digits, with comma thousand separator
- [ ] `%` glued to digit, no space
- [ ] Em-dash `—` (real one), not double-hyphen `--`
- [ ] No straight ASCII apostrophes inside Hebrew words
- [ ] Dual-form (`יומיים`, `שעתיים`, `שנתיים`) for "two of X"
- [ ] Slide-1 headlines have no trailing period
- [ ] Tip bodies and CTA headlines do have trailing periods
- [ ] Currency symbol position matches context (US: `$5,000`, Israeli: `5,000 ש״ח`)

If any fails, regenerate.
