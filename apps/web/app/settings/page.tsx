import { getAuthSupabase, getCurrentUser } from "@/lib/supabase-auth";
import { saveKeysAction, toggleCronAction } from "./actions";

export const dynamic = "force-dynamic";

interface SettingsRow {
  anthropic_key_ciphertext: string | null;
  apify_key_ciphertext: string | null;
  cron_paused: boolean;
  updated_at: string;
}

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    // proxy.ts guarantees this won't happen, but keeps types honest.
    return null;
  }

  const sb = await getAuthSupabase();
  const { data } = await sb
    .from("app_settings")
    .select("anthropic_key_ciphertext, apify_key_ciphertext, cron_paused, updated_at")
    .eq("client_id", user.id)
    .maybeSingle<SettingsRow>();

  const hasAnthropic = Boolean(data?.anthropic_key_ciphertext);
  const hasApify = Boolean(data?.apify_key_ciphertext);
  const cronPaused = data?.cron_paused ?? false;
  const savedFlag = (await searchParams).saved;
  const savedMessage =
    savedFlag === "1"
      ? "המפתחות נשמרו בהצלחה."
      : savedFlag === "empty"
        ? "לא הוזנו ערכים חדשים — לא בוצע שינוי."
        : null;

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          הגדרות
        </p>
        <h1 className="font-display text-navy mt-2 text-4xl font-black">
          מפתחות וצינור הפקה
        </h1>
        <p className="text-muted mt-3 text-sm">
          המפתחות נשמרים מוצפנים בבסיס הנתונים. רק שדות שמולאו יישמרו —
          השאר ריק כדי לא לשנות.
        </p>
      </header>

      <section className="border-navy/10 mb-8 rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="font-display text-navy text-xl font-black">מפתחות API</h2>

        <form action={saveKeysAction} className="mt-6 space-y-5">
          <div>
            <label
              htmlFor="anthropic_key"
              className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
            >
              Anthropic API Key{" "}
              {hasAnthropic ? (
                <span className="text-gold">· מוגדר</span>
              ) : (
                <span className="text-red-700">· חסר</span>
              )}
            </label>
            <input
              id="anthropic_key"
              name="anthropic_key"
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={hasAnthropic ? "•••••••• (הזן כדי להחליף)" : "sk-ant-..."}
              className="border-navy/20 focus:border-gold w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm outline-none"
            />
          </div>

          <div>
            <label
              htmlFor="apify_key"
              className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
            >
              Apify API Token{" "}
              {hasApify ? (
                <span className="text-gold">· מוגדר</span>
              ) : (
                <span className="text-red-700">· חסר</span>
              )}
            </label>
            <input
              id="apify_key"
              name="apify_key"
              type="password"
              dir="ltr"
              autoComplete="off"
              placeholder={hasApify ? "•••••••• (הזן כדי להחליף)" : "apify_api_..."}
              className="border-navy/20 focus:border-gold w-full rounded-xl border bg-white px-4 py-3 font-mono text-sm outline-none"
            />
          </div>

          <button
            type="submit"
            className="bg-navy text-cream hover:bg-navy-soft rounded-full px-6 py-3 text-sm font-semibold transition-colors"
          >
            שמור מפתחות
          </button>

          {savedMessage ? (
            <p
              className={`mt-2 text-sm ${
                savedFlag === "1" ? "text-gold font-semibold" : "text-muted"
              }`}
            >
              {savedMessage}
            </p>
          ) : null}
        </form>
      </section>

      <section className="border-navy/10 rounded-2xl border bg-white p-8 shadow-sm">
        <h2 className="font-display text-navy text-xl font-black">הפקה אוטומטית</h2>
        <p className="text-muted mt-2 text-sm">
          הקרון רץ ראשון וחמישי בשעה 06:00 שעון ישראל ומפיק 2 קרוסלות.
          השהיה זמנית עוצרת את ההפקה האוטומטית עד הפעלה מחדש.
        </p>

        <div className="mt-6 flex items-center justify-between gap-4">
          <div>
            <p className="font-display text-navy text-lg font-semibold">
              מצב נוכחי
            </p>
            <p className="text-muted mt-1 text-sm">
              {cronPaused ? "מושהה — הקרון לא ירוץ" : "פעיל — הקרון ירוץ בזמן"}
            </p>
          </div>
          <form action={toggleCronAction}>
            <input type="hidden" name="paused" value={cronPaused ? "false" : "true"} />
            <button
              type="submit"
              className={
                cronPaused
                  ? "bg-gold text-navy hover:bg-gold/90 rounded-full px-6 py-3 text-sm font-semibold transition-colors"
                  : "border-navy/20 text-navy hover:bg-navy/5 rounded-full border px-6 py-3 text-sm font-semibold transition-colors"
              }
            >
              {cronPaused ? "הפעל מחדש" : "השהה"}
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
