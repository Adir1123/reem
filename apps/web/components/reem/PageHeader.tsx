import type { ReactNode } from "react";

// Shared editorial-style page header. Centered eyebrow + italic serif title +
// optional subhead + optional ornament rule. Used at the top of every internal
// page (carousels, history, topics, settings, etc.).
export function PageHeader({
  eyebrow,
  title,
  sub,
  ornament,
}: {
  eyebrow: string;
  title: ReactNode;
  sub?: ReactNode;
  ornament?: boolean;
}) {
  return (
    <header className="reem-page-header" dir="rtl">
      <p className="reem-page-header-eyebrow">{eyebrow}</p>
      <h1 className="reem-page-header-title">{title}</h1>
      {sub ? <p className="reem-page-header-sub">{sub}</p> : null}
      {ornament ? (
        <div className="reem-ornament" aria-hidden="true">
          <span className="reem-ornament-rule" />
          <svg viewBox="0 0 24 24" width="14" height="14">
            <path
              d="M12 2 L14 10 L22 12 L14 14 L12 22 L10 14 L2 12 L10 10 Z"
              fill="var(--gold-warm)"
            />
          </svg>
          <span className="reem-ornament-rule" />
        </div>
      ) : null}
    </header>
  );
}
