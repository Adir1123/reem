"use client";

import { useState } from "react";

// Tiny clipboard helper — the client preview workflow ends with the user
// pasting the caption into Instagram, so a one-click copy is the single most
// useful affordance on /preview.
export function CopyButton({
  text,
  label = "העתק כיתוב",
  copiedLabel = "הועתק ✓",
}: {
  text: string;
  label?: string;
  copiedLabel?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={
        copied
          ? "border-gold-warm bg-gold-base/10 text-gold-warm inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors"
          : "border-rule text-cream/70 hover:text-cream hover:border-gold-warm/40 inline-flex items-center gap-2 rounded-full border px-4 py-2 text-xs font-medium transition-colors"
      }
    >
      {copied ? copiedLabel : label}
    </button>
  );
}
