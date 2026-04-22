import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

// Proxy (Next 16's renamed middleware) — gates every app route except /login,
// /auth/callback, and Next internals. On every request we touch the Supabase
// auth cookies so the session refresh handshake stays current; when no
// session exists we redirect to /login.

const PUBLIC_PATHS = ["/login", "/auth/callback"];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip Next internals + static assets — handled by the matcher below too,
  // belt-and-suspenders.
  if (pathname.startsWith("/_next") || pathname.startsWith("/ref/")) {
    return NextResponse.next();
  }

  // Allow public paths through without an auth check, but still let the
  // session cookies refresh.
  const response = NextResponse.next({ request });

  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    // If env isn't configured we can't auth — bail out without redirecting
    // so /login can still render an error.
    return response;
  }

  const supabase = createServerClient(url, anon, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isPublic = PUBLIC_PATHS.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (user && pathname === "/login") {
    const home = request.nextUrl.clone();
    home.pathname = "/";
    home.search = "";
    return NextResponse.redirect(home);
  }

  return response;
}

export const config = {
  // Run on every path except Next internals + static. Auth checks happen
  // inside the function body, not the matcher, so /login can still pass
  // through and refresh cookies.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|ref/).*)"],
};
