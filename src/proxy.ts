import {
  clerkClient,
  clerkMiddleware,
  createRouteMatcher,
  type ClerkMiddlewareAuth,
} from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const isAdminRoute = createRouteMatcher(["/admin(.*)"]);
const isAdminApiRoute = createRouteMatcher(["/api/admin(.*)"]);

function adminEmailsFromEnv(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** `currentUser()` is not supported in middleware (Edge); use BAPI after `auth.protect()`. */
async function redirectIfNotAllowlisted(
  auth: ClerkMiddlewareAuth,
  req: NextRequest,
): Promise<NextResponse | null> {
  const allow = adminEmailsFromEnv();
  const deny = () => {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("error", "not_admin");
    return NextResponse.redirect(url);
  };
  if (allow.length === 0) {
    return deny();
  }
  const { userId } = await auth();
  if (!userId) {
    return deny();
  }
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(userId);
    const emails = user.emailAddresses.map((e) =>
      e.emailAddress.toLowerCase(),
    );
    if (!emails.some((e) => allow.includes(e))) {
      return deny();
    }
  } catch {
    return deny();
  }
  return null;
}

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
  async (auth: ClerkMiddlewareAuth, req) => {
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

    // Clerk: protect admin UI + admin APIs; then ADMIN_EMAILS allowlist
    if (isAdminRoute(req) || isAdminApiRoute(req)) {
      await auth.protect();
      const denied = await redirectIfNotAllowlisted(auth, req);
      if (denied) return denied;
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
