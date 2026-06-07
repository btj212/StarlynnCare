/**
 * HMAC-SHA256 of the configured site-unlock password. The browser cookie
 * stores this token instead of the literal password — audit finding H8.
 *
 * Uses Web Crypto (`globalThis.crypto.subtle`) so the same module works on
 * Edge runtime (where `src/proxy.ts` runs) and Node runtime (where the
 * `/api/unlock` route handler runs).
 */

const encoder = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  const view = new Uint8Array(bytes);
  let out = "";
  for (let i = 0; i < view.length; i++) {
    out += view[i].toString(16).padStart(2, "0");
  }
  return out;
}

async function hmacToken(password: string): Promise<string> {
  const secret = process.env.SITE_UNLOCK_SECRET;
  if (!secret) {
    // Keep the gate functional in dev/preview environments that have not yet
    // set SITE_UNLOCK_SECRET — but log loudly so the operator notices.
    console.error(
      "[unlock] SITE_UNLOCK_SECRET is not set — falling back to password-as-secret. " +
        "Set SITE_UNLOCK_SECRET (openssl rand -base64 32) in Vercel before relying on the gate.",
    );
  }
  const keyMaterial = encoder.encode(secret ?? password);
  const key = await crypto.subtle.importKey(
    "raw",
    keyMaterial,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(password));
  return toHex(signature);
}

/** Token stored in the sl_auth cookie. Stable per (password, secret). */
export async function unlockCookieToken(password: string): Promise<string> {
  return hmacToken(password);
}

/** Constant-time string compare for hex-encoded tokens of equal length. */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

/** Constant-time comparison of a cookie value against the expected token. */
export async function unlockCookieMatches(
  cookieValue: string | undefined,
  password: string,
): Promise<boolean> {
  if (!cookieValue) return false;
  const expected = await hmacToken(password);
  return constantTimeEqual(cookieValue, expected);
}
