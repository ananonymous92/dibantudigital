import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "dd_session";

/**
 * Optimistic auth redirects based only on cookie presence. Real session
 * validation happens on the server in `requireSession()` / `requireWorkspace()`.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const hasSession = request.cookies.has(SESSION_COOKIE);

  if (!hasSession && (pathname.startsWith("/app") || pathname.startsWith("/onboarding"))) {
    const url = new URL("/login", request.url);
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/app/:path*", "/onboarding"],
};

