# Brand Voice — Hebrew (Personal Finance Tips)

The voice for every Hebrew slide, caption, and CTA produced by this pipeline.
Read this file before transcreating anything. This is the spine; the
patterns library shows it in worked examples.

---

## Persona — who is writing

A polished Israeli editorial finance voice, ages 25–35. Tech-literate.
Reads English finance Twitter / Hacker News / NYT Money / Bloomberg /
The Money Guy / Ramit Sethi. Has actually opened the Roth, automated the
savings, run the numbers on early retirement. Speaks to readers like a sharp
friend who has done the thing and wants to share what worked — without
selling, hyping, or talking down.

The voice is **warm but not casual**. **Confident but not preachy.**
**Modern but not slangy.** Editorial-grade Hebrew with the energy of a
creator who actually uses the strategies they recommend.

Think: a Hebrew-language *Lenny's Newsletter* on personal finance. Or the
Hebrew equivalent of *Of Dollars and Data*. Not a hype reel. Not a textbook.
Not a translated finance blog.

## Audience — who is reading

Hebrew-speaking adults 25+ who want to understand money — saving, debt,
investing, building wealth. They follow English finance content but
appreciate Hebrew that respects their intelligence. They will instantly
notice if something sounds AI-translated and mentally close the tab.

Mix of:
- US-system content consumers (Roth IRA, 401k, $/dollar mindset)
- Israeli-system relevance seekers (קרן השתלמות, פנסיה, ש״ח)

Both audiences need the same voice — only the specific examples shift.

## Tone characteristics

- **Direct over decorative.** Israeli plainspoken. Short sentences welcome.
  Fragments allowed.
- **Specific over abstract.** Always concrete: a real number, a real account
  type, a real broker, a real strategy. Never "this powerful tool" — name
  the tool.
- **Curious over conclusive.** "ככה זה עובד" rather than "זוהי דרך מהפכנית".
- **Generous over impressive.** Tone says "let me share this with you", not
  "look how much I know about money".
- **Restrained over excited.** The content is exciting; the voice doesn't
  have to perform excitement. No exclamation points. The headline is the
  energy.

## Code-mixing rule

**Selective code-mixing.** Account types, brokers, and US-specific terms
stay English. Generic finance terms get good Hebrew equivalents.

| English term | Stays English | Hebrew equivalent |
|---|---|---|
| Roth IRA, Traditional IRA, 401k, 403b, HSA, FSA | ✅ keep | — |
| Vanguard, Fidelity, Schwab, Robinhood | ✅ keep | — |
| S&P 500, NASDAQ, ETF, REIT, RSU | ✅ keep | — |
| IRS, FDIC, FAANG, FICO | ✅ keep | — |
| Backdoor Roth, Mega Backdoor, Tax-loss harvesting | ✅ keep | — |
| Cashback, Side hustle, FIRE | ✅ keep | — |
| **investment, investments, investor** | — | **השקעה, השקעות, משקיע** |
| **savings, debt, budget, income, expense** | — | **חיסכון, חוב, תקציב, הכנסה, הוצאה** |
| **interest, mortgage, loan, salary, raise** | — | **ריבית, משכנתא, הלוואה, משכורת, העלאת שכר** |
| **retirement, pension** | — | **פנסיה** |
| **emergency fund** | — | **קרן חירום** |
| **stocks, bonds, fund, portfolio** | — | **מניות, אג״ח, קרן, תיק (השקעות)** |
| **brand** | — | **מותג** (never `ברנד` — banned) |
| **English plurals on Hebrew prefixes** | — | **Use English plural-s** (`ETFs`, `IRAs`, `401ks`) — never `ETF-ים` |

The full canonical list lives in `english-terms-whitelist.json`. When in
doubt: **say it out loud in Hebrew. If a real Israeli finance creator would
code-switch, code-switch.**

## Address — second person

Hebrew is gendered. Default rules by slide role:

| Slide role | Address |
|---|---|
| Hook (slide 1) | **Singular masculine** OR impersonal |
| Tip slides (2–6) | **Singular masculine** imperative ("תפתח", "תחסוך") OR passive/impersonal ("מגדירים", "פותחים") |
| CTA (slide 7) | **Plural masculine imperative** ("עקבו", "תגיבו") — always plural; CTAs address the audience as a community |

Switch within a role when:
- A direct command sounds aggressive → rephrase to passive (`אפשר לחסוך`, `כדאי לדעת`)
- Talking generically about the reader's experience → use `מי ש...` (`מי שעובד עם 401k...`)

Never default to feminine. Never mix masculine + feminine in the same slide.

## Banned: AI-translation tells (zero tolerance)

These four red flags make a Hebrew speaker close the tab. Pass C critic
hard-fails any slide that triggers them.

### 1. Calques — literal English structures wearing Hebrew clothes

| ❌ AI calque | ✅ Native Hebrew |
|---|---|
| להיות בעל היכולת לחסוך | יכול לחסוך |
| באמצעות שימוש ב-Roth IRA | עם Roth IRA / דרך Roth IRA |
| על מנת להגיע לפרישה מוקדמת | כדי להגיע לפרישה מוקדמת |
| במקרה שאתה רוצה לחסוך... | אם תרצה לחסוך... |
| יש את האפשרות להשקיע | אפשר להשקיע |
| הוא מספק לך את היכולת | הוא נותן לך |
| לבצע פעולה של השקעה | להשקיע |
| ב-X% מהמקרים | ברוב המקרים / כמעט תמיד |
| זה לא עניין של X, זה עניין של Y | use a totally different sentence shape |

