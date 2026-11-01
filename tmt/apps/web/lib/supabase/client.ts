"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@tmt/db";
import { publicSupabaseEnv } from "../env";

let client: ReturnType<typeof createBrowserClient<Database>> | undefined;

export function createSupabaseBrowserClient() {
  const { url, anonKey } = publicSupabaseEnv();
  client ??= createBrowserClient<Database>(url, anonKey);
  return client;
}
