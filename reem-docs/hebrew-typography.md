# Hebrew Typography — Editorial System

Font system for Hebrew-language carousels, documents, and web content. Editorial, authoritative, trust-driven.

---

## Fonts

Two fonts only. Both free via Google Fonts, commercial-use licensed.

### Display — Frank Ruhl Libre (serif)
For titles, headlines, pull quotes, numeric markers.

```
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&display=swap');
```

```css
font-family: 'Frank Ruhl Libre', 'Times New Roman', serif;
```

**Weights used:** 500, 700, 900

### Body — Assistant (sans-serif)
For body copy, metadata, CTAs, captions.

```
@import url('https://fonts.googleapis.com/css2?family=Assistant:wght@400;500;600;700&display=swap');
```

```css
font-family: 'Assistant', 'Arial Hebrew', sans-serif;
```

**Weights used:** 400, 500, 600, 700

### Combined import
```
@import url('https://fonts.googleapis.com/css2?family=Frank+Ruhl+Libre:wght@400;500;700;900&family=Assistant:wght@400;500;600;700&display=swap');
```

---

## Hierarchy

Canvas reference: **1080 × 1350px** (Instagram portrait carousel). Scale proportionally for other formats.

| Role | Font | Weight | Size | Line Height | Letter Spacing |
|------|------|--------|------|-------------|----------------|
| Cover Title | Frank Ruhl Libre | 900 | 84–96px | 1.1 | -0.5px |
| Slide Title (H1) | Frank Ruhl Libre | 900 | 64–72px | 1.1 | -0.5px |
| Subtitle (H2) | Frank Ruhl Libre | 700 | 40–48px | 1.2 | 0 |
| Pull Quote | Frank Ruhl Libre | 500 italic | 38–44px | 1.4 | 0 |
| Number / Chapter Marker | Frank Ruhl Libre | 900 | 96–120px | 1.0 | 0 |
| Body | Assistant | 400 | 26–30px | 1.55 | 0 |
| Lead Body | Assistant | 500 | 30–34px | 1.5 | 0 |
| Eyebrow / Meta Label | Assistant | 600 | 18–22px | 1.3 | +1.5px |
| CTA | Assistant | 700 | 26–30px | 1.2 | +0.5px |
| Page Number | Assistant | 600 | 18–20px | 1.0 | 0 |
| Caption / Footnote | Assistant | 400 | 22–24px | 1.4 | 0 |

---

## Rules

- **Never swap the fonts.** Frank Ruhl Libre = display only. Assistant = body only. Do not set titles in Assistant or body in Frank Ruhl Libre.
- **Weight carries hierarchy in Hebrew, not size.** Jump 400 → 700 → 900 before increasing px.
- **No weight below 400 under 28px.** Thin Hebrew letterforms disappear at small sizes.
- **Italic is display-only.** Frank Ruhl Libre 500 italic is reserved for pull quotes and single-word emphasis inside headlines. Never apply italic to Assistant.
- **Letter-spacing only on small meta labels.** Never on body copy or headlines above 24px (negative tracking on large titles is the one exception).
- **Page numbers use `direction: ltr`** inside RTL containers (e.g. `01 / 05`).
- **Punctuation sits on the left in RTL** (e.g. `?מה באמת קורה`).
- **Numbers and pricing** (e.g. `₪1,200`) use Assistant, not Frank Ruhl Libre, when inline with body copy.

---

## When to Apply This System

**Use it for:**
- Legal, professional services, financial advisory, editorial Hebrew content
- Long-form guides, lead magnets, PDF reports in Hebrew
- Brands where trust and authority are the primary feeling

**Do NOT use it for:**
- Playful / lifestyle / restaurant content → use a Rubik-based system instead
- Viral high-contrast hook content → use a Noto Sans Hebrew + Heebo system instead
- Finance tips / productivity / general punchy content → use a Heebo + Assistant system instead
