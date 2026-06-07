/**
 * Stricter email validator than the lax `/^[^@]+@[^@]+\.[^@]+$/` previously
 * scattered across route handlers. Audit finding M6.
 *
 * Rejects whitespace, control characters, header-injection sequences
 * (CR/LF), and addresses longer than RFC-5321's 254-octet limit. Still
 * permissive enough for real-world emails (no over-clever quoted-local-part
 * parsing) — we use it as a server-side sanity check, not full RFC parsing.
 */

const EMAIL_RE = /^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,24}$/;

export function isValidEmail(value: unknown): value is string {
  if (typeof value !== "string") return false;
  if (value.length === 0 || value.length > 254) return false;
  // Reject any control char including CR/LF (header-injection vector).
  if (/[\x00-\x1f\x7f]/.test(value)) return false;
  return EMAIL_RE.test(value);
}
