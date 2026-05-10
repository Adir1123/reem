# QA Rubric — Hebrew Quality Scoring (Pass C)

The 1–10 rubric a critic LLM (Claude Sonnet 4.6) applies to every Hebrew
slide produced by Pass B. Slides scoring below **8** trigger regeneration
(max 2 retries before the slide is flagged for human review).

This rubric exists because subjective vibes don't scale. Every score must
come from explicit dimensions and be defensible.

---

## How to use this rubric (instructions for the critic LLM)

The critic receives:
- The original English `slide_brief` (slides_en[i])
- The Hebrew output from Pass B (`slides_he[i]`)
- All knowledge files in `knowledge/` (brand-voice, copy-patterns,
  english-terms-whitelist, bidi-rules, punctuation, hook, this rubric)

For each Hebrew slide, the critic produces a JSON object:

```json
{
  "slide_index": 3,
  "hard_fails": [],
  "scores": {
    "nativeness": 9,
    "voice_match": 8,
    "term_correctness": 10,
    "bidi_correctness": 10,
    "punctuation_correctness": 9,
    "pattern_fit": 8,
    "specificity": 9
  },
  "weighted_score": 8.9,
  "recommend": "ship",
  "notes": "Reads native. Slight register drift in second clause."
}
```

### Scoring algorithm

1. Run all **hard-fail checks** (Section A). Any hard fail → `weighted_score = 0`,
   `recommend = regenerate`, list the fails. Skip dimension scoring.
2. Score each **dimension** (Sections B1–B7) on 1–10.
3. Compute weighted score:
   ```
   weighted_score = 0.20 * nativeness
                  + 0.20 * voice_match
                  + 0.15 * term_correctness
                  + 0.15 * bidi_correctness
                  + 0.10 * punctuation_correctness
                  + 0.10 * pattern_fit
                  + 0.10 * specificity
   ```
4. Set `recommend`:
   - `>= 9.0` → `ship`
   - `8.0–8.9` → `ship` (acceptable)
   - `7.0–7.9` → `consider_regenerate`
   - `< 7.0` → `regenerate`

---

## Section A — Hard-fail checks (zero tolerance)

If any one triggers, score = 0 and the slide must regenerate. No averaging,
no partial credit.

| Check | Hard fail when... | Reference |
|---|---|---|
| **Banned word — ברנד** | Text contains `ברנד` | `english-terms-whitelist.json` |
| **Banned word — טמפלייט** | Text contains `טמפלייט` | same |
| **Banned word — קונטרול** | Text contains `קונטרול` | same |
| **Banned word — האק** | Text contains `האק` | same |
| **Banned word — אינווסטמנט** | Text contains `אינווסטמנט` | same |
| **Banned word — סייב** | Text contains `סייב` (as a Hebrew word) | same |
| **Hebrew `-ים` on English root** | Text contains `ETF-ים`, `IRA-ים`, `401k-ים`, `RSU-ים`, `MCP-ים` | `english-terms-whitelist.json` rules.plural_marker |
| **Exclamation point** | Any `!` in slide copy | `brand-voice-he.md` banned punctuation |
| **Semicolon** | Any `;` in slide copy | `punctuation-he.md` |
| **Slang banned in voice** | Any of: `סבבה`, `מטורף`, `גאוני`, `וואלה`, `הזוי`, `ממש` (as filler), `בא לי` | `brand-voice-he.md` banned slang |
| **Motivational cliché hook** | Hook contains: `מוכן/ה לשנות את המשחק`, `הגיע הזמן`, `העלה הילוך`, `לרמה הבאה`, `המהפכה האמיתית`, `ישנה את הכל`, `גלה את הסוד` | `hook.md` banned hooks |
| **`הנה` opener** | Sentence starts with `הנה` | `brand-voice-he.md` |
| **AI-translated calque from banned list** | Text contains: `להיות בעל היכולת`, `באמצעות שימוש ב`, `על מנת ל`, `במקרה שאתה רוצה`, `יש את האפשרות`, `הוא מספק לך את היכולת`, `ב-X% מהמקרים`, `לבצע פעולה של` | `brand-voice-he.md` |
| **Over-formal register markers** | Body contains: `יש להבין כי`, `ניתן ל...` (in body), `הינו`, `כאמור`, `בנוסף לכך`, `אשר`, `על ידי כך ש` | `brand-voice-he.md` |
| **Asterisk markers** | Slide copy contains literal `*…*`, `**…**`, `__…__`, `_…_` markdown emphasis markers | Pass A/B post-processor strips, but flag if any survive |
| **Brand/account name corruption** | A handle, account type (`Roth IRA`, `401k`), broker name (`Vanguard`), or version was translated or letter-altered | `bidi-rules.md` R7 |
| **Hebrew lookalike letters** | Hebrew text contains hallucinated lookalike glyphs instead of real Unicode Hebrew letters | `bidi-rules.md` validation |
| **English word internal mirroring** | An English word appears mirrored (e.g. `draugnaV` instead of `Vanguard`) | `bidi-rules.md` R2 |
| **First English word on wrong side** | A Hebrew sentence's first English word is rendered on the LEFT instead of RIGHT in the visual line | `bidi-rules.md` first-word rule |
| **English plural translated** | `ETFs` rendered as `ETF-ים` or similar | `english-terms-whitelist.json` |

