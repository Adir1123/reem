"use client";

import { useCallback, useEffect, useState } from "react";
import type { Slide, Language } from "@reem/types";
import { SlideCanvas } from "@/components/slide/SlideCanvas";
import type { Palette } from "@/components/slide/palette";

const SLIDE_W = 1080;
const SLIDE_H = 1350;
const COVER_W = 380;
const COVER_H = 475;
const SCALE = COVER_W / SLIDE_W;

interface Props {
  slides: Slide[];
  lang: Language;
  palette?: Palette;
  /** Notified after every active-index change. Lets a parent (e.g. the chat
   *  editor) scope itself to whichever slide the user is currently looking at. */
  onActiveChange?: (idx: number) => void;
}

// Layered slide preview — same depth/animation pattern as <CarouselStack>,
// but each card is a slide canvas. Right-arrow = previous slide, left-arrow
// = next slide (RTL reading direction). Side cards are clickable to promote.
export function SlideStack({ slides, lang, palette, onActiveChange }: Props) {
  const [activeRaw, setActiveRaw] = useState(0);
  const total = slides.length;

  const goNext = useCallback(
    () => setActiveRaw((i) => Math.min(total - 1, i + 1)),
    [total],
  );
  const goPrev = useCallback(() => setActiveRaw((i) => Math.max(0, i - 1)), []);

  // Clamp at render time instead of reset-on-change-via-effect. Language
  // toggles in /preview are a full navigation (new mount), so the only way
  // total can shrink under us is if the parent swaps in a shorter array
  // mid-life (chat edits never change length). A clamp covers that without
  // a setState-in-effect cascade.
  const safeActive = Math.min(activeRaw, Math.max(0, total - 1));

  // Bubble the current index up so the chat editor can scope itself.
  useEffect(() => {
    onActiveChange?.(safeActive);
  }, [safeActive, onActiveChange]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goPrev();
      else if (e.key === "ArrowLeft") goNext();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNext, goPrev]);

  if (total === 0) return null;

  return (
    <div className="reem-stack" dir="rtl">
      <div className="reem-stack-frame">
        <button
          type="button"
          className="reem-stack-arrow reem-stack-arrow-right"
          onClick={goPrev}
          disabled={safeActive === 0}
          aria-label="שקופית קודמת"
        >
          <span aria-hidden="true">→</span>
        </button>

        <div className="reem-stack-deck">
          {slides.map((s, i) => {
            const offset = i - safeActive;
            if (Math.abs(offset) > 2) return null;
            const tx = -offset * 56;
            const sc = 1 - Math.abs(offset) * 0.08;
            const op =
              offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.55 : 0.18;
            const z = 5 - Math.abs(offset);
            const isActive = offset === 0;
            return (
              <div
                key={s.n}
                className={"reem-stack-card" + (isActive ? " is-active" : "")}
                style={{
                  transform: `translateX(${tx}px) scale(${sc})`,
                  opacity: op,
                  zIndex: z,
                }}
                onClick={isActive ? undefined : () => setActiveRaw(i)}
              >
                <div
                  className="reem-stack-card-link"
                  aria-hidden={!isActive}
                >
                  <div className="reem-stack-card-frame">
                    <div
                      className="reem-stack-card-canvas"
                      style={{
                        width: SLIDE_W,
                        height: SLIDE_H,
                        transform: `scale(${SCALE})`,
                        transformOrigin: "top left",
                      }}
                    >
                      <SlideCanvas
                        slide={s}
                        lang={lang}
                        totalSlides={total}
                        palette={palette}
                      />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="reem-stack-arrow reem-stack-arrow-left"
          onClick={goNext}
          disabled={safeActive >= total - 1}
          aria-label="שקופית הבאה"
        >
          <span aria-hidden="true">←</span>
        </button>
      </div>

      <div className="reem-stack-meta">
        <p className="reem-stack-counter" dir="ltr">
          {String(safeActive + 1).padStart(2, "0")}{" "}
          <span className="reem-stack-counter-sep">/</span>{" "}
          {String(total).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}
