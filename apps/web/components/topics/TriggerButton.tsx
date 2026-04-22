"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

// Wraps the topics submit button with a useFormStatus-driven pending state.
// The parent stays a server form (`<form action={triggerGenerationAction}>`);
// only this button needs to be a client component to read pending state.
export function TriggerButton({
  disabled,
  children,
  pendingLabel = "מפעיל…",
}: {
  disabled?: boolean;
  children: ReactNode;
  pendingLabel?: string;
}) {
  const { pending } = useFormStatus();
  const isDisabled = disabled || pending;
  return (
    <button
      type="submit"
      disabled={isDisabled}
      className="bg-navy text-cream hover:bg-navy-soft disabled:bg-navy/20 disabled:text-navy/50 inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed"
    >
      {pending ? (
        <>
          <Spinner />
          {pendingLabel}
        </>
      ) : (
        children
      )}
    </button>
  );
}

function Spinner() {
  return (
    <svg
      className="h-3.5 w-3.5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeOpacity="0.25"
        strokeWidth="3"
      />
      <path
        d="M22 12a10 10 0 0 1-10 10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
