"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

// IntersectionObserver-driven fade+slide reveal. Pairs with `.reem-reveal`
// + `.is-in` in reem.css. Used as a wrapper on every section that should
// animate in as it scrolls into view.
export function Reveal({
  children,
  delay = 0,
  threshold = 0.12,
}: {
  children: ReactNode;
  delay?: number;
  threshold?: number;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      setShown(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShown(true);
            io.disconnect();
            break;
          }
        }
      },
      { threshold },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [threshold]);

  return (
    <div
      ref={ref}
      className={"reem-reveal" + (shown ? " is-in" : "")}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
}
