import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { PreviewClient } from "@/components/slide/PreviewClient";
import { PageHeader } from "@/components/reem/PageHeader";
import { CarouselStatusBadge } from "@/components/StatusBadge";
import { DownloadButton } from "@/components/phone/DownloadButton";
import { CopyButton } from "@/components/CopyButton";
import { getPalette } from "@/components/slide/palette";
import type {
  Slide,
  Language,
  CarouselStatus,
  CarouselAngle,
} from "@reem/types";

// Hebrew labels for the carousel angle. Used in the page sub-header so the
// reader instantly sees what kind of carousel this is without thinking in
// English.
const ANGLE_HE: Record<CarouselAngle, string> = {
  "hook-driven": "פתיח חזק",
  practical: "פרקטי",
  "counter-frame": "מסגור הפוך",
  story: "סיפור",
  data: "נתונים",
};

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{
    runId?: string;
    idx?: string;
    lang?: string;
    palette?: string;
  }>;
}

export default async function PreviewPage({ searchParams }: Props) {
  const {
    runId,
    idx,
    lang: langParam,
    palette: paletteParam,
  } = await searchParams;
  const lang: Language = langParam === "en" ? "en" : "he";
  const palette = getPalette(paletteParam);
  const sb = getServiceClient();

  let query = sb
    .from("carousels")
    .select(
      "id, run_id, idx, concept, angle, status, slides_he, slides_en, slides_version, caption_he, caption_en, created_at",
    )
    .order("created_at", { ascending: false })
    .limit(1);
  if (runId) query = query.eq("run_id", runId);
  if (idx) query = query.eq("idx", Number(idx));

  const { data, error } = await query.maybeSingle();
  if (error) return <ErrorShell message={`DB error: ${error.message}`} />;
  if (!data) return <ErrorShell message="אין קרוסלות עדיין. הריצו משימה ואז רעננו." />;

  const slides = ((lang === "he" ? data.slides_he : data.slides_en) ?? []) as Slide[];
  if (slides.length === 0) {
    return <ErrorShell message="אין שקופיות בשפה זו." />;
  }

  const slidesHe = (data.slides_he ?? []) as Slide[];
  const captionHe =
    data.caption_he ??
    (slidesHe.length > 0 ? synthesizeCaption(slidesHe, "he") : "");
  const captionEn =
    data.caption_en ?? synthesizeCaption(slides as Slide[], "en");
  const caption = lang === "he" ? captionHe : captionEn;
  const status = data.status as CarouselStatus;
  const filenameSlug = buildFilenameSlug(data.concept, data.idx);

  // Build dedicated language hrefs so each label is a real link — clicking
  // either always lands on that language, regardless of current state.
  const baseParams = new URLSearchParams();
  if (runId) baseParams.set("runId", runId);
  if (idx) baseParams.set("idx", idx);
  const heParams = new URLSearchParams(baseParams);
  heParams.set("lang", "he");
  const enParams = new URLSearchParams(baseParams);
  enParams.set("lang", "en");
  const heHref = `/preview?${heParams.toString()}`;
  const enHref = `/preview?${enParams.toString()}`;

  const angleLabel = ANGLE_HE[data.angle as CarouselAngle] ?? data.angle;
  const subText = `${angleLabel} · ${slides.length} שקופיות`;
  const runShort = (data.run_id as string).slice(-6);
  const createdAt = new Date(data.created_at as string).toLocaleDateString(
    "he-IL",
    { day: "2-digit", month: "2-digit", year: "numeric" },
  );

  return (
    <main className="reem-page reem-page--preview flex flex-col items-center" dir="rtl">
      {/* Top bar: breadcrumb (back to library) + segmented language toggle.
          This is the cheapest "we navigated" signal — the user always sees
          which page they're on AND a one-click way out. */}
      <div className="reem-preview-topbar">
        <Link href="/carousels" className="reem-preview-breadcrumb">
          <span aria-hidden="true">←</span>
          <span>הספרייה שלי</span>
        </Link>
        <div className="reem-preview-segment" role="group" aria-label="שפה">
          <Link
            href={heHref}
            className={
              "reem-preview-segment-btn" +
              (lang === "he" ? " is-active" : "")
            }
          >
            עברית
          </Link>
          <Link
            href={enHref}
            className={
              "reem-preview-segment-btn" +
              (lang === "en" ? " is-active" : "")
            }
          >
            English
          </Link>
        </div>
      </div>

      <PageHeader
        eyebrow="קרוסלה"
        title={data.concept}
        sub={subText}
        ornament
      />

      {/* Status pill — small but immediate signal that this carousel has its
          own state, separate from the library list. */}
      <div className="reem-preview-status">
        <CarouselStatusBadge status={status} />
      </div>

      {/* The slide stack lives inside a frame with two thin gold rules
          flanking it vertically, anchoring the canvas visually. The frame
          rules are the signature visual move that distinguishes /preview
          from /carousels — same palette, same deck, but framed. */}
      <div className="reem-preview-frame">
        <span className="reem-preview-frame-rule" aria-hidden="true" />
        <PreviewClient
          carouselId={data.id}
          initialSlides={slides}
          lang={lang}
          initialSlidesVersion={data.slides_version ?? 0}
          palette={palette}
        />
        <span className="reem-preview-frame-rule" aria-hidden="true" />
      </div>

      {paletteParam ? (
        <p className="text-cream/55 mt-3 text-xs">
          palette: <span className="text-gold-warm">{paletteParam}</span>
        </p>
      ) : null}

      {caption ? (
        <section className="reem-caption-block">
          <div className="reem-caption-head">
            <p className="reem-caption-eyebrow">
              {lang === "he" ? "כותרת לאינסטגרם" : "Instagram Caption"}
            </p>
            <CopyButton text={caption} />
          </div>
          <pre className="reem-caption-text" dir={lang === "he" ? "rtl" : "ltr"}>
            {caption}
          </pre>
        </section>
      ) : null}

      <p className="reem-preview-meta" dir="ltr">
        Run #{runShort} · #{(data.idx as number) + 1} · {createdAt}
      </p>

      {slidesHe.length > 0 ? (
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <DownloadButton
            carouselId={data.id}
            slidesHe={slidesHe}
            caption={captionHe}
            filenameSlug={filenameSlug}
            alreadyPosted={status === "posted"}
          />
        </div>
      ) : null}
    </main>
  );
}

function buildFilenameSlug(concept: string, idx: number): string {
  const ascii = concept
    .toLowerCase()
    .replace(/[^\x00-\x7f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  const base = ascii || `carousel-${idx + 1}`;
  return `${base}-${idx + 1}`;
}

function synthesizeCaption(slides: Slide[], lang: Language): string {
  const hook = slides[0];
  const tags =
    lang === "he"
      ? "#personalfinance #money #investing #כסף #השקעות #פיננסים"
      : "#personalfinance #money #investing #financialfreedom #savings";
  return `${hook.headline}\n\n${hook.body}\n\n${tags}`;
}

function ErrorShell({ message }: { message: string }) {
  return (
    <main className="reem-page flex flex-1 items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-cream/55">{message}</p>
      </div>
    </main>
  );
}
