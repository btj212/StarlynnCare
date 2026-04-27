import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);

const UNLOCK_COOKIE = "sl_auth";

// Paths that always bypass the password gate
function isPublicPath(pathname: string): boolean {
  return (
    pathname.startsWith("/unlock") ||
    pathname.startsWith("/api/unlock") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    /\.(?:svg|png|jpg|jpeg|gif|webp|ico|txt|xml)$/.test(pathname)
  );
}

export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;

    // Site-wide password gate — runs before Clerk auth
    const sitePassword = process.env.SITE_UNLOCK_PASSWORD;
    if (sitePassword && !isPublicPath(pathname)) {
      const cookie = req.cookies.get(UNLOCK_COOKIE)?.value;
      if (cookie !== sitePassword) {
        const url = req.nextUrl.clone();
        url.pathname = "/unlock";
        url.searchParams.set("from", pathname);
        return NextResponse.redirect(url);
      }
    }

    // Clerk: protect admin routes
    if (isAdminRoute(req)) {
      await auth.protect();
    }
  },
  {
    signInUrl: "/sign-in",
    signUpUrl: "/sign-in",
  },
);

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
    "/(api|trpc)(.*)",
  ],
};
