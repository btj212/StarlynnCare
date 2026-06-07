import { currentUser } from "@clerk/nextjs/server";

/**
 * Comma-separated list in ADMIN_EMAILS (e.g. "a@x.com,b@y.com").
 * Empty / unset = no admin access (fail-closed for /admin and /api/admin).
 */
export function getAdminEmailAllowlist(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export async function currentUserIsAdmin(): Promise<boolean> {
  const allow = getAdminEmailAllowlist();
  if (allow.length === 0) return false;
  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((e) =>
    e.emailAddress.toLowerCase(),
  );
  return emails.some((e) => allow.includes(e));
}