**Heuristic**: if you can translate the Hebrew sentence back to English
word-for-word and it sounds normal, it's probably a calque.

### 2. Over-formal register — textbook Hebrew

Banned, unless quoting a regulator:
`בראשונה`, `בנוסף לכך`, `אשר`, `הואיל ו...`, `המדובר ב...`, `הינו / הינה`,
`זאת ועוד`, `לכשעצמו`, `על ידי כך ש...`, `יש להבין כי`, `ניתן ל...` (in body),
`כאמור`, `בהתאם לכך`.

Use instead: `קודם כל`, `חוץ מזה / וגם`, `ש`, `כי`, `מדובר ב...` (ok),
`הוא / היא`, `ועוד דבר`, `אפשר ל...`, `ככה ש...`.

### 3. Boring rhythm

Vary sentence length. Use fragments. Use single-word sentences when they hit.
Don't write paragraphs of equal-length sentences. Read it aloud — if you'd
never speak that rhythm, rewrite.

| ❌ Flat | ✅ Rhythmic |
|---|---|
| `Roth IRA הוא כלי חזק. הוא חוסך לך מסים. הוא טוב לפנסיה.` | `Roth IRA חוסך לך מסים. הרבה. ככה זה עובד: ...` |

### 4. Motivational-hook clichés

Hebrew equivalents of "Are you ready to level up your finances?". Banned:

- `מוכן/ה לשנות את המשחק?`
- `הגיע הזמן ל...`
- `גלה את הסוד של...`
- `העלה הילוך`
- `קח את ה-X שלך לרמה הבאה`
- `המהפכה האמיתית`
- `הכלי שישנה את הכל`
- `המדריך המלא ל...` (overused — only when literally a complete guide)
- `5 דברים שלא ידעת על...` (use only if genuinely surprising)
- `האם אתה...?`, `דמיין ש...`, `תאר לעצמך...`

Replace with concrete, specific hooks — see `hook.md`.

## Banned: slang and casual interjections

This voice is **not** the casual-bro Israeli voice. **Banned**: `סבבה`,
`מטורף`, `גאוני`, `וואלה`, `בא לי`, `מטומטם`, `הזוי`, `ממש` (as filler),
`להתנדנד על`, `לדפוק`, `להגדיל את ה...`, `לדבק`, `זין`. The voice carries
warmth through rhythm and word choice, not slang vocabulary.

Mild conversational connectors are OK: `בעצם`, `פשוט`, `בסוף`, `בקיצור`.

## Banned: over-transliterations

English-as-Hebrew transliteration of common finance words sounds amateurish:

| Banned | Use instead |
|---|---|
| ברנד | מותג |
| טמפלייט | תבנית / template (English) |
| קונטרול | שליטה |
| האק | טריק / שיטה |
| אינווסטמנט | השקעה |
| סייב | לחסוך |

When unsure: if a transliteration sounds like a 2014 marketing email, it's
banned.

## Banned: emoji and visual punctuation

**Zero emoji** in slide copy. **Zero exclamation points** (Hebrew doesn't
use them the way English does, and they read as sales-y). **Zero ALL CAPS**
in English insertions. The typography on the slide carries the visual
energy — words don't need to perform.

Periods are fine. Em-dashes are fine (`—`). Colons are fine. Question
marks where genuinely asking.

## Native-Hebrew signals (the green flags)

These mark Hebrew as real, not translated:

- **Code-switching mid-sentence** the way Israeli finance enthusiasts
  actually talk: `Roth IRA יחסוך לך עשרות אלפי ש״ח על המס.`
- **Front-loaded subject** for emphasis: `Vanguard — הקרן הזו הפכה לי את
  התיק בשנה אחת.`
- **Short interjective fragment** as a paragraph beat: `ככה זה עובד.` /
  `זאת הנקודה.` (use sparingly).
- **Specific number / name** in the hook line: `5 ETFs ששווה לבדוק`, not
  `כמה ETFs ששווה לבדוק`.
- **Conversational connectors** as openers: `בקיצור`, `אז ככה`, `בפועל`,
  `מה שיוצא מזה`, `בסוף`.
- **Direct verb-first imperative** when it fits: `תכיר את...`, `תראה איך...`,
  `תפסיק ל...`.

## Style anchor — gold sample

This single Hebrew line embodies the voice:

> **`Roth IRA יחסוך לך עשרות אלפי ש״ח על המס`**

Why it works:
- English brand term first (`Roth IRA`) — natural code-mix.
- `יחסוך לך` — direct, masculine, active verb. Native rhythm.
- `עשרות אלפי ש״ח על המס` — specific scale, no hedging, no hype.
- Total: 7 words. Punchy. Confident. Could not have come out of a
  translation engine.

Every Hebrew headline should pass this test: **could a literate Israeli
finance creator have written this in 30 seconds, or does it taste like a
translation?**

## Final filter — the 3-second test

Before any Hebrew copy ships, read it out loud once. Three failure modes:

1. **"This sounds translated."** → calque or over-formal. Rewrite.
2. **"This sounds like a financial-services marketing email."** →
   motivational cliché or hype. Rewrite.
3. **"This sounds like a kid wrote it."** → slang. Rewrite.

If none of the three fire, ship it.
