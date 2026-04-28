"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

const HEADLINE = "ברוך הבא ראם";
const EYEBROW = "ראם";
const SUBHEAD = "הקרוסלות שלך מוכנות";

export function MarqueeHero() {
  // The .is-in class on .reem-hero-text triggers all the staggered reveals
  // in reem.css. Flip it on mount so animations only start client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const chars = Array.from(HEADLINE);

  return (
    <section
      className="reem-hero reem-hero--marquee"
      dir="rtl"
      data-screen-label="hero"
    >
      <div className="reem-hero-figure" aria-hidden="true">
        {/* Poster image renders first so the video (which loads after) draws
            on top of it. Under prefers-reduced-motion the video is hidden
            via CSS and this poster shows through. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/hero-figure.png" alt="" />
        <video
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster="/hero-figure.png"
          tabIndex={-1}
        >
          <source src="/hero-figure.mp4" type="video/mp4" />
        </video>
        <div className="reem-hero-veil-l" />
        <div className="reem-hero-veil-r" />
      </div>

      <div className="reem-hero-content">
        <div className={"reem-hero-text" + (mounted ? " is-in" : "")}>
          <p className="reem-eyebrow" style={{ "--delay": "0ms" } as React.CSSProperties}>
            <span className="reem-eyebrow-rule" />
            <span className="reem-eyebrow-text">{EYEBROW}</span>
            <span className="reem-eyebrow-rule" />
          </p>
          <h1 className="reem-h1">
            {chars.map((c, i) => (
              <span
                key={i}
                className="reem-h1-char"
                style={
                  {
                    "--delay": `${(chars.length - 1 - i) * 55}ms`,
                  } as React.CSSProperties
                }
              >
                {c === " " ? " " : c}
              </span>
            ))}
          </h1>
          <p
            className="reem-subhead"
            style={{ "--delay": "780ms" } as React.CSSProperties}
          >
            {SUBHEAD}
          </p>
          <div
            className="reem-cta-row"
            style={{ "--delay": "980ms" } as React.CSSProperties}
          >
            <Link href="/carousels" className="reem-cta-primary">
              <span>צפה בקרוסלות</span>
              <span className="reem-cta-arrow" aria-hidden="true">
                ←
              </span>
            </Link>
            <Link href="/topics" className="reem-cta-ghost">
              צור קרוסלה חדשה
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
