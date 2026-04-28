import { getServiceClient } from "@/lib/supabase-server";
import { PageHeader } from "@/components/reem/PageHeader";
import {
  CarouselStack,
  type CarouselStackItem,
} from "@/components/reem/CarouselStack";
import type { Slide } from "@reem/types";

export const dynamic = "force-dynamic";

const CLIENT_ID = process.env.CLIENT_ID;

interface PostedRow {
  id: string;
  run_id: string;
  idx: number;
  concept: string;
  posted_at: string;
  slides_he: Slide[];
}

export default async function HistoryPage() {
  if (!CLIENT_ID) return <ErrorShell message="CLIENT_ID env var not set." />;
  const sb = getServiceClient();

  const { data, error } = await sb
    .from("carousels")
    .select("id, run_id, idx, concept, posted_at, slides_he")
    .eq("client_id", CLIENT_ID)
    .eq("status", "posted")
    .order("posted_at", { ascending: false });

  if (error) return <ErrorShell message={`DB error: ${error.message}`} />;
  const rows = (data ?? []) as PostedRow[];

  // CarouselStack expects status + created_at. We surface posted_at as the
  // displayed date so the meta line under each card shows when it went live.
  const items: CarouselStackItem[] = rows.map((r) => ({
    id: r.id,
    run_id: r.run_id,
    idx: r.idx,
    concept: r.concept,
    status: "posted",
    created_at: r.posted_at,
    slides_he: r.slides_he,
  }));

  return (
    <main className="reem-page reem-page--carousels" dir="rtl">
      <PageHeader
        eyebrow="היסטוריה"
        title="קרוסלות שפורסמו"
        sub={`${items.length} קרוסלות פורסמו`}
      />

      {items.length === 0 ? (
        <p className="text-cream/55 py-16 text-center text-sm">
          טרם פורסמו קרוסלות. ההיסטוריה תתעדכן ברגע שתורד הקרוסלה הראשונה.
        </p>
      ) : (
        <CarouselStack carousels={items} />
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
