"use client";

import { useRouter, usePathname } from "next/navigation";

// Floating top-right back button. Hidden on the home page (no in-app history
// to return to). Calls router.back() so it follows the browser history stack
// — works regardless of whether the previous page was a sibling or a deep
// link from elsewhere.
export function BackButton() {
  const router = useRouter();
  const pathname = usePathname();
  if (pathname === "/") return null;

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="reem-back-btn"
      aria-label="חזרה לעמוד הקודם"
    >
      <span aria-hidden="true">→</span>
    </button>
  );
}
