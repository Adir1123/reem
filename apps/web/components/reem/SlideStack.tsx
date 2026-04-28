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
}

// Layered slide preview — same depth/animation pattern as <CarouselStack>,
// but each card is a slide canvas. Right-arrow = previous slide, left-arrow
// = next slide (RTL reading direction). Side cards are clickable to promote.
export function SlideStack({ slides, lang, palette }: Props) {
  const [activeIdx, setActiveIdx] = useState(0);
  const total = slides.length;

  const goNext = useCallback(
    () => setActiveIdx((i) => Math.min(total - 1, i + 1)),
    [total],
  );
  const goPrev = useCallback(() => setActiveIdx((i) => Math.max(0, i - 1)), []);

  // Reset to slide 0 when the slide set changes (e.g., language toggle).
  useEffect(() => {
    setActiveIdx(0);
  }, [slides]);

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
          disabled={activeIdx === 0}
          aria-label="שקופית קודמת"
        >
          <span aria-hidden="true">→</span>
        </button>

        <div className="reem-stack-deck">
          {slides.map((s, i) => {
            const offset = i - activeIdx;
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
                onClick={isActive ? undefined : () => setActiveIdx(i)}
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
          disabled={activeIdx >= total - 1}
          aria-label="שקופית הבאה"
        >
          <span aria-hidden="true">←</span>
        </button>
      </div>

      <div className="reem-stack-meta">
        <p className="reem-stack-counter" dir="ltr">
          {String(activeIdx + 1).padStart(2, "0")}{" "}
          <span className="reem-stack-counter-sep">/</span>{" "}
          {String(total).padStart(2, "0")}
        </p>
      </div>
    </div>
  );
}
