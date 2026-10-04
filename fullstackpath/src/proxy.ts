import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import {
  isAdminPath,
  isAuthOnlyPath,
  isProtectedPath,
} from "@/lib/permissions";

/**
 * Optimistic route protection.
 *
 * This runs before the request reaches a Server Component so signed-out users
 * never pay for rendering. It is NOT the authorization boundary: every page,
 * server action and route handler independently re-checks the session and the
 * role on the server. A cookie is trivially forgeable, so nothing here is
 * trusted for access control.
 */
export async function proxy(request: Request & { nextUrl: URL }) {
  const { nextUrl } = request;
  const pathname = nextUrl.pathname;

  const session = await auth();
  const isLoggedIn = Boolean(session?.user?.id);
  const isAdmin = session?.user?.role === "ADMIN";

  if (isAdminPath(pathname)) {
    // A signed-out visitor has no business on an admin route and is more likely
    // to have followed a stale link than to be probing permissions, so send them
    // to sign in. A signed-in non-admin is bounced to their dashboard instead.
    if (!isLoggedIn) {
      return NextResponse.redirect(
        new URL(
          `/login?callbackUrl=${encodeURIComponent(`${pathname}${nextUrl.search}`)}`,
          nextUrl,
        ),
      );
    }
    if (!isAdmin) {
      return NextResponse.redirect(new URL("/dashboard", nextUrl));
    }
  }

  if (isProtectedPath(pathname) && !isLoggedIn) {
    const redirectTo = `${pathname}${nextUrl.search}`;
    return NextResponse.redirect(
      new URL(`/login?callbackUrl=${encodeURIComponent(redirectTo)}`, nextUrl),
    );
  }

  if (isAuthOnlyPath(pathname) && isLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", nextUrl));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Everything except:
     * - api/auth (must run so sign-in/sign-out requests are not redirected)
     * - Next internals and static assets
     */
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};