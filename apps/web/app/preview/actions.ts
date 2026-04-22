"use server";

import { revalidatePath } from "next/cache";
import { getServiceClient } from "@/lib/supabase-server";

const CLIENT_ID = process.env.CLIENT_ID;

// Flips a carousel to 'posted'. The carousel_status_dedup_trg Postgres
// trigger then sets the underlying topic to 'posted' + used_at=now(), which
// removes it from the cron picker pool. Called from the preview download
// flow after the ZIP has been generated client-side.
export async function markPostedAction(carouselId: string) {
  if (!CLIENT_ID) throw new Error("CLIENT_ID env var not set");
  if (!carouselId) throw new Error("markPostedAction: carouselId missing");

  const sb = getServiceClient();
  const { error } = await sb
    .from("carousels")
    .update({ status: "posted", posted_at: new Date().toISOString(), posted_via: "manual_download" })
    .eq("id", carouselId)
    .eq("client_id", CLIENT_ID);

  if (error) throw new Error(`markPostedAction: ${error.message}`);

  revalidatePath("/preview");
  revalidatePath("/carousels");
  revalidatePath("/topics");
  revalidatePath("/");
}

// Inverse of markPostedAction: client decided not to post this carousel.
// Trigger handles topic recycling (back to 'available' if no other sibling
// is approved/posted/pending).
export async function markRejectedAction(carouselId: string) {
  if (!CLIENT_ID) throw new Error("CLIENT_ID env var not set");
  if (!carouselId) throw new Error("markRejectedAction: carouselId missing");

  const sb = getServiceClient();
  const { error } = await sb
    .from("carousels")
    .update({ status: "rejected" })
    .eq("id", carouselId)
    .eq("client_id", CLIENT_ID);

  if (error) throw new Error(`markRejectedAction: ${error.message}`);

  revalidatePath("/preview");
  revalidatePath("/carousels");
  revalidatePath("/topics");
  revalidatePath("/");
}
