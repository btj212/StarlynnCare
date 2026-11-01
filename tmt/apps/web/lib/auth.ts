import type { AppLocale } from "../i18n/routing";

type MagicLinkClient = {
  auth: {
    signInWithOtp(options: {
      email: string;
      options: { emailRedirectTo: string; shouldCreateUser: boolean };
    }): Promise<{ error: { message: string } | null }>;
  };
};

export function safeNextPath(value: string | null): string {
  if (!value || !value.startsWith("/") || value.startsWith("//")) {
    return "/en/ops";
  }
  return value;
}

export function magicLinkCallbackUrl(
  baseUrl: string,
  locale: AppLocale,
): string {
  const callback = new URL("/auth/callback", baseUrl);
  callback.searchParams.set("next", `/${locale}/ops`);
  return callback.toString();
}

export async function requestMagicLink(
  client: MagicLinkClient,
  email: string,
  locale: AppLocale,
  baseUrl: string,
): Promise<boolean> {
  const normalizedEmail = email.trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
    return false;
  }

  const { error } = await client.auth.signInWithOtp({
    email: normalizedEmail,
    options: {
      emailRedirectTo: magicLinkCallbackUrl(baseUrl, locale),
      shouldCreateUser: false,
    },
  });

  return error === null;
}
