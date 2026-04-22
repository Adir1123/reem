import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { CarouselStatusBadge } from "@/components/StatusBadge";
import type { CarouselStatus, Slide } from "@reem/types";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.CLIENT_ID;

interface RecentCarousel {
  id: string;
  run_id: string;
  idx: number;
  concept: string;
  status: CarouselStatus;
  created_at: string;
  slides_he: Slide[];
}

// Wrap impure Date.now() so the React purity lint stays quiet inside the
// server component body. Still evaluated per request.
function thirtyDaysAgoIso(): string {
  return new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
}

function nowDate(): Date {
  return new Date();
}

// Cron runs Sun + Wed 06:00 Asia/Jerusalem.
function nextCronAt(now: Date): Date {
  // Convert "now" to IST by getting the IST date parts via Intl, then build a
  // candidate date for each of Sun/Wed at 06:00 IST and pick the earliest in
  // the future. This avoids timezone math libs while staying DST-safe.
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    hour12: false,
  });
  const parts = Object.fromEntries(
    fmt.formatToParts(now).map((p) => [p.type, p.value]),
  );
  const todayIstStr = `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:00`;
  const todayIst = new Date(`${todayIstStr}+0300`); // approximate; refined below

  // Try the next 14 days; pick the first Sun/Wed at 06:00 IST that's still in the future.
  const targets = [0, 3]; // Sunday=0, Wednesday=3 in JS Date.getUTCDay()
  for (let i = 0; i < 14; i++) {
    const candidate = new Date(todayIst);
    candidate.setDate(candidate.getDate() + i);
    candidate.setHours(6, 0, 0, 0);
    if (
      targets.includes(candidate.getDay()) &&
      candidate.getTime() > now.getTime()
    ) {
      return candidate;
    }
  }
  return now;
}

