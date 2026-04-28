import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { SlideStack } from "@/components/reem/SlideStack";
import { DownloadButton } from "@/components/phone/DownloadButton";
import { CopyButton } from "@/components/CopyButton";
import { getPalette } from "@/components/slide/palette";
import type { Slide, Language, CarouselStatus } from "@reem/types";

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
      "id, run_id, idx, concept, angle, status, slides_he, slides_en, caption_he, caption_en, created_at",
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

  return (
    <main className="reem-page reem-page--preview flex flex-col items-center" dir="rtl">
      <div className="mb-8 flex items-center gap-4 text-sm">
        <Link
          href={heHref}
          className={
            lang === "he"
              ? "text-cream font-medium"
              : "text-cream/45 hover:text-cream"
          }
        >
          עברית
        </Link>
        <span className="text-cream/30">|</span>
        <Link
          href={enHref}
          className={
            lang === "en"
              ? "text-cream font-medium"
              : "text-cream/45 hover:text-cream"
          }
        >
          English
        </Link>
      </div>

      <SlideStack slides={slides} lang={lang} palette={palette} />

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
