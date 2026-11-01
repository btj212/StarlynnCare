const LOOPS_URL = "https://app.loops.so/api/v1/transactional";

export async function sendPartnerTourToCommunity(input: {
  to: string;
  communityName: string;
  familyName: string;
  familyEmail: string;
  familyPhone: string;
  relationship: string;
  timing: string;
  consent: string;
  facilityUrl: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.LOOPS_API_KEY?.trim();
  const transactionalId = process.env.LOOPS_PARTNER_TOUR_ID?.trim();
  if (!apiKey || !transactionalId) {
    return { ok: false, error: "community_template_missing" };
  }
  const res = await fetch(LOOPS_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      email: input.to,
      transactionalId,
      dataVariables: {
        communityName: input.communityName,
        familyName: input.familyName,
        familyEmail: input.familyEmail,
        familyPhone: input.familyPhone,
        relationship: input.relationship,
        timing: input.timing,
        consent: input.consent,
        facilityUrl: input.facilityUrl,
      },
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    return { ok: false, error: `loops_${res.status}:${body.slice(0, 180)}` };
  }
  return { ok: true };
}