---

## Section B — Dimension scoring (1–10 each)

Each dimension scored independently. Use the band descriptors as anchors.
Be honest — give 10s only when the slide could have been written by a
top-tier Hebrew finance copywriter.

### B1 — Nativeness (weight 0.20)

Does this read like a real Israeli wrote it, or like an LLM translated it?

| Score | Description |
|---|---|
| 10 | Indistinguishable from a literate native Israeli finance creator. The 3-second-read test passes effortlessly. |
| 9 | Native quality. Maybe one tiny phrasing choice a human would have made differently. |
| 7–8 | Reads native at first pass. A second read finds 1–2 phrases that feel slightly translated but don't break flow. |
| 5–6 | Mostly native, but obvious calque or over-formal moments. A native reader would notice. |
| 3–4 | Reads as translated Hebrew. Multiple English-shaped sentences. |
| 1–2 | Clearly machine-translated. The voice is gone. |

**Specific deductions**:
- English-structured sentence rhythm (subject-verb-object every line) → -1
- Over-formal register words (`בראשונה`, `אשר`, `הינו`) outside formal context → -2
- Generic "AI Hebrew" filler (`בעולם של היום...`, `כאשר אנו מדברים על...`) → -2
- Unnatural word order → -1

### B2 — Voice Match (weight 0.20)

Does this match the polished Israeli editorial finance persona from
`brand-voice-he.md`?

| Score | Description |
|---|---|
| 10 | Voice is unmistakable. Matches `copy-patterns-he.md` examples in tone, restraint, energy. |
| 9 | Voice is consistent. Maybe one beat slightly off. |
| 7–8 | Voice is present but slightly off — too academic, too hype-y, or too casual. |
| 5–6 | Voice drifts. Reads as a different creator. |
| 3–4 | Voice is wrong — corporate, marketing-y, amateur. |
| 1–2 | Voice opposite of brand (sales-y, hype reel, motivational). |

**Specific deductions**:
- Cliché motivational openers → -3
- Over-hyped language (`מהפכני`, `פורץ דרך`) → -2
- Decorative-instead-of-direct (`המסע המופלא של...`) → -2
- Performance-of-excitement (every sentence trying too hard) → -2
- Restraint maintained (typography is the energy) → +1

### B3 — Term Correctness (weight 0.15)

Does the Hebrew respect `english-terms-whitelist.json`?

| Score | Description |
|---|---|
| 10 | Every English term that should stay English stays. Every translatable term renders correctly in Hebrew. |
| 9 | One minor borderline call but defensible. |
| 7–8 | Mostly right; one wrong call (e.g. translated `ETF` to `קרן סל`, kept `investment` English instead of `השקעה`). |
| 5–6 | Multiple wrong calls. Translation policy not followed. |
| 1–4 | Wholesale violations. |

**Specific checks**:
- `Roth IRA`, `401k`, `403b`, `HSA` stay English ✓
- `Vanguard`, `Fidelity`, `Schwab` stay English ✓
- `ETF`, `REIT`, `S&P 500`, `RSU` stay English ✓
- `IRS`, `FDIC` stay English ✓
- `investment` → `השקעה` in body copy ✓
- `savings` → `חיסכון` ✓
- `tax` → `מס` ✓
- `mortgage` → `משכנתא` ✓
- `brand` → `מותג` (never `ברנד`) ✓
- English plurals on English roots (no `-ים`) ✓

### B4 — BIDI Correctness (weight 0.15)

Does the Hebrew + English mixed text follow `bidi-rules.md`?

This dimension is critical for headlines / hero text since it directly
affects rendering. For pure-Hebrew slides with no English: default to 10.

| Score | Description |
|---|---|
| 10 | All BIDI rules respected. `Roth IRA יחסוך לך עשרות אלפי ש״ח על המס`-style discipline. |
| 9 | One minor judgement call (e.g. dash vs space for preposition + English in body context). |
| 7–8 | One real BIDI issue that survives into rendering but is salvageable. |
| 5–6 | Multiple BIDI issues. |
| 1–4 | Hebrew/English mixing wrong throughout. |

**Specific checks**:
- Preposition + English: space in headlines (`ל Roth IRA`), dash OK in body (`ל-Roth IRA`) ✓
- Numbers as Western digits, in correct logical position ✓
- Lead-magnet keyword Capitalized (`"Roth"`, not `"roth"`) ✓
- Brand/account name preserved verbatim (`Roth IRA`, not `Roth Ira`) ✓
- No hallucinated Hebrew lookalike letters ✓

