"use client";

import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import type { Slide, Language } from "@reem/types";
import { SlideCanvas } from "@/components/slide/SlideCanvas";
import type { Palette } from "@/components/slide/palette";

// IG feed media uses 4:5 for portrait carousels. iPhone screen is 393px wide,
// so the post media is 393x491. Slides render at native 1080x1350 and we scale
// by 393/1080 ≈ 0.36389. Keep the viewport perfectly clipped so neighbours
// don't peek through during the scale.
const VIEWPORT_W = 393;
const VIEWPORT_H = 491;
const SCALE = VIEWPORT_W / 1080;

type Props = {
  slides: Slide[];
  lang: Language;
  palette?: Palette;
};

export function SlideSwiper({ slides, lang, palette }: Props) {
  // axis:"x" + direction:"ltr": IG always swipes left/right regardless of
  // content language. Locking direction here prevents Embla from inheriting
  // the page's RTL <html> dir and reversing the slide order.
  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    axis: "x",
    direction: "ltr",
    containScroll: "trimSnaps",
  });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelected(emblaApi.selectedScrollSnap());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const total = slides.length;

  return (
    // direction:ltr is required because /preview's <main dir="rtl"> would
    // otherwise flip the embla flex track right-to-left, parking slide 0
    // off-canvas and rendering an empty viewport.
    <div style={{ width: VIEWPORT_W, direction: "ltr" }}>
      <div
        ref={emblaRef}
        style={{
          width: VIEWPORT_W,
          height: VIEWPORT_H,
          overflow: "hidden",
          background: "#000",
          cursor: "grab",
          direction: "ltr",
        }}
      >
        <div style={{ display: "flex", height: "100%", direction: "ltr" }}>

          {slides.map((slide) => (
            <div
              key={slide.n}
              style={{
                flex: "0 0 100%",
                width: VIEWPORT_W,
                height: VIEWPORT_H,
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: 1080,
                  height: 1350,
                  transform: `scale(${SCALE})`,
                  transformOrigin: "top left",
                }}
              >
                <SlideCanvas
                  slide={slide}
                  lang={lang}
                  totalSlides={total}
                  palette={palette}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Dot indicator — IG renders these between media and action row */}
      <div
        dir="ltr"
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          gap: 4,
          height: 18,
          marginTop: 6,
        }}
      >
        {slides.map((_, i) => (
          <span
            key={i}
            style={{
              width: 6,
              height: 6,
              borderRadius: 999,
              background: i === selected ? "#0095f6" : "#c7c7c7",
              transition: "background 120ms ease",
            }}
          />
        ))}
      </div>
    </div>
  );
}
