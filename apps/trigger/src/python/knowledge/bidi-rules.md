# BIDI Rules — Hebrew + English mixed text (finance domain)

How to compose, render, and validate Hebrew text that contains English finance
brand names, currency symbols, and numbers. This is the project's most
technically failure-prone surface — most "AI Hebrew" failures in image
generation are BIDI failures, not vocabulary failures.

This file is read by:
1. **Pass B (`hebrew-reauthor-prompt.md`)** — composes the Hebrew JSON.
2. **Pass C (qa-rubric)** — validates the composed output.
3. **The slide-editor chat** — when the client asks for an edit, the
   chat must obey these same rules.

---

## The fundamentals

### Hebrew reads right-to-left, English reads left-to-right

Hebrew paragraph direction is **RTL**. English words embedded in Hebrew text
are **LTR islands** — internally each English word reads left-to-right, but
the word's **position in the line** is determined by Hebrew RTL flow.

### The "first word" rule (the rule that breaks everything)

> **The first word of a Hebrew sentence is on the RIGHT side of the line.**

If a sentence begins with an English word in Hebrew context, that English
word lands on the **right** end of the line — even though English itself
reads L→R.

This is the single rule image generators get wrong most often.

---

## Canonical mixed-text examples (finance)

Reference patterns. Every Hebrew line with embedded English finance terms
should follow one of these structures.

### Example 1 — brand on right, payoff on left
> **`Roth IRA יחסוך לך עשרות אלפי ש״ח על המס`**

| Reading order | Word | Language | Position |
|---|---|---|---|
| 1st | `Roth IRA` | English | RIGHTMOST |
| 2nd | `יחסוך` | Hebrew | right-of-center |
| 3rd | `לך` | Hebrew | center |
| 4th | `עשרות אלפי` | Hebrew | center-left |
| 5th | `ש״ח` | Hebrew | left |
| 6th | `על המס` | Hebrew | LEFTMOST |

**`Roth IRA` sits on the right because it's the first word read.** Internal
letter order of `Roth IRA` stays `R-o-t-h I-R-A` (left-to-right within the
phrase) — never mirrored.

### Example 2 — number on the left
> **`חסוך 1,500 ש״ח כל חודש`**
- `חסוך` is rightmost (first read in RTL)
- `1,500` is in the middle (numeric LTR island, digits in natural order)
- `ש״ח` reads as a Hebrew word on the left

### Example 3 — percentage glued to digit
> **`ETF במחיר נמוך גובה רק 0.04% דמי ניהול`**
- `ETF` rightmost (first word)
- `0.04%` near left — `%` glued to digit, no space

---

## Composition rules (for Pass B)

### R1 — Hebrew preposition + English term spacing

When a Hebrew preposition (`ל`, `ב`, `מ`, `ה`, `ש`, `ו`) prefixes an English
finance term in **headline / hero text**, **insert a space**. In **body /
paragraph text**, the dash form is acceptable.

| Context | Use | Example |
|---|---|---|
| Headline / hero / hook | space | `ל Roth IRA`, `עם ETF`, `ב 401k` |
| Body / paragraph (dense) | dash OK | `ל-Roth IRA` acceptable |
| Image-gen rendered text | always space | dash glyph clusters with English letters |

### R2 — English word internal order is preserved

Internal letters of an English word are **always left-to-right**, even when
the word sits on the right side of an RTL line.

- ✅ `Vanguard` → V, a, n, g, u, a, r, d
- ❌ `draugnaV` (mirrored — common image-gen failure)

### R3 — Numbers stay as Western Arabic digits

Western digits (`0–9`) stay as digits, **not as Hebrew letters with gematria**.

- ✅ `פי 10`, `90%`, `47,000 ש״ח`, `$5,000`
- ❌ `פי י׳`, `צ׳%`

Multi-digit numbers keep their digit order:
- ✅ `1080`, `47,000`
- ❌ `0801`, `000,74`

### R4 — Punctuation position

| Mark | Behavior in Hebrew context |
|---|---|
| `.` (period) | At the **logical end** — visually on the **left** of the line |
| `,` (comma) | At logical position — visually appears on the left of the word it follows |
| `?` | At logical end — left side |
| `:` | At logical end — left side |
| `"…"` (straight quotes) | Wraps the quoted token; image-gen prompts must specify open/close positions |
| `״` (Hebrew gershayim) | For Hebrew acronyms only (`ש״ח`, `ארה״ב`); never for English-style quotation |
| `—` (em-dash) | Allowed as separator in headlines (`Roth IRA — הקרן ששווה לפתוח עכשיו`) |
| `!` | **BANNED** in this voice |

### R5 — Lead-magnet keyword capitalization

Lead-magnet CTAs use a quoted English keyword. The keyword is always
**Capitalized** (sentence case):

- ✅ `תגיבו "ROTH" ואני אשלח את המדריך המלא`
- ✅ `תגיבו "ETF" ואני אשלח את ה checklist`
- ❌ `תגיבו "roth" ...`
- ❌ `תגיבו "ROTH IRA" ...` (don't ALL-CAPS the keyword if it isn't already an acronym)

### R6 — Currency symbols and percentages

| Symbol | Position rule | Example |
|---|---|---|
| `$` | Before the digit, no space | `$5,000`, `$0.04` |
| `₪` | Before or after digit acceptable; prefer before for tightness | `₪5`, or write `5 ש״ח` (Hebrew form) |
| `%` | Glued directly to digit, no space | `90%`, `0.04%` |
| `ש״ח` | After the digit, with space | `47,000 ש״ח`, `1,500 ש״ח` |

Pick `$` when the source content is US-context (a Roth IRA video, a 401k
discussion) and `ש״ח` when adapting to Israeli context (cost-of-living
examples, Israeli pension rules).

### R7 — Handles, repos, version strings preserved

Handles (`@personalfinancetips`), brand names with mixed case (`401k`,
`403b`), and version strings are **never translated** and **never broken
across BIDI boundaries**. They are atomic LTR tokens.

- ✅ `@personalfinancetips`, `401k`, `403b`, `S&P 500`
- ❌ Translating any of those, splitting them, or letter-mirroring them

---

## Validation checklist

Before any Hebrew slide ships (image-gen or HTML render), verify:

- [ ] Every Hebrew word has correct glyphs (no hallucinated lookalike letters)
- [ ] No nikud (vowel dots) on Hebrew letters unless explicitly requested
- [ ] First English word of a Hebrew sentence is on the **RIGHT** end of its line
- [ ] Numbers are at the logical sentence end (visually leftmost for sentence-final)
- [ ] No mirrored English letters (no `draugnaV`, no `kr04` instead of `401k`)
- [ ] `Roth IRA`, `ETF`, `S&P 500` rendered with exact mixed case
- [ ] Quoted lead-magnet keyword Capitalized (`"ETF"`, not `"etf"`)
- [ ] Punctuation at correct logical position
- [ ] No banned characters: `!` (exclamation), Hebrew `״` outside acronym context

If any check fails: regenerate.
