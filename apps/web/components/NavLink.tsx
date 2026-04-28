"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Top-nav link that lights up via .is-active when the current route matches.
// "/" is matched exactly; every other href matches its own path or any
// nested sub-route (so /topics/new still highlights "נושאים").
export function NavLink({
  href,
  children,
}: {
  href: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const isActive =
    href === "/"
      ? pathname === "/"
      : pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={"reem-nav-link" + (isActive ? " is-active" : "")}
      aria-current={isActive ? "page" : undefined}
    >
      {children}
    </Link>
  );
}
