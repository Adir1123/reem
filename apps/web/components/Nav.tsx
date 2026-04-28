import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase-auth";
import { signOutAction } from "@/app/auth/actions";
import { NavLink } from "@/components/NavLink";

// Top nav. Server component — fetches the current user and skips rendering
// when nobody is signed in (covers /login and the brief unauthenticated
// flash on protected routes before proxy.ts redirects). Individual link
// items are rendered via <NavLink> (client) so they can self-highlight
// based on usePathname().
export async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <nav className="reem-nav" dir="rtl">
      <div className="reem-nav-inner">
        <Link href="/" className="reem-logo">
          <span className="reem-logo-mark" aria-hidden="true">
            ר
          </span>
          <span className="reem-logo-word">REEM</span>
        </Link>
        <ul className="reem-nav-items">
          <li>
            <NavLink href="/">בית</NavLink>
          </li>
          <li>
            <NavLink href="/topics">נושאים</NavLink>
          </li>
          <li>
            <NavLink href="/carousels">קרוסלות</NavLink>
          </li>
          <li>
            <NavLink href="/history">היסטוריה</NavLink>
          </li>
          <li>
            <NavLink href="/settings">הגדרות</NavLink>
          </li>
          <li>
            <form action={signOutAction}>
              <button type="submit" className="reem-nav-link">
                יציאה
              </button>
            </form>
          </li>
        </ul>
      </div>
    </nav>
  );
}
