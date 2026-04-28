import Link from "next/link";
import { PageHeader } from "@/components/reem/PageHeader";
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
    <main className="reem-page" dir="rtl">
      <PageHeader
        eyebrow="נושא חדש"
        title="הוסף נושא להפקה"
        sub="התווית בעברית תוצג בלוח. החיפוש באנגלית מועבר לקריאת המקורות בפייפליין — חשוב שיהיה ספציפי וענייני."
        ornament
      />

      <form
        action={createTopicAction}
        className="mx-auto max-w-2xl"
      >
        <div className="reem-field">
          <label htmlFor="he_label" className="reem-field-label">
            תווית בעברית
          </label>
          <input
            id="he_label"
            name="he_label"
            type="text"
            required
            placeholder="לדוגמה: איך לחסוך 1000 ש״ח בחודש"
            className="reem-field-input"
          />
        </div>

        <div className="reem-field">
          <label htmlFor="en_query" className="reem-field-label">
            חיפוש באנגלית (לפייפליין)
          </label>
          <input
            id="en_query"
            name="en_query"
            type="text"
            required
            dir="ltr"
            placeholder="how to save 1000 dollars a month"
            className="reem-field-input"
          />
          <p className="text-cream/45 mt-1 text-xs">
            חיפוש ממוקד עובד טוב יותר מנושא רחב. הימנע ממילים כלליות מדי.
          </p>
        </div>

        <div className="reem-field">
          <label htmlFor="theme" className="reem-field-label">
            קטגוריה
          </label>
          <select
            id="theme"
            name="theme"
            required
            defaultValue="saving"
            className="reem-field-select"
          >
            {THEMES.map((t) => (
              <option key={t.value} value={t.value} className="bg-bg-card">
                {t.label}
              </option>
            ))}
          </select>
        </div>

        <div className="reem-field">
          <label htmlFor="notes" className="reem-field-label">
            הערות (אופציונלי)
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={3}
            placeholder="זווית, קהל יעד, או הקשר נוסף שיעזור בהפקה"
            className="reem-field-textarea"
          />
        </div>

        <div className="border-rule mt-8 flex items-center justify-between gap-4 border-t pt-6">
          <Link
            href="/topics"
            className="text-cream/55 hover:text-cream font-display text-sm italic transition-colors"
          >
            ביטול
          </Link>
          <button
            type="submit"
            className="border-gold-warm text-cream hover:text-gold-warm border-b px-4 py-2 text-xs tracking-[0.36em] uppercase transition-colors"
          >
            הוסף נושא
          </button>
        </div>
      </form>
    </main>
  );
}
