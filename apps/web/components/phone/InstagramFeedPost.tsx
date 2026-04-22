import type { Slide, Language } from "@reem/types";
import { SlideSwiper } from "./SlideSwiper";
import {
  HeartIcon,
  CommentIcon,
  PaperPlaneIcon,
  BookmarkIcon,
  ThreeDotsIcon,
} from "./icons";

type Props = {
  slides: Slide[];
  lang: Language;
  caption: string;
};

const USERNAME = "personalfinancetips";

// Renders a single post in the IG feed: top bar → media swiper → action row
// → likes → caption → time. All chrome forced LTR for layout (icons, dots,
// timestamp); the caption and username are fine in RTL since IG mirrors
// for Hebrew accounts anyway.
export function InstagramFeedPost({ slides, lang, caption }: Props) {
  return (
    <div
      style={{
        background: "#fff",
        color: "#000",
        fontFamily:
          '-apple-system, "SF Pro Text", "Segoe UI", system-ui, sans-serif',
        fontSize: 14,
        height: "100%",
        overflow: "hidden",
      }}
    >
      {/* Top bar */}
      <div
        dir="ltr"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          height: 56,
          padding: "0 12px",
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            borderRadius: 999,
            background:
              "conic-gradient(from 180deg, #c9a961, #f5f1ea, #c9a961, #0f1b2d, #c9a961)",
            padding: 2,
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              height: "100%",
              borderRadius: 999,
              background: "#0f1b2d",
              color: "#c9a961",
              fontSize: 11,
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              letterSpacing: "0.05em",
            }}
          >
            PFT
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flex: 1 }}>
          <span style={{ fontWeight: 600, fontSize: 14 }}>{USERNAME}</span>
          <span style={{ color: "#737373" }}>·</span>
          <span style={{ color: "#737373", fontSize: 14 }}>2h</span>
        </div>
        <button
          aria-label="more"
          style={{
            background: "none",
            border: "none",
            padding: 4,
            color: "#000",
            cursor: "pointer",
          }}
        >
          <ThreeDotsIcon size={20} />
        </button>
      </div>

      {/* Media swiper (393x491) + dot indicator below */}
      <SlideSwiper slides={slides} lang={lang} />

      {/* Action row */}
      <div
        dir="ltr"
        style={{
          display: "flex",
          alignItems: "center",
          height: 44,
          padding: "0 12px",
        }}
      >
        <div style={{ display: "flex", gap: 14, flex: 1 }}>
          <button style={iconBtn} aria-label="like">
            <HeartIcon size={26} strokeWidth={1.8} />
          </button>
          <button style={iconBtn} aria-label="comment">
            <CommentIcon size={26} strokeWidth={1.8} />
          </button>
          <button style={iconBtn} aria-label="share">
            <PaperPlaneIcon size={26} strokeWidth={1.8} />
          </button>
        </div>
        <button style={iconBtn} aria-label="save">
          <BookmarkIcon size={26} strokeWidth={1.8} />
        </button>
      </div>

      {/* Likes */}
      <div
        style={{
          padding: "0 14px",
          fontWeight: 600,
          fontSize: 14,
          marginBottom: 4,
        }}
      >
        {lang === "he" ? "1,234 לייקים" : "1,234 likes"}
      </div>

      {/* Caption — clamped to 2 lines with "more" affordance */}
      <div
        style={{
          padding: "0 14px",
          fontSize: 14,
          lineHeight: 1.4,
          color: "#000",
          display: "-webkit-box",
          WebkitLineClamp: 2,
          WebkitBoxOrient: "vertical",
          overflow: "hidden",
        }}
      >
        <span style={{ fontWeight: 600, marginInlineEnd: 6 }}>{USERNAME}</span>
        <span style={{ whiteSpace: "pre-wrap" }}>{caption}</span>
      </div>
      <button
        style={{
          padding: "2px 14px 0",
          background: "none",
          border: "none",
          color: "#737373",
          fontSize: 14,
          cursor: "pointer",
        }}
      >
        {lang === "he" ? "עוד" : "more"}
      </button>

      {/* Time */}
      <div
        style={{
          padding: "8px 14px 0",
          color: "#737373",
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.02em",
        }}
      >
        {lang === "he" ? "לפני 2 שעות" : "2 hours ago"}
      </div>
    </div>
  );
}

const iconBtn = {
  background: "none",
  border: "none",
  padding: 0,
  color: "#000",
  cursor: "pointer",
  display: "inline-flex",
} as const;
