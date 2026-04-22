import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { IPhoneFrame } from "@/components/phone/IPhoneFrame";
import { InstagramFeedPost } from "@/components/phone/InstagramFeedPost";
import { DownloadButton } from "@/components/phone/DownloadButton";
import { CopyButton } from "@/components/CopyButton";
import type { Slide, Language, CarouselStatus } from "@reem/types";

export const dynamic = "force-dynamic";

interface Props {
  searchParams: Promise<{ runId?: string; idx?: string; lang?: string }>;
}

export default async function PreviewPage({ searchParams }: Props) {
  const { runId, idx, lang: langParam } = await searchParams;
  const lang: Language = langParam === "en" ? "en" : "he";
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

  // The visible caption mirrors whatever lang the user is previewing. The
  // ZIP, however, always ships the Hebrew version because that's what the
  // client posts to Instagram. Real captions populated by the deriveCaption
  // Haiku helper at generation time; the synthesize fallback covers older
  // rows generated before that helper landed.
  const slidesHe = (data.slides_he ?? []) as Slide[];
  const captionHe =
    data.caption_he ??
    (slidesHe.length > 0 ? synthesizeCaption(slidesHe, "he") : "");
  const captionEn =
    data.caption_en ?? synthesizeCaption(slides as Slide[], "en");
  const caption = lang === "he" ? captionHe : captionEn;
  const status = data.status as CarouselStatus;
  const filenameSlug = buildFilenameSlug(data.concept, data.idx);

  const params = new URLSearchParams();
  if (runId) params.set("runId", runId);
  if (idx) params.set("idx", idx);
  const otherLang = lang === "he" ? "en" : "he";
  params.set("lang", otherLang);
  const toggleHref = `/preview?${params.toString()}`;

  return (
    <main className="bg-cream-soft flex flex-1 flex-col items-center gap-6 px-6 py-10">
      <header className="w-full max-w-2xl text-center">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          תצוגת אינסטגרם
        </p>
        <h1 className="font-display text-navy mt-2 text-2xl font-black">
          {data.concept}
        </h1>
        <p className="text-muted mt-1 text-xs">
          run {data.run_id.slice(0, 8)} · קרוסלה #{data.idx + 1} · {slides.length}{" "}
          שקופיות
        </p>
        <p className="mt-3 text-sm">
          <span
            className={
              lang === "he" ? "text-navy font-semibold" : "text-muted"
            }
          >
            עברית
          </span>
          <span className="text-muted mx-2">|</span>
          <Link
            href={toggleHref}
            className={
              lang === "en"
                ? "text-navy font-semibold"
                : "text-muted hover:text-navy"
            }
          >
            English
          </Link>
        </p>
      </header>

      <IPhoneFrame>
        <InstagramFeedPost slides={slides} lang={lang} caption={caption} />
      </IPhoneFrame>

      {slidesHe.length > 0 ? (
        <div className="flex flex-wrap items-center justify-center gap-3">
          <DownloadButton
            carouselId={data.id}
            slidesHe={slidesHe}
            caption={captionHe}
            filenameSlug={filenameSlug}
            alreadyPosted={status === "posted"}
          />
          <CopyButton text={caption} />
        </div>
      ) : null}
    </main>
  );
}

// Slugifies the concept for use as a ZIP filename. Strips Hebrew (since
// browsers and IG handle it inconsistently in download dialogs) and falls
// back to the carousel index if nothing useful remains.
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

// Stopgap caption: derive from hook slide text + canned hashtags. Replace
// once the Haiku deriveCaption helper lands and populates carousels.caption_he
// / caption_en at generation time.
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
    <main className="flex flex-1 items-center justify-center px-6 py-16">
      <div className="max-w-md text-center">
        <p className="text-muted">{message}</p>
      </div>
    </main>
  );
}
