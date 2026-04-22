import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { CarouselStatusBadge } from "@/components/StatusBadge";
import { regenerateAction } from "./actions";
import type { CarouselStatus, Slide } from "@reem/types";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.CLIENT_ID;

const STATUS_TABS: { value: CarouselStatus | "all"; label: string }[] = [
  { value: "all", label: "הכל" },
  { value: "pending_review", label: "ממתין לאישור" },
  { value: "approved", label: "אושר" },
  { value: "posted", label: "פורסם" },
  { value: "rejected", label: "נדחה" },
];

const STATUS_EMPTY_COPY: Record<CarouselStatus, string> = {
  pending_review: "אין כרגע קרוסלות שממתינות לאישור.",
  approved: "אין קרוסלות מאושרות שעדיין לא פורסמו.",
  posted: "עדיין לא פורסמה אף קרוסלה.",
  rejected: "אין קרוסלות שנדחו.",
};

interface CarouselRow {
  id: string;
  run_id: string;
  idx: number;
  concept: string;
  angle: string;
  status: CarouselStatus;
  created_at: string;
  slides_he: Slide[];
}

interface FailedRunRow {
  id: string;
  error: string | null;
  finished_at: string | null;
  created_at: string;
  topics: { he_label: string } | { he_label: string }[] | null;
}

// 14d window — long enough that yesterday's failure is still surfaced, short
// enough that ancient noise doesn't pile up at the top of the page.
const FAILED_RUN_LOOKBACK_DAYS = 14;

