import "server-only";

import type { Database } from "@tmt/db";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { RawOpsSnapshot } from "./mapper";

type QueryResult<T> = {
  data: T[] | null;
  error: { message: string } | null;
};

function rowsOrThrow<T>(result: QueryResult<T>, table: string): T[] {
  if (result.error) {
    throw new Error(`Unable to load ${table}: ${result.error.message}`);
  }
  return result.data ?? [];
}

export async function loadRawOpsSnapshot(
  supabase: SupabaseClient<Database>,
): Promise<RawOpsSnapshot> {
  const [calls, utterances, consents, handoffs, escalations] = await Promise.all([
    supabase.from("calls").select("*").order("started_at", { ascending: false }).limit(50),
    supabase.from("utterances").select("*").order("started_at", { ascending: false }).limit(500),
    supabase.from("consents").select("*").order("created_at", { ascending: false }).limit(200),
    supabase.from("handoff_events").select("*").order("requested_at", { ascending: false }).limit(100),
    supabase.from("escalations").select("*").order("created_at", { ascending: false }).limit(100),
  ]);

  return {
    calls: rowsOrThrow(calls, "calls"),
    utterances: rowsOrThrow(utterances, "utterances"),
    consents: rowsOrThrow(consents, "consents"),
    handoffEvents: rowsOrThrow(handoffs, "handoff_events"),
    escalations: rowsOrThrow(escalations, "escalations"),
  };
}
