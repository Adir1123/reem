"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Quietly re-fetches /topics every 5s while at least one topic is generating,
// so the UI flips from "בעבודה…" → "ממתין לאישור" without a manual reload.
// Mounts only when there's something to watch — once everything settles, the
// parent re-renders without `hasGenerating` and this component unmounts.
export function TopicAutoRefresh({ hasGenerating }: { hasGenerating: boolean }) {
  const router = useRouter();
  useEffect(() => {
    if (!hasGenerating) return;
    const id = setInterval(() => {
      router.refresh();
    }, 5000);
    return () => clearInterval(id);
  }, [hasGenerating, router]);
  return null;
}
