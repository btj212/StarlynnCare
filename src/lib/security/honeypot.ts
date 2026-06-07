/**
 * Trivial CSS-hidden honeypot field, plus a server-side check.
 * Audit finding M2.
 *
 * Real humans can't see or focus the field, so any non-empty value is a bot.
 * Pair with the time-trap below for forms where a bot might still skip the
 * field — submissions arriving within 2 seconds of page render are almost
 * always automated.
 *
 * Why not Turnstile/captcha here? We don't want to add a runtime dependency
 * or a new vendor for the family-facing inquiry surface. Honeypot + timing
 * stops the volume bots that abuse open form endpoints (90%+ of spam).
 */

/** Hidden input name. Use the same constant in every form. */
export const HONEYPOT_FIELD = "company";

/** Minimum render→submit time (ms) below which we treat the post as a bot. */
export const MIN_RENDER_AGE_MS = 2000;

/** Hidden timestamp input name. */
export const HONEYPOT_TS_FIELD = "_t";

/**
 * Returns true when the submission looks like a bot (honeypot filled OR
 * submitted too quickly).
 *
 * Pass the raw values from the request body. `tsRaw` is the rendered timestamp
 * the form emitted; missing/invalid timestamp does NOT trigger a block on its
 * own (older form versions, JS-disabled clients, prefetchers may not send it).
 */
export function looksLikeBot(
  honeypotRaw: unknown,
  tsRaw?: unknown,
): boolean {
  if (typeof honeypotRaw === "string" && honeypotRaw.trim().length > 0) {
    return true;
  }
  if (typeof tsRaw === "string" || typeof tsRaw === "number") {
    const ts = Number(tsRaw);
    if (Number.isFinite(ts) && ts > 0) {
      const age = Date.now() - ts;
      if (age >= 0 && age < MIN_RENDER_AGE_MS) return true;
    }
  }
  return false;
}
