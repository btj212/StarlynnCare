import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { buildLlmsTxtBody } from "@/lib/llms/buildLlmsTxt";

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  const body = await buildLlmsTxtBody(supabase);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
