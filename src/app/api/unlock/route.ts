import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME = "sl_auth";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const password = (formData.get("password") as string) ?? "";
  const from = (formData.get("from") as string) || "/";
  const sitePassword = process.env.SITE_UNLOCK_PASSWORD;

  const dest = from.startsWith("/") && !from.startsWith("/unlock") ? from : "/";

  if (sitePassword && password === sitePassword) {
    const response = NextResponse.redirect(new URL(dest, request.url), 303);
    response.cookies.set(COOKIE_NAME, sitePassword, {
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
