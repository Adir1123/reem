import Link from "next/link";
import type { Slide } from "@reem/types";
import { SlideCanvas } from "@/components/slide/SlideCanvas";
import { CarouselStatusBadge } from "@/components/StatusBadge";
import type { CarouselStatus } from "@reem/types";

// Visual carousel cover used on /carousels and /history. Renders the hook
// slide at native 1080x1350 inside a fixed-width 4:5 frame, scaled via CSS
// transform so what you see here is exactly what the slide will look like.
const COVER_W = 320;
const COVER_H = 400;
const SLIDE_W = 1080;
const SLIDE_H = 1350;
const SCALE = COVER_W / SLIDE_W;

export function CarouselCover({
  href,
  hookSlide,
  totalSlides,
  status,
  concept,
  date,
}: {
  href: string;
  hookSlide: Slide;
  totalSlides: number;
  status?: CarouselStatus;
  concept: string;
  date: string;
}) {
  return (
    <Link href={href} className="reem-cover-card group">
      <div
        style={{
          position: "relative",
          width: COVER_W,
          height: COVER_H,
          overflow: "hidden",
          borderRadius: 4,
          background: "#0a0a0a",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: SLIDE_W,
            height: SLIDE_H,
            transform: `scale(${SCALE})`,
            transformOrigin: "top left",
          }}
        >
          <SlideCanvas slide={hookSlide} lang="he" totalSlides={totalSlides} />
        </div>
        <span className="reem-cover-badge" aria-hidden="true">
          {totalSlides} שקופיות
        </span>
      </div>
      <div className="reem-cover-meta">
        <span className="reem-cover-topic">{concept}</span>
        <span className="reem-cover-date">{date}</span>
      </div>
      {status ? (
        <div className="mt-2">
          <CarouselStatusBadge status={status} />
        </div>
      ) : null}
    </Link>
  );
}
