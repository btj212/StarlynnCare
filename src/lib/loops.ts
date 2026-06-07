export interface LoopsContactPayload {
  email: string;
  userGroup: string;
  source?: string;
  [key: string]: string | undefined;
}

/**
 * Upserts a contact in Loops. 409 (already exists) is treated as success.
 * Silently skips if LOOPS_API_KEY is not set.
 */
export async function addLoopsContact(payload: LoopsContactPayload): Promise<void> {
  const apiKey = process.env.LOOPS_API_KEY;
  if (!apiKey) {
    console.error("[loops] LOOPS_API_KEY not set — skipping contact creation");
    return;
  }

  const res = await fetch("https://app.loops.so/api/v1/contacts/create", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok && res.status !== 409) {
    const text = await res.text();
    console.error("[loops] API error", res.status, text);
  }
}
