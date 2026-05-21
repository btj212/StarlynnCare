import { NextResponse } from "next/server";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { buildLlmsFullTxtBody } from "@/lib/llms/buildLlmsFullTxt";

export const revalidate = 3600;

export async function GET() {
  const supabase = tryPublicSupabaseClient();
  const body = await buildLlmsFullTxtBody(supabase);

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600, s-maxage=3600",
    },
  });
}
