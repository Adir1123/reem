"use client";

import Link from "next/link";
import { useEffect } from "react";

// Branded fallback for any unhandled error in a route. Without this, a Supabase
// hiccup or RSC crash shows the generic Next.js error screen — and the client
// has no idea it's the dashboard that broke.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("dashboard error boundary:", error);
  }, [error]);

  return (
    <main className="bg-bg flex flex-1 items-center justify-center px-6 py-16">
      <div className="border-rule bg-bg-card w-full max-w-md rounded-md border p-8 text-center">
        <p className="font-display text-gold-warm text-xs tracking-[0.32em] uppercase">
          שגיאה
        </p>
        <h1 className="text-cream font-display mt-2 text-2xl italic">
          משהו השתבש
        </h1>
        <p className="text-cream/55 mt-3 text-sm">
          קרתה תקלה בלוח הבקרה. אפשר לנסות שוב — אם זה חוזר, רענן את הדף או
          חזור לדף הבית.
        </p>
        {error.digest ? (
          <p className="text-cream/45 mt-3 font-mono text-[11px]">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-gold-base text-bg hover:bg-gold-warm rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            נסה שוב
          </button>
          <Link
            href="/"
            className="text-cream/70 hover:text-cream border-rule rounded-full border px-5 py-2.5 text-sm font-medium transition-colors"
          >
            חזרה לבית
          </Link>
        </div>
      </div>
    </main>
  );
}
