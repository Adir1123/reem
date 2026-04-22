"use client";

import { useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase-browser";

interface Props {
  next?: string;
  initialError?: string;
}

export function LoginForm({ next, initialError }: Props) {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(initialError ?? null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setPending(true);
    setError(null);
    try {
      const sb = getBrowserSupabase();
      const origin =
        typeof window !== "undefined" ? window.location.origin : "";
      const callback = new URL("/auth/callback", origin);
      if (next) callback.searchParams.set("next", next);

      const { error: otpErr } = await sb.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: callback.toString(),
          shouldCreateUser: false,
        },
      });
      if (otpErr) throw otpErr;
      setSubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "שליחה נכשלה");
    } finally {
      setPending(false);
    }
  }

  if (submitted) {
    return (
      <div className="border-gold/30 bg-gold/10 mt-6 rounded-xl border p-4 text-sm">
        <p className="text-navy font-semibold">בדוק את תיבת הדואר.</p>
        <p className="text-muted mt-1">
          שלחנו ל-{email} קישור התחברות חד-פעמי. תוקפו שעה.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div>
        <label
          htmlFor="email"
          className="text-navy/70 mb-2 block text-xs font-semibold tracking-[0.1em] uppercase"
        >
          אימייל
        </label>
        <input
          id="email"
          type="email"
          required
          dir="ltr"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          className="border-navy/20 focus:border-gold w-full rounded-xl border bg-white px-4 py-3 text-base outline-none"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !email}
        className="bg-navy text-cream hover:bg-navy-soft disabled:bg-navy/40 w-full rounded-full py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
      >
        {pending ? "שולח…" : "שלח לי קישור"}
      </button>
      {error ? (
        <p className="text-xs text-red-700" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
