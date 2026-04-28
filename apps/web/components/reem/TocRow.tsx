import Link from "next/link";
import type { ReactNode } from "react";

// Single numbered row in an editorial TOC list. Renders as <a> with grid:
// counter / title / meta / arrow. Wrap multiple rows in <div className="reem-toc">.
export function TocRow({
  href,
  title,
  meta,
  trailing,
}: {
  href: string;
  title: ReactNode;
  meta?: ReactNode;
  /** Optional content rendered on the far-left side instead of the default arrow. */
  trailing?: ReactNode;
}) {
  return (
    <Link href={href} className="reem-toc-row">
      <span className="reem-toc-row-title">{title}</span>
      {meta ? <span className="reem-toc-row-meta">{meta}</span> : <span />}
      <span className="reem-toc-row-arrow">{trailing ?? "←"}</span>
    </Link>
  );
}
