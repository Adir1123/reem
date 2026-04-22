import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { TopicStatusBadge } from "@/components/StatusBadge";
import { triggerGenerationAction, cancelGenerationAction } from "./actions";
import { TriggerButton } from "@/components/topics/TriggerButton";
import { TopicAutoRefresh } from "@/components/topics/TopicAutoRefresh";
import type { TopicStatus, Theme } from "@reem/types";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.CLIENT_ID;

const THEME_LABELS: Record<Theme, string> = {
  saving: "חיסכון",
  investing: "השקעות",
  debt: "חוב",
  mindset: "תפיסה",
  tools: "כלים",
};

const THEME_ORDER: Theme[] = ["saving", "investing", "debt", "mindset", "tools"];

interface TopicRow {
  id: string;
  he_label: string;
  en_query: string;
  theme: Theme;
  status: TopicStatus;
  used_at: string | null;
  times_posted: number;
}

export default async function TopicsPage() {
  if (!CLIENT_ID) return <ErrorShell message="CLIENT_ID env var not set." />;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("topics")
    .select("id, he_label, en_query, theme, status, used_at, times_posted")
    .eq("client_id", CLIENT_ID)
    .order("theme", { ascending: true })
    .order("he_label", { ascending: true });
  if (error) return <ErrorShell message={`DB error: ${error.message}`} />;
  if (!data) return <ErrorShell message="לא נמצאו נושאים." />;

  const allTopics = data as TopicRow[];
  // Exhausted topics are surfaced in their own collapsed section so the main
  // list isn't cluttered with dead ends — but they're still findable.
  const topics = allTopics.filter((t) => t.status !== "exhausted");
  const exhausted = allTopics.filter((t) => t.status === "exhausted");
  const byTheme = new Map<Theme, TopicRow[]>();
  for (const t of topics) {
    const list = byTheme.get(t.theme) ?? [];
    list.push(t);
    byTheme.set(t.theme, list);
  }

  const counts = allTopics.reduce(
    (acc, t) => {
      acc[t.status] = (acc[t.status] ?? 0) + 1;
      return acc;
    },
    {} as Record<TopicStatus, number>,
  );

  const hasGenerating = (counts.generating ?? 0) > 0;

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-6 py-12">
      <TopicAutoRefresh hasGenerating={hasGenerating} />
      <header className="mb-10 flex items-start justify-between gap-6">
        <div>
          <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
            נושאים
          </p>
          <h1 className="font-display text-navy mt-2 text-4xl font-black">
            בחר נושא להפקת קרוסלה
          </h1>
          <p className="text-muted mt-3 text-sm">
            {topics.length} נושאים ·{" "}
            <span className="text-navy font-semibold">
              {counts.available ?? 0}
            </span>{" "}
            פנויים · {counts.generating ?? 0} מייצרים ·{" "}
            {counts.pending_review ?? 0} ממתינים · {counts.posted ?? 0} פורסמו
          </p>
        </div>
        <Link
          href="/topics/new"
          className="bg-navy text-cream hover:bg-navy-soft shrink-0 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
        >
          + נושא חדש
        </Link>
      </header>

      <div className="space-y-12">
        {THEME_ORDER.map((theme) => {
          const list = byTheme.get(theme) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={theme}>
              <h2 className="font-display text-navy mb-4 flex items-baseline gap-3 text-2xl font-black">
                {THEME_LABELS[theme]}
                <span className="text-muted text-sm font-normal">
                  {list.length}
                </span>
              </h2>
              <ul className="divide-navy/10 border-navy/10 divide-y rounded-2xl border bg-white shadow-sm">
                {list.map((topic) => (
                  <li
                    key={topic.id}
                    className="flex items-center justify-between gap-4 px-5 py-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="font-display text-navy truncate text-lg font-semibold">
                          {topic.he_label}
                        </p>
                        <TopicStatusBadge status={topic.status} />
                        {topic.times_posted > 0 ? (
                          <span className="text-muted bg-navy/5 rounded-full px-2 py-0.5 text-[11px] font-semibold">
                            פורסם {topic.times_posted}×
                          </span>
                        ) : null}
                      </div>
                      <p
                        dir="ltr"
                        className="text-muted mt-1 truncate text-xs"
                      >
                        {topic.en_query}
                      </p>
                    </div>
                    {topic.status === "generating" ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-navy/20 text-navy/50 rounded-full px-5 py-2 text-sm font-semibold">
                          בעבודה…
                        </span>
                        <form action={cancelGenerationAction}>
                          <input type="hidden" name="topicId" value={topic.id} />
                          <button
                            type="submit"
                            className="text-muted hover:text-red-700 rounded-full border border-navy/15 px-3 py-2 text-xs font-semibold transition-colors"
                          >
                            ביטול
                          </button>
                        </form>
                      </div>
                    ) : (
                      <form action={triggerGenerationAction}>
                        <input type="hidden" name="topicId" value={topic.id} />
                        <TriggerButton disabled={topic.status !== "available"}>
                          {topic.status === "available"
                            ? "הפק קרוסלה"
                            : topic.status === "pending_review"
                              ? "בתור אישור"
                              : topic.status === "exhausted"
                                ? "מוצה"
                                : "פורסם"}
                        </TriggerButton>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        {exhausted.length > 0 ? (
          <details className="border-navy/10 rounded-2xl border bg-white/40 p-5 shadow-sm">
            <summary className="font-display text-navy/70 cursor-pointer text-base font-semibold">
              נושאים שמוצו{" "}
              <span className="text-muted text-sm font-normal">
                ({exhausted.length})
              </span>
            </summary>
            <ul className="divide-navy/10 mt-3 divide-y">
              {exhausted.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-navy/80 truncate text-sm font-semibold">
                      {t.he_label}
                    </p>
                    <p
                      dir="ltr"
                      className="text-muted mt-0.5 truncate text-xs"
                    >
                      {t.en_query}
                    </p>
                  </div>
                  <span className="text-muted text-xs">
                    פורסם {t.times_posted}× · אזל
                  </span>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </div>
    </main>
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
