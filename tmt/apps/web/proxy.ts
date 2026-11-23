import createMiddleware from "next-intl/middleware";
import type { NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSupabaseSession } from "./lib/supabase/proxy";

const handleLocaleRouting = createMiddleware(routing);

export async function proxy(request: NextRequest) {
  const response = handleLocaleRouting(request);
  return refreshSupabaseSession(request, response);
}

export const config = {
  matcher: ["/((?!auth|api|_next|_vercel|.*\\..*).*)"],
};
