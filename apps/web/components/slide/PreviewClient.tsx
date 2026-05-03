"use client";

import { useCallback, useState } from "react";
import type { Slide, Language } from "@reem/types";
import { SlideStack } from "@/components/reem/SlideStack";
import { SlideEditChat } from "@/components/slide/SlideEditChat";
import type { Palette } from "@/components/slide/palette";

interface Props {
  carouselId: string;
  initialSlides: Slide[];
  lang: Language;
  initialSlidesVersion: number;
  palette?: Palette;
}

// Owns the in-memory slide array + active index + slides_version so the
// SlideStack visualization and the SlideEditChat drawer can stay in sync
// after each chat-driven edit, without a full /preview navigation.
export function PreviewClient({
  carouselId,
  initialSlides,
  lang,
  initialSlidesVersion,
  palette,
}: Props) {
  const [slides, setSlides] = useState<Slide[]>(initialSlides);
  const [activeIdx, setActiveIdx] = useState(0);
  const [version, setVersion] = useState(initialSlidesVersion);

  const handleSlideChange = useCallback(
    (next: Slide, newVersion: number) => {
      setSlides((prev) =>
        prev.map((s, i) => (i === activeIdx ? next : s)),
      );
      setVersion(newVersion);
    },
    [activeIdx],
  );

  const activeSlide = slides[activeIdx];

  return (
    <>
      <SlideStack
        slides={slides}
        lang={lang}
        palette={palette}
        onActiveChange={setActiveIdx}
      />
      {activeSlide ? (
        <SlideEditChat
          carouselId={carouselId}
          slideIdx={activeIdx}
          slide={activeSlide}
          totalSlides={slides.length}
          lang={lang}
          slidesVersion={version}
          onSlideChange={handleSlideChange}
        />
      ) : null}
    </>
  );
}