### B5 — Punctuation Correctness (weight 0.10)

Does the Hebrew follow `punctuation-he.md`?

| Score | Description |
|---|---|
| 10 | Every punctuation choice correct: comma thousand separators, no `!`, no `;`, em-dash where appropriate, period rules followed. |
| 9 | One minor punctuation choice (e.g. extra ellipsis). |
| 7–8 | Two punctuation issues but no banned marks. |
| 1–6 | Banned marks present (`!`, `;`) — should already be a hard-fail in Section A. Below 7 = multiple soft errors. |

**Specific checks**:
- No trailing period on slide-1 main headline ✓
- Trailing period on full sentence bodies ✓
- Comma thousand separators (`47,000`, `$5,000`) ✓
- `%` glued to digit (`90%`) ✓
- Currency symbol in correct context (`$` for US-context, `ש״ח` for Israeli) ✓
- No double punctuation (`!?`, `..`) ✓

### B6 — Pattern Fit (weight 0.10)

Does the slide match an approved pattern in `copy-patterns-he.md`?

| Score | Description |
|---|---|
| 10 | Cleanly imitates an approved pattern. Word order, density, rhythm match an existing example. |
| 9 | Pattern is recognizable with a small original twist. |
| 7–8 | Pattern is loosely followed but rhythm differs. |
| 5–6 | New pattern not in the library. Flag for review. |
| 1–4 | Doesn't match any approved pattern AND isn't an interesting new shape. |

**For new patterns**: don't auto-fail. Annotate `notes` with the proposed
new pattern so it can be reviewed and possibly added to the library.

### B7 — Specificity (weight 0.10)

Does the slide include concrete numbers, named accounts, named claims —
not generic phrases?

| Score | Description |
|---|---|
| 10 | Every claim is specific. Real number, real account/broker, real benefit. |
| 9 | Mostly specific. One soft generic phrase. |
| 7–8 | Mix of specific and generic. |
| 5–6 | Mostly generic. Could swap subject for any other strategy. |
| 1–4 | All generic. No anchor. |

**Specific checks**:
- Named accounts (`Roth IRA`, `401k`) not "the account" ✓
- Real numbers (`70%`, `$5,000`) not "many" or "a lot" ✓
- Concrete benefit (`חוסך עשרות אלפי ש״ח`) not "amazing returns" ✓
- Verb is specific (`מקסמים`, `פותח`, `מעביר`) — not `עוזר ל`, `מאפשר`, `מספק` ✓

---

## Output format expected from critic

For each carousel run, the critic returns:

```json
{
  "carousel_id": "c1",
  "slides": [
    {
      "slide_index": 0,
      "hard_fails": [],
      "scores": { "nativeness": 9, "voice_match": 9, "term_correctness": 10, "bidi_correctness": 10, "punctuation_correctness": 10, "pattern_fit": 9, "specificity": 9 },
      "weighted_score": 9.3,
      "recommend": "ship",
      "notes": "..."
    }
  ],
  "carousel_average": 8.9,
  "carousel_recommend": "ship"
}
```

The pipeline regenerates any slide where `recommend != "ship"`. After 2
regeneration attempts, the slide is marked `awaiting_approval` and surfaced
in the dashboard for human review.

---

## Calibration anchors (finance domain)

To prevent score drift, here are calibration examples. The critic should
match these scores when evaluating identical or near-identical slides.

| Hebrew text | Slide role | Expected score | Why |
|---|---|---|---|
| `Roth IRA יחסוך לך עשרות אלפי ש״ח על המס` | Slide 1 hook | **10** | Gold standard — every dimension perfect. |
| `אבל אף אחד לא טורח לפתוח אחד.` | Slide 2 transition | **9** | Native, voice-match, specific. Ships. |
| `במקום לחסוך 23,000 בלבד, מכניסים 70,000 לשנה ל-Mega Backdoor.` | Slide 5 tip body | **9** | Comparison structure, native flow, sparse English. |
| `הכלי המהפכני הזה ישנה את כל אופן ההשקעה שלך` | Any | **2** | Cliché hook + decorative + generic. Hard-fail on `ישנה את הכל`. |
| `מגדיר פעם אחת את ה-401k שלך עם auto-deposit ושוכח שזה קיים בכלל` | Slide 3 tip body | **6** | Body has 2+ English words (`401k`, `auto-deposit`). Native rhythm but English-heavy. |
| `יש להבין כי השקעה ב-ETF הינה הדרך הטובה ביותר` | Any | **0** | Hard-fail: `יש להבין כי` + `הינה` (over-formal calque). |
| `Roth IRA-ים הם הדבר הכי טוב שעשיתי` | Hook | **0** | Hard-fail: `IRA-ים` (Hebrew suffix on English root). |

If the critic's score on a calibration example deviates by more than 1
point from the expected, the rubric or critic prompt needs adjustment.
