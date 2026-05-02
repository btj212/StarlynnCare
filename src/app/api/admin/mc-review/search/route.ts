import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { getServiceClient } from "@/lib/supabase/server";
import { currentUserIsAdmin } from "@/lib/admin/auth";

const SELECT_COLUMNS = `
  id, license_number, name, slug, city, street, website,
  mc_signal_chain_name, mc_signal_explicit_name,
  mc_signal_deficiency_keyword, mc_signal_deficiency_keyword_source,
  mc_review_status, mc_review_notes, mc_reviewed_by, mc_reviewed_at,
  city_slug
`;

export async function POST(request: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    if (!(await currentUserIsAdmin())) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { query } = body;

    if (!query || typeof query !== "string") {
      return NextResponse.json({ error: "Query required" }, { status: 400 });
    }

    const supabase = getServiceClient();
    const searchTerm = query.trim();

    let facility: unknown = null;

    if (/^\d{9}$/.test(searchTerm)) {
      const { data } = await supabase
        .from("facilities")
        .select(SELECT_COLUMNS)
        .eq("state_code", "CA")
        .eq("license_number", searchTerm)
        .maybeSingle();
      if (data) facility = data;
    }

    if (!facility) {
      const { data } = await supabase
        .from("facilities")
        .select(SELECT_COLUMNS)
        .eq("state_code", "CA")
        .eq("slug", searchTerm)
        .maybeSingle();
      if (data) facility = data;
    }

    if (!facility) {
      const { data } = await supabase
        .from("facilities")
        .select(SELECT_COLUMNS)
        .eq("state_code", "CA")
        .ilike("name", `%${searchTerm}%`)
        .limit(1);
      if (data && data.length > 0) facility = data[0];
    }

    return NextResponse.json({ facility });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: "Search failed" }, { status: 500 });
  }
}
