import Link from "next/link";
import { getCurrentUser } from "@/lib/supabase-auth";
import { signOutAction } from "@/app/auth/actions";

// Top nav. Server component — fetches the current user and skips rendering
// when nobody is signed in (covers /login and the brief unauthenticated
// flash on protected routes before proxy.ts redirects).
export async function Nav() {
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <nav className="bg-navy text-cream sticky top-0 z-50 border-b border-navy-soft">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <Link
          href="/"
          className="font-display text-gold shrink-0 text-xl font-black tracking-[0.15em]"
        >
          PFT
        </Link>
        <ul className="-mr-2 flex items-center gap-4 overflow-x-auto whitespace-nowrap pr-2 text-sm font-semibold sm:gap-5 sm:overflow-visible">
          <li>
            <Link href="/" className="hover:text-gold transition-colors">
              בית
            </Link>
          </li>
          <li>
            <Link href="/topics" className="hover:text-gold transition-colors">
              נושאים
            </Link>
          </li>
          <li>
            <Link href="/carousels" className="hover:text-gold transition-colors">
              קרוסלות
            </Link>
          </li>
          <li>
            <Link href="/history" className="hover:text-gold transition-colors">
              היסטוריה
            </Link>
          </li>
          <li>
            <Link href="/settings" className="hover:text-gold transition-colors">
              הגדרות
            </Link>
          </li>
          <li>
            <form action={signOutAction}>
              <button
                type="submit"
                className="text-cream/60 hover:text-gold cursor-pointer transition-colors"
              >
                יציאה
              </button>
            </form>
          </li>
        </ul>
      </div>
    </nav>
  );
}
