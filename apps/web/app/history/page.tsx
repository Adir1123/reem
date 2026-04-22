import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import type { Slide } from "@reem/types";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.CLIENT_ID;
const DEFAULT_LOOKBACK_DAYS = 90;

interface HistoryRow {
  id: string;
  run_id: string;
  idx: number;
  concept: string;
  angle: string;
  posted_at: string;
  posted_via: string | null;
  slides_he: Slide[];
}

interface Props {
  searchParams: Promise<{ from?: string; to?: string }>;
}

// Parse a YYYY-MM-DD date input value into a UTC ISO string at the boundary
// the user means: "from" floors to start-of-day, "to" ceilings to end-of-day,
// so a single-day range (from=2026-04-22&to=2026-04-22) actually includes
// everything posted on that day.
function parseBound(raw: string | undefined, edge: "start" | "end"): string | null {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return null;
  const time = edge === "start" ? "T00:00:00.000Z" : "T23:59:59.999Z";
  const iso = `${raw}${time}`;
  const d = new Date(iso);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10);
}

// Wrap the impure Date.now() call so React's purity lint stays quiet inside
// the server component body — still evaluated per request.
function defaultFromIso(): string {
  return new Date(
    Date.now() - DEFAULT_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

function nowIso(): string {
  return new Date().toISOString();
}

export default async function HistoryPage({ searchParams }: Props) {
  if (!CLIENT_ID) return <ErrorShell message="CLIENT_ID env var not set." />;
  const { from, to } = await searchParams;
  const sb = getServiceClient();

  const fromIso = parseBound(from, "start") ?? defaultFromIso();
  const toIso = parseBound(to, "end");
  const fromInputValue = toDateInputValue(fromIso);
  const toInputValue = to ? toDateInputValue(toIso ?? nowIso()) : "";

  let query = sb
    .from("carousels")
    .select("id, run_id, idx, concept, angle, posted_at, posted_via, slides_he")
    .eq("client_id", CLIENT_ID)
    .eq("status", "posted")
    .gte("posted_at", fromIso)
    .order("posted_at", { ascending: false });
  if (toIso) query = query.lte("posted_at", toIso);

  const { data, error } = await query;

  if (error) return <ErrorShell message={`DB error: ${error.message}`} />;
  const rows = (data ?? []) as HistoryRow[];
  const filterActive = Boolean(from || to);

  const byMonth = new Map<string, HistoryRow[]>();
  for (const r of rows) {
    const d = new Date(r.posted_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const list = byMonth.get(key) ?? [];
    list.push(r);
    byMonth.set(key, list);
  }
  const months = [...byMonth.keys()].sort().reverse();

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          היסטוריה
        </p>
        <h1 className="font-display text-navy mt-2 text-4xl font-black">
          קרוסלות שפורסמו
        </h1>
        <p className="text-muted mt-3 text-sm">
          {rows.length} קרוסלות פורסמו
          {filterActive ? null : ` ב־${DEFAULT_LOOKBACK_DAYS} הימים האחרונים`}
        </p>
      </header>

      <form
        method="get"
        action="/history"
        className="border-navy/10 mb-8 flex flex-wrap items-end gap-3 rounded-2xl border bg-white p-4 shadow-sm"
      >
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted font-semibold">מתאריך</span>
          <input
            type="date"
            name="from"
            defaultValue={fromInputValue}
            className="border-navy/15 text-navy rounded-lg border bg-white px-3 py-2 text-sm"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs">
          <span className="text-muted font-semibold">עד תאריך</span>
          <input
            type="date"
            name="to"
            defaultValue={toInputValue}
            className="border-navy/15 text-navy rounded-lg border bg-white px-3 py-2 text-sm"
          />
        </label>
        <button
          type="submit"
          className="bg-navy text-cream hover:bg-navy-soft rounded-full px-4 py-2 text-sm font-semibold transition-colors"
        >
          סנן
        </button>
        {filterActive ? (
          <Link
            href="/history"
            className="text-muted hover:text-navy text-xs font-semibold underline-offset-4 hover:underline"
          >
            איפוס
          </Link>
        ) : null}
      </form>

      {rows.length === 0 ? (
        <p className="text-muted py-16 text-center text-sm">
          {filterActive
            ? "אין קרוסלות שפורסמו בטווח התאריכים הנבחר."
            : "טרם פורסמו קרוסלות. ההיסטוריה תתעדכן ברגע שתורד הקרוסלה הראשונה."}
        </p>
      ) : (
        <div className="space-y-12">
          {months.map((month) => {
            const list = byMonth.get(month) ?? [];
            const label = formatMonth(month);
            return (
              <section key={month}>
                <h2 className="font-display text-navy mb-4 flex items-baseline gap-3 text-2xl font-black">
                  {label}
                  <span className="text-muted text-sm font-normal">
                    {list.length}
                  </span>
                </h2>
                <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  {list.map((c) => (
                    <li key={c.id}>
                      <HistoryCard row={c} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}

function HistoryCard({ row }: { row: HistoryRow }) {
  const hook = row.slides_he?.[0];
  const tipsCount = (row.slides_he?.length ?? 0) - 2;
  const posted = new Date(row.posted_at).toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  return (
    <Link
      href={`/preview?runId=${row.run_id}&idx=${row.idx}`}
      className="border-navy/10 hover:border-gold hover:shadow-md group block overflow-hidden rounded-2xl border bg-white shadow-sm transition-all"
    >
      <div className="bg-navy text-cream relative aspect-[4/5] p-6">
        <div className="text-gold absolute top-4 left-4 font-display text-xs font-bold tracking-[0.15em]">
          PFT
        </div>
        <div className="text-gold/60 absolute top-4 right-4 font-display text-2xl font-black">
          {String(row.idx + 1).padStart(2, "0")}
        </div>
        <div className="flex h-full flex-col justify-end">
          <p className="font-display group-hover:text-gold text-xl leading-tight font-black transition-colors">
            {hook?.headline ?? row.concept}
          </p>
        </div>
      </div>
      <div className="space-y-2 px-5 py-4">
        <div className="flex items-center justify-between gap-2">
          <span className="bg-gold/15 text-navy rounded-full px-3 py-1 text-xs font-semibold">
            פורסם · {posted}
          </span>
          {row.posted_via ? (
            <span className="text-muted text-xs">{labelVia(row.posted_via)}</span>
          ) : null}
        </div>
        <p className="text-navy/70 line-clamp-2 text-sm">{row.concept}</p>
        <p className="text-muted text-xs">
          {tipsCount} טיפים · {row.angle}
        </p>
      </div>
    </Link>
  );
}

function labelVia(via: string): string {
  if (via === "manual_download") return "הורדה ידנית";
  return via;
}

function formatMonth(key: string): string {
  const [yStr, mStr] = key.split("-");
  const y = Number(yStr);
  const m = Number(mStr);
  if (!y || !m) return key;
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString("he-IL", { month: "long", year: "numeric" });
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
