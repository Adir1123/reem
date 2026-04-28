import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { TopicStatusBadge } from "@/components/StatusBadge";
import { triggerGenerationAction, cancelGenerationAction } from "./actions";
import { TriggerButton } from "@/components/topics/TriggerButton";
import { TopicAutoRefresh } from "@/components/topics/TopicAutoRefresh";
import { PageHeader } from "@/components/reem/PageHeader";
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
    <main className="reem-page" dir="rtl">
      <TopicAutoRefresh hasGenerating={hasGenerating} />
      <PageHeader
        eyebrow="המעקב שלי"
        title="בחר נושא להפקת קרוסלה"
        sub={
          <>
            {topics.length} נושאים ·{" "}
            <span className="text-cream font-medium">
              {counts.available ?? 0}
            </span>{" "}
            פנויים · {counts.generating ?? 0} מייצרים ·{" "}
            {counts.pending_review ?? 0} ממתינים · {counts.posted ?? 0} פורסמו
          </>
        }
        ornament
      />

      <div className="mb-12 flex justify-center">
        <Link
          href="/topics/new"
          className="border-gold-warm text-cream hover:text-gold-warm border-b px-4 py-2 text-xs tracking-[0.36em] uppercase transition-colors"
        >
          + נושא חדש
        </Link>
      </div>

      <div className="space-y-16">
        {THEME_ORDER.map((theme) => {
          const list = byTheme.get(theme) ?? [];
          if (list.length === 0) return null;
          return (
            <section key={theme}>
              <h2 className="text-cream font-display mb-6 flex items-baseline justify-center gap-3 text-2xl italic">
                {THEME_LABELS[theme]}
                <span className="text-cream/55 font-body text-xs not-italic">
                  {list.length}
                </span>
              </h2>
              <ul className="border-rule divide-rule divide-y border-y">
                {list.map((topic) => (
                  <li
                    key={topic.id}
                    className="flex items-center justify-between gap-4 px-2 py-5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-3">
                        <p className="text-cream font-display truncate text-lg italic">
                          {topic.he_label}
                        </p>
                        <TopicStatusBadge status={topic.status} />
                        {topic.times_posted > 0 ? (
                          <span className="text-cream/55 bg-bg-card-2 rounded-full px-2 py-0.5 text-[11px]">
                            פורסם {topic.times_posted}×
                          </span>
                        ) : null}
                      </div>
                      <p
                        dir="ltr"
                        className="text-cream/45 mt-1 truncate text-xs"
                      >
                        {topic.en_query}
                      </p>
                    </div>
                    {topic.status === "generating" ? (
                      <div className="flex items-center gap-2">
                        <span className="bg-gold-base/15 text-gold-warm rounded-full px-4 py-2 text-xs">
                          בעבודה…
                        </span>
                        <form action={cancelGenerationAction}>
                          <input type="hidden" name="topicId" value={topic.id} />
                          <button
                            type="submit"
                            className="text-cream/55 hover:text-cream border-rule rounded-full border px-3 py-2 text-xs transition-colors"
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
          <details className="bg-bg-card border-rule rounded-md border p-5">
            <summary className="text-cream/70 cursor-pointer text-sm font-medium">
              נושאים שמוצו{" "}
              <span className="text-cream/45 text-xs font-normal">
                ({exhausted.length})
              </span>
            </summary>
            <ul className="divide-rule mt-4 divide-y">
              {exhausted.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-4 py-3"
                >
                  <div className="min-w-0">
                    <p className="text-cream/70 truncate text-sm">
                      {t.he_label}
                    </p>
                    <p
                      dir="ltr"
                      className="text-cream/45 mt-0.5 truncate text-xs"
                    >
                      {t.en_query}
                    </p>
                  </div>
                  <span className="text-cream/45 text-xs">
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
    <main className="reem-page flex flex-1 items-center justify-center">
      <div className="max-w-md text-center">
        <p className="text-cream/55">{message}</p>
      </div>
    </main>
  );
}
