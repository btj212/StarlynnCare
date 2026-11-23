export type PublicSupabaseEnv = {
  url: string;
  anonKey: string;
};

export function isFixtureMode(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const value = env.TMT_WEB_FIXTURE_MODE;
  if (value === undefined || value === "") {
    return false;
  }
  if (value !== "test") {
    throw new Error('TMT_WEB_FIXTURE_MODE must be unset or exactly "test"');
  }
  if (env.NODE_ENV === "production") {
    throw new Error("TMT web fixtures are disabled in production");
  }
  return true;
}

export function publicSupabaseEnv(
  env: NodeJS.ProcessEnv = process.env,
): PublicSupabaseEnv {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are required",
    );
  }

  return { url, anonKey };
}
