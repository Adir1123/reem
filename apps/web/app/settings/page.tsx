import { getAuthSupabase, getCurrentUser } from "@/lib/supabase-auth";
import { getServiceClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/reem/PageHeader";
import { saveKeysAction, toggleCronAction } from "./actions";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.CLIENT_ID;
const FAILED_RUN_LOOKBACK_DAYS = 14;

interface SettingsRow {
  anthropic_key_ciphertext: string | null;
  apify_key_ciphertext: string | null;
  cron_paused: boolean;
  updated_at: string;
}

interface FailedRunRow {
  id: string;
  error: string | null;
  finished_at: string | null;
  created_at: string;
  topics: { he_label: string } | { he_label: string }[] | null;
}

function failedRunsSinceIso(): string {
  return new Date(
    Date.now() - FAILED_RUN_LOOKBACK_DAYS * 24 * 60 * 60 * 1000,
  ).toISOString();
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    return null;
  }

  const sb = await getAuthSupabase();
  const settingsPromise = sb
    .from("app_settings")
    .select("anthropic_key_ciphertext, apify_key_ciphertext, cron_paused, updated_at")
    .eq("client_id", user.id)
    .maybeSingle<SettingsRow>();

  const failedRunsPromise = CLIENT_ID
    ? getServiceClient()
        .from("runs")
        .select("id, error, finished_at, created_at, topics(he_label)")
        .eq("client_id", CLIENT_ID)
        .eq("status", "failed")
        .gte("created_at", failedRunsSinceIso())
        .order("created_at", { ascending: false })
    : Promise.resolve({ data: [] as FailedRunRow[], error: null });

  const [{ data }, failedRunsRes] = await Promise.all([
    settingsPromise,
    failedRunsPromise,
  ]);

  const hasAnthropic = Boolean(data?.anthropic_key_ciphertext);
  const hasApify = Boolean(data?.apify_key_ciphertext);
  const cronPaused = data?.cron_paused ?? false;
  const failedRuns = (failedRunsRes.data ?? []) as FailedRunRow[];
  const savedFlag = (await searchParams).saved;
  const savedMessage =
    savedFlag === "1"
      ? "המפתחות נשמרו בהצלחה."
      : savedFlag === "empty"
        ? "לא הוזנו ערכים חדשים — לא בוצע שינוי."
        : null;

  return (
    <main className="reem-page" dir="rtl">
      <PageHeader
        eyebrow="הגדרות"
        title="מפתחות ואוטומציה"
        sub="המפתחות נשמרים מוצפנים בבסיס הנתונים. רק שדות שמולאו יישמרו — השאר ריק כדי לא לשנות."
        ornament
      />

      <div className="mx-auto max-w-3xl space-y-12">
        <section>
          <h2 className="text-cream font-display mb-6 text-center text-2xl italic">
            מפתחות API
          </h2>

          <form action={saveKeysAction} className="space-y-2">
            <div className="reem-field">
              <label htmlFor="anthropic_key" className="reem-field-label">
                Anthropic API Key{" "}
                {hasAnthropic ? (
                  <span className="text-gold-warm">· מוגדר</span>
                ) : (
                  <span className="text-cream/45">· חסר</span>
                )}
              </label>
              <input
                id="anthropic_key"
                name="anthropic_key"
                type="password"
                dir="ltr"
                autoComplete="off"
                placeholder={hasAnthropic ? "•••••••• (הזן כדי להחליף)" : "sk-ant-..."}
                className="reem-field-input font-mono"
              />
            </div>

            <div className="reem-field">
              <label htmlFor="apify_key" className="reem-field-label">
                Apify API Token{" "}
                {hasApify ? (
                  <span className="text-gold-warm">· מוגדר</span>
                ) : (
                  <span className="text-cream/45">· חסר</span>
                )}
              </label>
              <input
                id="apify_key"
                name="apify_key"
                type="password"
                dir="ltr"
                autoComplete="off"
                placeholder={hasApify ? "•••••••• (הזן כדי להחליף)" : "apify_api_..."}
                className="reem-field-input font-mono"
              />
            </div>

            <div className="border-rule flex items-center justify-between border-t pt-6">
              {savedMessage ? (
                <p
                  className={
                    savedFlag === "1" ? "text-gold-warm text-sm" : "text-cream/55 text-sm"
                  }
                >
                  {savedMessage}
                </p>
              ) : (
                <span />
              )}
              <button
                type="submit"
                className="border-gold-warm text-cream hover:text-gold-warm border-b px-4 py-2 text-xs tracking-[0.36em] uppercase transition-colors"
              >
                שמור מפתחות
              </button>
            </div>
          </form>
        </section>

        <section className="border-rule border-t pt-12">
          <h2 className="text-cream font-display mb-3 text-center text-2xl italic">
            הפקה אוטומטית
          </h2>
          <p className="text-cream/55 mx-auto max-w-xl text-center text-sm leading-relaxed">
            האוטומציה תרוץ בראשון ובחמישי בשעה 06:00 בבוקר ותפיק 2 קרוסלות.
            השהיה עוצרת את ההפקה האוטומטית עד להפעלה מחדש.
          </p>

          <div className="mt-8 flex items-center justify-between gap-4">
            <div>
              <p className="text-cream font-display text-lg italic">
                מצב נוכחי
              </p>
              <p className="text-cream/70 mt-1 text-sm">
                {cronPaused ? "מושהה" : "פעיל"}
              </p>
            </div>
            <form action={toggleCronAction}>
              <input type="hidden" name="paused" value={cronPaused ? "false" : "true"} />
              <button
                type="submit"
                className="border-gold-warm text-cream hover:text-gold-warm border-b px-4 py-2 text-xs tracking-[0.36em] uppercase transition-colors"
              >
                {cronPaused ? "הפעל מחדש" : "השהה"}
              </button>
            </form>
          </div>
        </section>

        <section className="border-rule border-t pt-12">
          <h2 className="text-cream font-display mb-3 text-center text-2xl italic">
            ריצות שנכשלו לאחרונה
          </h2>
          <p className="text-cream/55 mx-auto max-w-xl text-center text-sm">
            {failedRuns.length === 0
              ? "אין ריצות שנכשלו ב־14 הימים האחרונים."
              : `${failedRuns.length} ריצות שנכשלו ב־14 הימים האחרונים.`}
          </p>

          {failedRuns.length > 0 ? (
            <details className="bg-bg-card border-rule mt-6 rounded-md border p-4">
              <summary className="text-cream cursor-pointer text-sm font-medium">
                הצג פרטים
              </summary>
              <ul className="mt-4">
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
                    <li
                      key={run.id}
                      className="border-rule border-t py-3 first:border-t-0"
                    >
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-cream text-sm">
                          {topic?.he_label ?? "ללא נושא"}
                        </p>
                        <span className="text-cream/55 shrink-0 text-xs">
                          {when}
                        </span>
                      </div>
                      <details className="mt-1">
                        <summary className="text-cream/60 hover:text-cream cursor-pointer text-xs">
                          פרטי שגיאה
                        </summary>
                        <pre className="bg-bg-card-2 text-cream/80 mt-2 max-h-48 overflow-auto rounded-md p-3 text-left font-mono text-[11px] whitespace-pre-wrap">
                          {run.error ?? "ללא פירוט"}
                        </pre>
                      </details>
                    </li>
                  );
                })}
              </ul>
            </details>
          ) : null}
        </section>
      </div>
    </main>
  );
}
