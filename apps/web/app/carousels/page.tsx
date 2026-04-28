import Link from "next/link";
import { getServiceClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/reem/PageHeader";
import {
  CarouselStack,
  type CarouselStackItem,
} from "@/components/reem/CarouselStack";
import type { CarouselStatus } from "@reem/types";

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

interface Props {
  searchParams: Promise<{ status?: string }>;
}

export default async function CarouselsPage({ searchParams }: Props) {
  if (!CLIENT_ID) return <ErrorShell message="CLIENT_ID env var not set." />;
  const { status } = await searchParams;
  const sb = getServiceClient();

  let query = sb
    .from("carousels")
    .select("id, run_id, idx, concept, status, created_at, slides_he")
    .eq("client_id", CLIENT_ID)
    .order("created_at", { ascending: false });
  if (status && status !== "all") query = query.eq("status", status);

  const carouselsRes = await query;

  if (carouselsRes.error)
    return <ErrorShell message={`DB error: ${carouselsRes.error.message}`} />;

  const carousels = (carouselsRes.data ?? []) as CarouselStackItem[];

  return (
    <main className="reem-page reem-page--carousels" dir="rtl">
      <PageHeader
        eyebrow="הספרייה שלי"
        title="כל הקרוסלות"
        sub={`${carousels.length} קרוסלות שיוצרו`}
      />

      <nav className="border-rule mb-8 flex flex-wrap justify-center gap-1 border-b">
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
              className={`-mb-px border-b px-4 py-2 text-sm transition-colors ${
                active
                  ? "border-gold-warm text-cream font-medium"
                  : "text-cream/55 hover:text-cream border-transparent"
              }`}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      {carousels.length === 0 ? (
        <div className="py-16 text-center">
          <p className="text-cream/55 text-sm">
            {status && status !== "all" && status in STATUS_EMPTY_COPY
              ? STATUS_EMPTY_COPY[status as CarouselStatus]
              : "אין קרוסלות להצגה כאן עדיין."}
          </p>
          {status && status !== "all" ? (
            <Link
              href="/carousels"
              className="text-cream hover:text-gold-warm mt-3 inline-block text-xs underline underline-offset-4"
            >
              הצג את כל הקרוסלות
            </Link>
          ) : null}
        </div>
      ) : (
        <CarouselStack carousels={carousels} />
      )}
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
