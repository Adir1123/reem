"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Slide } from "@reem/types";
import { SlideCanvas } from "@/components/slide/SlideCanvas";
import { exportCarouselZip } from "@/components/slide/exportCarousel";
import { markPostedAction, markRejectedAction } from "@/app/preview/actions";

const DOM_PREFIX = "export-slide-";

type Props = {
  carouselId: string;
  slidesHe: Slide[]; // exported lang is always HE — that's what gets posted
  caption: string; // pre-built HE caption from the page
  filenameSlug: string; // e.g. "emergency-fund-basics-1"
  alreadyPosted: boolean;
};

export function DownloadButton({
  carouselId,
  slidesHe,
  caption,
  filenameSlug,
  alreadyPosted,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const total = slidesHe.length;

  async function handleDownload() {
    setError(null);
    setBusy(true);
    try {
      await exportCarouselZip({
        domIdPrefix: DOM_PREFIX,
        slideCount: total,
        caption,
        filename: filenameSlug,
      });
      // Only flip status after the file actually downloaded.
      startTransition(async () => {
        await markPostedAction(carouselId);
        router.refresh();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "ייצוא נכשל");
    } finally {
      setBusy(false);
    }
  }

  async function handleReject() {
    if (!confirm("לדחות את הקרוסלה הזו? הנושא יחזור למאגר.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await markRejectedAction(carouselId);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "דחייה נכשלה");
      }
    });
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-3">
      {alreadyPosted ? (
        <div className="text-muted bg-cream-soft border-navy/10 rounded-full border px-5 py-2 text-sm">
          הקרוסלה סומנה כפורסמה
        </div>
      ) : (
        <div className="flex w-full items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={busy || pending}
            className="bg-navy text-cream hover:bg-navy-soft disabled:bg-navy/40 rounded-full px-6 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
          >
            {busy
              ? "מייצא PNG…"
              : pending
                ? "מסמן כפורסם…"
                : "הורד ZIP וסמן כפורסם"}
          </button>
          <button
            type="button"
            onClick={handleReject}
            disabled={busy || pending}
            className="text-navy/70 hover:text-navy border-navy/20 hover:border-navy/40 rounded-full border bg-white px-5 py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50"
          >
            דחה
          </button>
        </div>
      )}

      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {/* Off-screen full-size renders for html-to-image. Position so the
          1080x1350 DOM has real dimensions (not collapsed) but stays out of
          the visible viewport. Don't use display:none — html-to-image needs
          a laid-out box. */}
      <div
        aria-hidden
        style={{
          position: "fixed",
          left: -100000,
          top: 0,
          width: 1080,
          height: 1350 * total,
          pointerEvents: "none",
        }}
      >
        {slidesHe.map((slide, i) => (
          <div
            key={slide.n}
            id={`${DOM_PREFIX}${i}`}
            style={{ width: 1080, height: 1350 }}
          >
            <SlideCanvas slide={slide} lang="he" totalSlides={total} />
          </div>
        ))}
      </div>
    </div>
  );
}