// Wrap the impure Date.now() call so the React purity lint doesn't flag it
// inside the server component body — the call still happens per request.
function failedRunsSinceIso(): string {
  return new Date(
    Date.now() - FAILED_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function CarouselsPage({ searchParams }: Props) {
  if (!CLIENT_ID) return <ErrorShell message="CLIENT_ID env var not set." />;
  const { status } = await searchParams;
  const sb = getServiceClient();

  let query = sb
    .from("carousels")
    .select("id, run_id, idx, concept, angle, status, created_at, slides_he")
    .eq("client_id", CLIENT_ID)
    .order("created_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);

  const [carouselsRes, failedRunsRes] = await Promise.all([
    query,
    sb
      .from("runs")
      .select("id, error, finished_at, created_at, topics(he_label)")
      .eq("client_id", CLIENT_ID)
      .eq("status", "failed")
      .gte("created_at", failedRunsSinceIso())
      .order("created_at", { ascending: false }),
  ]);

  if (carouselsRes.error)
    return <ErrorShell message={`DB error: ${carouselsRes.error.message}`} />;

  const carousels = (carouselsRes.data ?? []) as CarouselRow[];
  // Failed runs only render on the unfiltered "all" view — the status tabs
  // refer to carousel status, and a failed run never produced a carousel, so
  // showing it under e.g. "ממתין לאישור" would be confusing.
  const failedRuns =
    !status || status === "all"
      ? ((failedRunsRes.data ?? []) as FailedRunRow[])
      : [];

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-8">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          קרוסלות
        </p>
        <h1 className="font-display text-navy mt-2 text-4xl font-black">
          כל הקרוסלות שיוצרו
        </h1>
        <p className="text-muted mt-3 text-sm">{carousels.length} קרוסלות</p>
      </header>

      <nav className="border-navy/10 mb-8 flex gap-1 border-b">
        {STATUS_TABS.map((tab) => {
          const active =
            (status ?? "all") === tab.value ||
            (!status && tab.value === "all");
          const href =
            tab.value === "all" ? "/carousels" : `/carousels?status=${tab.value}`;
          return (
            <Link
              key={tab.value}
              href={href}
              className={`-mb-px border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                active
                  ? "border-gold text-navy"
                  : "text-muted hover:text-navy border-transparent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {failedRuns.length > 0 ? (
        <details className="border-navy/10 mb-8 rounded-2xl border bg-white p-4 shadow-sm open:bg-cream-soft">
          <summary className="font-display text-navy cursor-pointer text-sm font-bold">
            ריצות שנכשלו לאחרונה{" "}
            <span className="text-muted text-xs font-normal">
              ({failedRuns.length})
            </span>
          </summary>
          <ul className="divide-navy/10 mt-3 divide-y">
            {failedRuns.map((run) => {
              const topic = Array.isArray(run.topics)
                ? run.topics[0]
                : run.topics;
              const when = new Date(
                run.finished_at ?? run.created_at,
              ).toLocaleString("he-IL", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
              });
              return (
                <li key={run.id} className="py-3">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-navy text-sm font-semibold">
                      {topic?.he_label ?? "ללא נושא"}
                    </p>
                    <span className="text-muted shrink-0 text-xs">{when}</span>
                  </div>
                  <details className="mt-1">
                    <summary className="text-muted hover:text-navy cursor-pointer text-xs">
                      פרטי שגיאה
                    </summary>
                    <pre className="bg-navy/5 text-navy mt-2 max-h-48 overflow-auto rounded-md p-3 text-left font-mono text-[11px] whitespace-pre-wrap">
                      {run.error ?? "ללא פירוט"}
                    </pre>
                  </details>
                </li>
              );
            })}
          </ul>
        </details>
      ) : null}

      {carousels.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-muted text-sm">
            {status && status !== "all" && status in STATUS_EMPTY_COPY
              ? STATUS_EMPTY_COPY[status as CarouselStatus]
              : "אין קרוסלות להצגה כאן עדיין."}
          </p>
          {status && status !== "all" ? (
            <Link
              href="/carousels"
              className="text-navy hover:text-gold mt-3 inline-block text-xs font-semibold underline-offset-4 hover:underline"
            >
              הצג את כל הקרוסלות
            </Link>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {carousels.map((c) => (
            <li key={c.id}>
              <CarouselCard carousel={c} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

function CarouselCard({ carousel }: { carousel: CarouselRow }) {
  const hookSlide = carousel.slides_he?.[0];
  const tipsCount = (carousel.slides_he?.length ?? 0) - 2;
  const created = new Date(carousel.created_at).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const isRejected = carousel.status === "rejected";

  return (
    <article className="border-navy/10 hover:border-gold hover:shadow-md group flex flex-col overflow-hidden rounded-2xl border bg-white shadow-sm transition-all">
      <Link
        href={`/preview?runId=${carousel.run_id}&idx=${carousel.idx}`}
        className="flex flex-1 flex-col"
      >
        <div className="bg-navy text-cream relative aspect-[4/5] p-6">
          <div className="text-gold absolute top-4 left-4 font-display text-xs font-bold tracking-[0.15em]">
            PFT
          </div>
          <div className="text-gold/60 absolute top-4 right-4 font-display text-2xl font-black">
            {String(carousel.idx + 1).padStart(2, "0")}
          </div>
          <div className="flex h-full flex-col justify-end">
            <p className="font-display group-hover:text-gold text-xl leading-tight font-black transition-colors">
              {hookSlide?.headline ?? carousel.concept}
            </p>
          </div>
        </div>
        <div className="space-y-2 px-5 py-4">
          <div className="flex items-center justify-between gap-2">
            <CarouselStatusBadge status={carousel.status} />
            <span className="text-muted text-xs">{created}</span>
          </div>
          <p className="text-navy/70 line-clamp-2 text-sm">{carousel.concept}</p>
          <p className="text-muted text-xs">
            {tipsCount} טיפים · {carousel.angle}
          </p>
        </div>
      </Link>
      {isRejected ? (
        <form action={regenerateAction} className="border-navy/10 border-t px-5 py-3">
          <input type="hidden" name="carouselId" value={carousel.id} />
          <button
            type="submit"
            className="text-navy hover:bg-navy hover:text-cream w-full rounded-full border border-navy/20 px-3 py-2 text-xs font-semibold transition-colors"
          >
            הפק שוב
          </button>
        </form>
      ) : null}
    </article>
  );
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
