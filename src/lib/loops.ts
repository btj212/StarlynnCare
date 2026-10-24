export interface LoopsContactPayload {
  email: string;
  userGroup?: string;
  source?: string;
  [key: string]: string | undefined;
}

const LOOPS_BASE = "https://app.loops.so/api/v1";

/** Contact fields that already exist in the Loops account. Unknown keys make the upsert fail. */
const CONTACT_FIELDS = new Set([
  "source",
  "userGroup",
  "notes",
  "facilityName",
  "facilityId",
  "areaName",
  "areaSlug",
  "journeyStage",
  "watchIntent",
  "stateCode",
  "magnet",
  "shortlistCount",
  "shortlistFacilities",
  "firstName",
  "lastName",
]);

export interface LoopsResult {
  ok: boolean;
  error?: string;
}

/**
 * Creates a contact, or updates one without replacing userGroup.
 * userGroup is a single label. A second product used to overwrite it and hide
 * the earlier signup. Product identity now lives on the commitment row and
 * on the event name. userGroup is set only when the contact is new.
 */
export async function upsertLoopsContact(payload: LoopsContactPayload): Promise<LoopsResult> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.error("[loops] LOOPS_API_KEY not set — skipping contact upsert");
    return { ok: false, error: "missing_api_key" };
  }

  const email = payload.email.trim().toLowerCase();
  const properties: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload)) {
    if (key === "email" || value === undefined || value === "") continue;
    if (!CONTACT_FIELDS.has(key)) continue;
    properties[key] = value;
  }

  const exists = await contactExists(apiKey, email);
  if (exists !== false) {
    delete properties.userGroup;
  }

  const updated = await loopsFetch(apiKey, "/contacts/update", "PUT", { email, ...properties });
  if (updated.ok) return { ok: true };

  if (exists === false) {
    const created = await loopsFetch(apiKey, "/contacts/create", "POST", {
      email,
      userGroup: payload.userGroup ?? "subscriber",
      ...properties,
    });
    if (created.ok || created.status === 409) return { ok: true };
    console.error("[loops] create error", created.status, created.body);
    return { ok: false, error: created.body.slice(0, 500) };
  }

  console.error("[loops] upsert error", updated.status, updated.body);
  return { ok: false, error: updated.body.slice(0, 500) };
}

/** @deprecated Prefer upsertLoopsContact. Kept so older call sites cannot go back to create-only. */
export async function addLoopsContact(payload: LoopsContactPayload & { userGroup: string }): Promise<void> {
  await upsertLoopsContact(payload);
}

export async function sendLoopsEvent(args: {
  email: string;
  eventName: string;
  idempotencyKey: string;
  eventProperties?: Record<string, string | undefined>;
}): Promise<LoopsResult> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.error("[loops] LOOPS_API_KEY not set — skipping event");
    return { ok: false, error: "missing_api_key" };
  }

  const eventProperties: Record<string, string> = {};
  for (const [key, value] of Object.entries(args.eventProperties ?? {})) {
    if (!value || !CONTACT_FIELDS.has(key)) continue;
    eventProperties[key] = value;
  }

  const sent = await loopsFetch(
    apiKey,
    "/events/send",
    "POST",
    {
      email: args.email.trim().toLowerCase(),
      eventName: args.eventName,
      eventProperties,
    },
    { "Idempotency-Key": args.idempotencyKey.slice(0, 100) },
  );

  if (sent.ok || sent.status === 409) return { ok: true };
  console.error("[loops] event error", sent.status, sent.body);
  return { ok: false, error: sent.body.slice(0, 500) };
}

async function contactExists(apiKey: string, email: string): Promise<boolean | null> {
  try {
    const res = await fetch(`${LOOPS_BASE}/contacts/find?email=${encodeURIComponent(email)}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    if (res.status === 404) return false;
    if (!res.ok) return null;
    const body: unknown = await res.json();
    if (Array.isArray(body)) return body.length > 0;
    return Boolean(body && typeof body === "object");
  } catch (err) {
    console.error("[loops] contact lookup failed", err);
    return null;
  }
}

async function loopsFetch(
  apiKey: string,
  path: string,
  method: "PUT" | "POST",
  body: Record<string, unknown>,
  extraHeaders?: Record<string, string>,
): Promise<{ ok: boolean; status: number; body: string }> {
  const res = await fetch(`${LOOPS_BASE}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
  if (res.ok) return { ok: true, status: res.status, body: "" };
  const text = await res.text();
  return { ok: false, status: res.status, body: text };
}
