"use server";

import { redirect } from "next/navigation";
import { isAppLocale } from "../../../i18n/routing";
import { requestMagicLink } from "../../../lib/auth";
import { isFixtureMode } from "../../../lib/env";
import { webBaseUrl } from "../../../lib/seo";
import { createSupabaseServerClient } from "../../../lib/supabase/server";

export async function sendMagicLink(formData: FormData) {
  const localeValue = String(formData.get("locale") ?? "en");
  const locale = isAppLocale(localeValue) ? localeValue : "en";
  const email = String(formData.get("email") ?? "");

  if (isFixtureMode()) {
    redirect(`/${locale}/ops`);
  }

  const supabase = await createSupabaseServerClient();
  const sent = await requestMagicLink(
    supabase,
    email,
    locale,
    webBaseUrl().toString(),
  );

  redirect(`/${locale}/login?${sent ? "sent=1" : "error=send"}`);
}
