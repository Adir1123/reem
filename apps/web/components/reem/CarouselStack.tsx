"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import type { Slide, CarouselStatus } from "@reem/types";
import { SlideCanvas } from "@/components/slide/SlideCanvas";
import { CarouselStatusBadge } from "@/components/StatusBadge";
import { regenerateAction } from "@/app/carousels/actions";

const SLIDE_W = 1080;
const SLIDE_H = 1350;
const COVER_W = 380;
const COVER_H = 475;
const SCALE = COVER_W / SLIDE_W;

export interface CarouselStackItem {
  id: string;
  run_id: string;
  idx: number;
  concept: string;
  status: CarouselStatus;
  created_at: string;
  slides_he: Slide[];
}

// Layered card carousel. Cards within ±2 of activeIdx are rendered with
// progressive translateX/scale/opacity so neighbouring cards peek out behind
// the front card. Right-arrow navigates toward newer (lower idx, since the
// list is sorted createdAt DESC); left-arrow navigates toward older.
export function CarouselStack({ carousels }: { carousels: CarouselStackItem[] }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const total = carousels.length;

  const goNewer = useCallback(() => {
    setActiveIdx((i) => Math.max(0, i - 1));
  }, []);
  const goOlder = useCallback(
    () => setActiveIdx((i) => Math.min(total - 1, i + 1)),
    [total],
  );

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNewer();
      else if (e.key === "ArrowLeft") goOlder();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [goNewer, goOlder]);

  if (total === 0) return null;
  const active = carousels[activeIdx];
  if (!active) return null;
  const isRejected = active.status === "rejected";

  return (
    <div className="reem-stack" dir="rtl">
      <div className="reem-stack-frame">
        <button
          type="button"
          className="reem-stack-arrow reem-stack-arrow-right"
          onClick={goNewer}
          disabled={activeIdx === 0}
          aria-label="קרוסלה חדשה יותר"
        >
          <span aria-hidden="true">→</span>
        </button>

        <div className="reem-stack-deck">
          {carousels.map((c, i) => {
            const offset = i - activeIdx;
            if (Math.abs(offset) > 2) return null;
            const tx = -offset * 56;
            const sc = 1 - Math.abs(offset) * 0.08;
            const op = offset === 0 ? 1 : Math.abs(offset) === 1 ? 0.55 : 0.18;
            const z = 5 - Math.abs(offset);
            const isActive = offset === 0;
            const hookSlide = c.slides_he?.[0];
            if (!hookSlide) return null;

            return (
              <div
                key={c.id}
                className={"reem-stack-card" + (isActive ? " is-active" : "")}
                style={{
                  transform: `translateX(${tx}px) scale(${sc})`,
                  opacity: op,
                  zIndex: z,
                }}
                onClick={
                  isActive ? undefined : () => setActiveIdx(i)
                }
              >
                {isActive ? (
                  <Link
                    href={`/preview?runId=${c.run_id}&idx=${c.idx}`}
                    className="reem-stack-card-link"
                  >
                    <CardFrame
                      hookSlide={hookSlide}
                      totalSlides={c.slides_he.length}
                    />
                  </Link>
                ) : (
                  <div
                    className="reem-stack-card-link reem-stack-card-side"
                    aria-hidden="true"
                  >
                    <CardFrame
                      hookSlide={hookSlide}
                      totalSlides={c.slides_he.length}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <button
          type="button"
          className="reem-stack-arrow reem-stack-arrow-left"
          onClick={goOlder}
          disabled={activeIdx >= total - 1}
          aria-label="קרוסלה ישנה יותר"
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
        <p className="reem-stack-concept">{active.concept}</p>
        <p className="reem-stack-date" dir="ltr">
          {formatDate(active.created_at)}
        </p>
        <div className="reem-stack-status">
          <CarouselStatusBadge status={active.status} />
        </div>
        {isRejected ? (
          <form action={regenerateAction} className="mt-2">
            <input type="hidden" name="carouselId" value={active.id} />
            <button type="submit" className="reem-stack-regenerate">
              הפק שוב
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}

function CardFrame({
  hookSlide,
  totalSlides,
}: {
  hookSlide: Slide;
  totalSlides: number;
}) {
  return (
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
        <SlideCanvas slide={hookSlide} lang="he" totalSlides={totalSlides} />
      </div>
      <span className="reem-stack-card-badge" aria-hidden="true">
        {totalSlides} שקופיות
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}
