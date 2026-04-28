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
      <div className="border-gold-warm/30 bg-gold-base/10 mt-6 rounded-md border p-4 text-sm">
        <p className="text-cream font-medium">בדוק את תיבת הדואר.</p>
        <p className="text-cream/55 mt-1">
          שלחנו ל-{email} קישור התחברות חד-פעמי. תוקפו שעה.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 space-y-4">
      <div className="reem-field">
        <label htmlFor="email" className="reem-field-label">
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
          className="reem-field-input"
          placeholder="you@example.com"
        />
      </div>
      <button
        type="submit"
        disabled={pending || !email}
        className="bg-gold-base text-bg hover:bg-gold-warm disabled:bg-gold-deep disabled:text-cream/55 w-full rounded-full py-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
      >
        {pending ? "שולח…" : "שלח לי קישור"}
      </button>
      {error ? (
        <p className="text-xs text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
