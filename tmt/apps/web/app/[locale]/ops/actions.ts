"use server";

import type { Route } from "next";
import { redirect } from "next/navigation";
import { isAppLocale } from "../../../i18n/routing";
import { isFixtureMode } from "../../../lib/env";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function signOut(formData: FormData) {
  const localeValue = String(formData.get("locale") ?? "en");
  const locale = isAppLocale(localeValue) ? localeValue : "en";

  if (!isFixtureMode()) {
    const supabase = await createSupabaseServerClient();
    await supabase.auth.signOut();
  }

  redirect(`/${locale}/login` as Route);
}
