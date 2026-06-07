import { NextRequest, NextResponse } from "next/server";
import { unlockCookieToken } from "@/lib/security/unlockCookie";

const COOKIE_NAME = "sl_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/**
 * Only allow same-origin relative redirects after unlock.
 * Rejects protocol-relative (`//evil.example`), backslash, and scheme-style
 * inputs that `new URL(value, request.url)` would resolve cross-origin —
 * audit finding H4 (open redirect via `from`).
 */
function safeRedirectTarget(raw: string): string {
  if (!raw.startsWith("/")) return "/";
  if (raw.startsWith("//") || raw.startsWith("/\\")) return "/";
  if (raw.startsWith("/unlock")) return "/";
  return raw;
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = (formData.get("password") as string) ?? "";
  const fromRaw = (formData.get("from") as string) || "/";
  const sitePassword = process.env.SITE_UNLOCK_PASSWORD;

  const dest = safeRedirectTarget(fromRaw);

  if (sitePassword && password === sitePassword) {
    const response = NextResponse.redirect(new URL(dest, request.url), 303);
    // Cookie stores an HMAC of the password (audit H8), not the password
    // itself, so a leaked cookie does not reveal the preview password.
    response.cookies.set(COOKIE_NAME, await unlockCookieToken(sitePassword), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: COOKIE_MAX_AGE,
      path: "/",
    });
    return response;
  }

  // Wrong password
  const errorUrl = new URL(
    `/unlock?from=${encodeURIComponent(dest)}&error=1`,
    request.url,
  );
  return NextResponse.redirect(errorUrl, 303);
}
