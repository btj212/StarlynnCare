import "server-only";

import type { ProfileRow } from "@tmt/db";
import type { Route } from "next";
import { redirect } from "next/navigation";
import type { AppLocale } from "../../i18n/routing";
import { isFixtureMode } from "../env";
import { createSupabaseServerClient } from "../supabase/server";

export type OpsSession = {
  profile: Pick<ProfileRow, "id" | "display_name" | "role">;
  fixtureMode: boolean;
};

export async function requireOpsSession(
  locale: AppLocale,
): Promise<OpsSession> {
  if (isFixtureMode()) {
    return {
      profile: {
        id: "00000000-0000-4000-8000-000000001002",
        display_name: "Nav Kaur (Fictional)",
        role: "dispatcher",
      },
      fixtureMode: true,
    };
  }

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(`/${locale}/login` as Route);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, display_name, role")
    .eq("id", user.id)
    .single();

  if (error || !profile) {
    await supabase.auth.signOut();
    redirect(`/${locale}/login?error=role` as Route);
  }

  return { profile, fixtureMode: false };
}
