"use client";

import Link from "next/link";
import { useEffect } from "react";

// Branded fallback for any unhandled error in a route. Without this, a Supabase
// hiccup or RSC crash shows the generic Next.js error screen — and the client
// has no idea it's the dashboard that broke. This keeps them inside the brand
// and gives a one-click recovery.
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
    <main className="bg-cream flex flex-1 items-center justify-center px-6 py-16">
      <div className="border-navy/10 w-full max-w-md rounded-2xl border bg-white p-8 text-center shadow-sm">
        <p className="font-display text-gold text-xs tracking-[0.25em] uppercase">
          שגיאה
        </p>
        <h1 className="font-display text-navy mt-2 text-2xl font-black">
          משהו השתבש
        </h1>
        <p className="text-muted mt-3 text-sm">
          קרתה תקלה בלוח הבקרה. אפשר לנסות שוב — אם זה חוזר, רענן את הדף או
          חזור לדף הבית.
        </p>
        {error.digest ? (
          <p className="text-muted mt-3 font-mono text-[11px]">
            ref: {error.digest}
          </p>
        ) : null}
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            type="button"
            onClick={reset}
            className="bg-navy text-cream hover:bg-navy-soft rounded-full px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            נסה שוב
          </button>
          <Link
            href="/"
            className="text-navy hover:bg-navy/5 border-navy/20 rounded-full border px-5 py-2.5 text-sm font-semibold transition-colors"
          >
            חזרה לבית
          </Link>
        </div>
      </div>
    </main>
  );
}
