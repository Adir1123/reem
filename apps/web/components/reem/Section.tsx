import type { ReactNode } from "react";

// Editorial section wrapper: centered eyebrow + italic title + content +
// optional "show all →" link below. Used for grouping content within a page.
export function Section({
  eyebrow,
  title,
  link,
  children,
}: {
  eyebrow?: string;
  title?: ReactNode;
  link?: { href: string; label: string };
  children: ReactNode;
}) {
  return (
    <section className="reem-section" dir="rtl">
      {(eyebrow || title) && (
        <div className="reem-section-head">
          {eyebrow ? <p className="reem-section-eyebrow">{eyebrow}</p> : null}
          {title ? <h2 className="reem-section-title">{title}</h2> : null}
          {link ? (
            <a href={link.href} className="reem-section-link">
              {link.label} <span aria-hidden="true">←</span>
            </a>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