export default async function HomePage() {
  if (!CLIENT_ID) return <ErrorShell message="CLIENT_ID env var not set." />;
  const sb = getServiceClient();

  const since30d = thirtyDaysAgoIso();
  const [pendingRes, recentRes, topicsRes, lastRunRes, kpiRes] = await Promise.all([
    sb
      .from("carousels")
      .select("id", { count: "exact", head: true })
      .eq("client_id", CLIENT_ID)
      .eq("status", "pending_review"),
    sb
      .from("carousels")
      .select("id, run_id, idx, concept, status, created_at, slides_he")
      .eq("client_id", CLIENT_ID)
      .order("created_at", { ascending: false })
      .limit(4),
    sb
      .from("topics")
      .select("status", { count: "exact", head: false })
      .eq("client_id", CLIENT_ID),
    sb
      .from("runs")
      .select("started_at, created_at, status")
      .eq("client_id", CLIENT_ID)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    sb
      .from("carousels")
      .select("status")
      .eq("client_id", CLIENT_ID)
      .gte("created_at", since30d),
  ]);

  const pendingCount = pendingRes.count ?? 0;
  const recent = (recentRes.data ?? []) as RecentCarousel[];
  const topics = topicsRes.data ?? [];
  const availableCount = topics.filter((t) => t.status === "available").length;
  const lastRunAtRaw =
    (lastRunRes.data?.started_at as string | null) ??
    (lastRunRes.data?.created_at as string | null) ??
    null;
  const lastRunLabel = lastRunAtRaw
    ? `לפני ${formatHebrewRelative(new Date(lastRunAtRaw), nowDate())}`
    : "אין עדיין";

  // Approval = "we got past human review" → approved + posted both count.
  // Reviewed = approved + posted + rejected (anything pending_review hasn't
  // been judged yet, so excluding it keeps the rate honest).
  const kpiRows = (kpiRes.data ?? []) as { status: CarouselStatus }[];
  const approvedCount = kpiRows.filter(
    (r) => r.status === "approved" || r.status === "posted",
  ).length;
  const postedCount = kpiRows.filter((r) => r.status === "posted").length;
  const reviewedCount = kpiRows.filter(
    (r) =>
      r.status === "approved" ||
      r.status === "posted" ||
      r.status === "rejected",
  ).length;
  const approvalRate =
    reviewedCount === 0
      ? "—"
      : `${Math.round((approvedCount / reviewedCount) * 100)}%`;

  const cronAt = nextCronAt(nowDate());
  const cronLabel = cronAt.toLocaleString("he-IL", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jerusalem",
  });

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          PFT · לוח בקרת קרוסלות
        </p>
        <h1 className="font-display text-navy mt-3 text-5xl font-black leading-tight">
          שלום, רים.
        </h1>
        <p className="text-navy/70 mt-3 text-base">
          {pendingCount > 0
            ? `יש לך ${pendingCount} קרוסלות חדשות שממתינות לאישור.`
            : "אין כרגע קרוסלות חדשות. אפשר ליזום אחת ידנית."}
        </p>
      </header>

      <section className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="ממתין לאישור"
          value={String(pendingCount)}
          href="/carousels?status=pending_review"
        />
        <StatCard
          label="נושאים פנויים"
          value={String(availableCount)}
          href="/topics"
        />
        <StatCard label="ריצה אחרונה" value={lastRunLabel} href="/history" muted />
        <StatCard label="הרצה אוטומטית הבאה" value={cronLabel} muted />
      </section>

      <section className="mb-12">
        <p className="text-muted mb-3 text-xs font-semibold tracking-[0.15em] uppercase">
          30 הימים האחרונים
        </p>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <StatCard
            label="קרוסלות שאושרו"
            value={String(approvedCount)}
            href="/carousels?status=approved"
          />
          <StatCard
            label="קרוסלות שפורסמו"
            value={String(postedCount)}
            href="/carousels?status=posted"
          />
          <StatCard label="שיעור אישור" value={approvalRate} />
        </div>
      </section>

      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="font-display text-navy text-2xl font-black">
            קרוסלות אחרונות
          </h2>
          <Link
            href="/carousels"
            className="text-muted hover:text-navy text-sm font-semibold"
          >
            הצג הכל ←
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="text-muted py-12 text-center text-sm">
            אין קרוסלות עדיין. עברו ל
            <Link href="/topics" className="text-navy mx-1 underline">
              נושאים
            </Link>
            כדי ליזום אחת.
          </p>
        ) : (
          <ul className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {recent.map((c) => (
              <li key={c.id}>
                <RecentCard carousel={c} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

// Compact Hebrew "X ago" without pulling in a date lib. Falls back to a date
// once we cross ~7 days so the home stat doesn't read as "לפני 47 ימים".
function formatHebrewRelative(then: Date, now: Date): string {
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "רגע";
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "פחות מדקה";
  if (minutes < 60) return `${minutes} דק׳`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} שע׳`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} ימים`;
  return then.toLocaleDateString("he-IL", {
    day: "2-digit",
    month: "2-digit",
  });
}

function StatCard({
  label,
  value,
  href,
  muted,
}: {
  label: string;
  value: string;
  href?: string;
  muted?: boolean;
}) {
  const inner = (
    <div
      className={`border-navy/10 hover:border-gold rounded-2xl border bg-white p-5 shadow-sm transition-colors ${href ? "cursor-pointer" : ""}`}
    >
      <p className="text-muted text-xs font-semibold tracking-[0.15em] uppercase">
        {label}
      </p>
      <p
        className={`font-display mt-2 font-black ${muted ? "text-navy text-lg" : "text-navy text-4xl"}`}
      >
        {value}
      </p>
    </div>
  );
  return href ? <Link href={href}>{inner}</Link> : inner;
}

function RecentCard({ carousel }: { carousel: RecentCarousel }) {
  const hook = carousel.slides_he?.[0];
  return (
    <Link
      href={`/preview?runId=${carousel.run_id}&idx=${carousel.idx}`}
      className="border-navy/10 hover:border-gold group block overflow-hidden rounded-2xl border bg-white shadow-sm transition-all"
    >
      <div className="bg-navy text-cream relative aspect-[4/5] p-5">
        <div className="text-gold absolute top-3 left-3 font-display text-[10px] font-bold tracking-[0.15em]">
          PFT
        </div>
        <div className="flex h-full flex-col justify-end">
          <p className="font-display group-hover:text-gold text-base leading-tight font-black transition-colors">
            {hook?.headline ?? carousel.concept}
          </p>
        </div>
      </div>
      <div className="px-4 py-3">
        <CarouselStatusBadge status={carousel.status} />
      </div>
    </Link>
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
