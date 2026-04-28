import type { Slide, Language } from "@reem/types";
import { splitHeadline, tokenizeEmphasis } from "./emphasis";
import { PALETTE_CURRENT, type Palette } from "./palette";

interface Props {
  slide: Slide;
  lang: Language;
  totalSlides: number;
  /** Host ID — used to target this node for PNG export. */
  domId?: string;
  /** Optional palette override. Defaults to the current navy/cream/gold. */
  palette?: Palette;
}

// The renderer. Fixed 1080x1350 canvas. Parent wrappers scale it down for
// on-screen preview; for PNG export we pass the un-transformed node to
// html-to-image so output is pixel-exact.
export function SlideCanvas({ slide, lang, totalSlides, domId, palette }: Props) {
  const p = palette ?? PALETTE_CURRENT;
  const isCTA = slide.role === "CTA";
  const dir = lang === "he" ? "rtl" : "ltr";
  const displayFont =
    lang === "he"
      ? "var(--font-display), 'Times New Roman', serif"
      : "'Fraunces', 'Frank Ruhl Libre', serif";
  const bodyFont =
    lang === "he"
      ? "var(--font-body), 'Arial Hebrew', sans-serif"
      : "'Inter', 'Assistant', sans-serif";
  const navyRgb = hexToRgbTriplet(p.navy);
  const creamRgb = hexToRgbTriplet(p.cream);

  return (
    <div
      id={domId}
      dir={dir}
      style={{
        position: "relative",
        width: 1080,
        height: 1350,
        background: p.navy,
        overflow: "hidden",
        fontFamily: bodyFont,
        color: p.cream,
      }}
    >
      {/* Background image — everything except CTA. Plain <img> on purpose:
          html-to-image rasterizes this canvas and next/image's Optimized
          srcset/<picture> wrappers don't survive the snapshot. */}
      {!isCTA && slide.ref_image ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={`/ref/${slide.ref_image}`}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.7,
          }}
        />
      ) : null}

      {/* Dark gradient to guarantee text legibility */}
      {!isCTA ? (
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(180deg, rgba(${navyRgb},0.35) 0%, rgba(${navyRgb},0.55) 45%, rgba(${navyRgb},0.95) 100%)`,
          }}
        />
      ) : null}

      {/* Top-left PFT mark (always visually top-left regardless of RTL) */}
      <div
        dir="ltr"
        style={{
          position: "absolute",
          top: 48,
          left: 48,
          fontFamily: displayFont,
          fontWeight: 700,
          fontSize: 22,
          letterSpacing: "0.15em",
          color: p.gold,
        }}
      >
        PFT
      </div>

      {/* Step number — large ghosted chapter marker, top-right of canvas */}
      {slide.step_number ? (
        <div
          dir="ltr"
          style={{
            position: "absolute",
            top: 48,
            right: 64,
            fontFamily: displayFont,
            fontWeight: 900,
            fontSize: 120,
            lineHeight: 1,
            color: p.gold,
            opacity: 0.4,
          }}
        >
          {slide.step_number}
        </div>
      ) : null}

      {/* Slide counter — bottom-right, LTR */}
      <div
        dir="ltr"
        style={{
          position: "absolute",
          bottom: 56,
          right: 64,
          fontFamily: bodyFont,
          fontWeight: 600,
          fontSize: 20,
          letterSpacing: "0.05em",
          color: `rgba(${creamRgb},0.85)`,
        }}
      >
        {String(slide.n).padStart(2, "0")} / {String(totalSlides).padStart(2, "0")}
      </div>

      {/* CTA layout — centered content on solid navy */}
      {isCTA ? (
        <CTA slide={slide} lang={lang} bodyFont={bodyFont} displayFont={displayFont} palette={p} />
      ) : (
        <ContentBlock
          slide={slide}
          lang={lang}
          bodyFont={bodyFont}
          displayFont={displayFont}
          palette={p}
        />
      )}
    </div>
  );
}

function ContentBlock({
  slide,
  lang,
  bodyFont,
  displayFont,
  palette,
}: {
  slide: Slide;
  lang: Language;
  bodyFont: string;
  displayFont: string;
  palette: Palette;
}) {
  const inlineStart = lang === "he" ? "right" : "left";
  const headlineTokens = splitHeadline(slide.headline, slide.headline_italic);
  const bodyTokens = tokenizeEmphasis(slide.body, slide.body_emphasis ?? []);
  const creamRgb = hexToRgbTriplet(palette.cream);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 160,
        [inlineStart]: 80,
        maxWidth: 920,
        display: "flex",
        flexDirection: "column",
        gap: 28,
      }}
    >
      {slide.eyebrow ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 16,
            fontFamily: bodyFont,
            fontWeight: 600,
            fontSize: 22,
            letterSpacing: "0.15em",
            textTransform: "uppercase",
            color: palette.gold,
          }}
        >
          <span
            style={{
              display: "inline-block",
              width: 48,
              height: 2,
              background: palette.gold,
            }}
          />
          <span>{slide.eyebrow}</span>
        </div>
      ) : null}

      <h1
        style={{
          margin: 0,
          fontFamily: displayFont,
          fontWeight: 900,
          fontSize: 76,
          lineHeight: 1.1,
          letterSpacing: "-0.01em",
          color: palette.cream,
        }}
      >
        {headlineTokens.map((t, i) =>
          t.emphasized ? (
            <span
              key={i}
              style={{
                color: palette.gold,
                fontWeight: 500,
                fontStyle: lang === "he" ? "normal" : "italic",
              }}
            >
              {t.text}
            </span>
          ) : (
            <span key={i}>{t.text}</span>
          ),
        )}
      </h1>

      {slide.body ? (
        <p
          style={{
            margin: 0,
            fontFamily: bodyFont,
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1.55,
            color: `rgba(${creamRgb},0.9)`,
          }}
        >
          {bodyTokens.map((t, i) =>
            t.emphasized ? (
              <span key={i} style={{ color: palette.gold, fontWeight: 600 }}>
                {t.text}
              </span>
            ) : (
              <span key={i}>{t.text}</span>
            ),
          )}
        </p>
      ) : null}
    </div>
  );
}

function CTA({
  slide,
  lang,
  bodyFont,
  displayFont,
  palette,
}: {
  slide: Slide;
  lang: Language;
  bodyFont: string;
  displayFont: string;
  palette: Palette;
}) {
  // Hebrew CTAs are standardised to a single brand-consistent line — the
  // LLM-generated headline/body are ignored. English CTAs still use the
  // model output. Applies to every rendered Hebrew carousel (past + future)
  // since this is a render-time override, not a data migration.
  const isHe = lang === "he";
  const headline = isHe
    ? "שמרו ועקבו לעוד"
    : slide.headline.replace(/@personalfinancetips/g, "").trim();
  const body = isHe
    ? ""
    : (slide.body ?? "").replace(/@personalfinancetips/g, "").trim();
  const creamRgb = hexToRgbTriplet(palette.cream);

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 96px",
        textAlign: "center",
        gap: 40,
      }}
    >
      <h1
        style={{
          margin: 0,
          fontFamily: displayFont,
          fontWeight: 900,
          fontSize: 72,
          lineHeight: 1.15,
          color: palette.cream,
        }}
      >
        {headline}
      </h1>
      {body ? (
        <p
          style={{
            margin: 0,
            fontFamily: bodyFont,
            fontWeight: 400,
            fontSize: 30,
            lineHeight: 1.5,
            color: `rgba(${creamRgb},0.85)`,
            maxWidth: 760,
          }}
        >
          {body}
        </p>
      ) : null}
      <div
        dir="ltr"
        style={{
          marginTop: 32,
          fontFamily: bodyFont,
          fontWeight: 700,
          fontSize: 28,
          letterSpacing: "0.05em",
          color: palette.navy,
          background: palette.gold,
          padding: "20px 48px",
          borderRadius: 999,
        }}
      >
        @personalfinancetips
      </div>
    </div>
  );
}

// "#0f1b2d" -> "15,27,45". Used for `rgba(<triplet>,<alpha>)` strings since we
// preserve the original gradient/alpha syntax (computed from palette hex).
function hexToRgbTriplet(hex: string): string {
  const v = hex.replace("#", "");
  const r = parseInt(v.slice(0, 2), 16);
  const g = parseInt(v.slice(2, 4), 16);
  const b = parseInt(v.slice(4, 6), 16);
  return `${r},${g},${b}`;
}
