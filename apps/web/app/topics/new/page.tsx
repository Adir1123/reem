import Link from "next/link";
import { createTopicAction } from "./actions";

export const dynamic = "force-dynamic";

const THEMES: { value: string; label: string }[] = [
  { value: "saving", label: "חיסכון" },
  { value: "investing", label: "השקעות" },
  { value: "debt", label: "חוב" },
  { value: "mindset", label: "תפיסה" },
  { value: "tools", label: "כלים" },
];

export default function NewTopicPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 px-6 py-12">
      <header className="mb-10">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          נושא חדש
        </p>
        <h1 className="font-display text-navy mt-2 text-4xl font-black">
          הוסף נושא להפקה
        </h1>
        <p className="text-muted mt-3 text-sm">
          התווית בעברית תוצג בלוח. החיפוש באנגלית מועבר לקריאת המקורות
          בפייפליין — חשוב שיהיה ספציפי וענייני.
        </p>
      </header>

      <form
        action={createTopicAction}
        className="border-navy/10 space-y-6 rounded-2xl border bg-white p-8 shadow-sm"
      >
        <div>
          <label
            htmlFor="he_label"
            className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
          >
            תווית בעברית
          </label>
          <input
            id="he_label"
            name="he_label"
            type="text"
            required
            placeholder="לדוגמה: איך לחסוך 1000 ש״ח בחודש"
            className="border-navy/20 focus:border-gold w-full rounded-xl border bg-white px-4 py-3 text-base outline-none"
          />
        </div>

        <div>
          <label
            htmlFor="en_query"
            className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
          >
            חיפוש באנגלית (לפייפליין)
          </label>
          <input
            id="en_query"
            name="en_query"
            type="text"
            required
            dir="ltr"
            placeholder="how to save 1000 dollars a month"
            className="border-navy/20 focus:border-gold w-full rounded-xl border bg-white px-4 py-3 text-base outline-none"
          />
          <p className="text-muted mt-2 text-xs">
            חיפוש ממוקד עובד טוב יותר מנושא רחב. הימנע ממילים כלליות מדי.
          </p>
        </div>

        <div>
          <label
            htmlFor="theme"
            className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
          >
            קטגוריה
          </label>
          <select
            id="theme"
            name="theme"
            required
            defaultValue="saving"
            className="border-navy/20 focus:border-gold w-full rounded-xl border bg-white px-4 py-3 text-base outline-none"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label
            htmlFor="notes"
            className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
          >
            הערות (אופציונלי)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="זווית, קהל יעד, או הקשר נוסף שיעזור בהפקה"
            className="border-navy/20 focus:border-gold w-full resize-none rounded-xl border bg-white px-4 py-3 text-base outline-none"
          />
        </div>

        <div className="flex items-center justify-between gap-4 pt-2">
          <Link
            href="/topics"
            className="text-muted hover:text-navy text-sm font-semibold transition-colors"
          >
            ביטול
          </Link>
          <button
            type="submit"
            className="bg-navy text-cream hover:bg-navy-soft rounded-full px-6 py-3 text-sm font-semibold transition-colors"
          >
            הוסף נושא
          </button>
        </div>
      </form>
    </main>
  );
}
