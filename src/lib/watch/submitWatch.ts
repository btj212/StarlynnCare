export async function submitWatch(params: {
  email: string;
  facilityId: string;
  facilityName: string;
  source: string;
  /** Optional journey-stage intent: 'research' | 'touring' | 'resident'. */
  intent?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/watch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });

    if (res.ok) return { ok: true };

    const json = await res.json().catch(() => ({}));
    return {
      ok: false,
      error: (json as { error?: string }).error ?? "Something went wrong. Try again.",
    };
  } catch {
    return { ok: false, error: "Network error. Please try again." };
  }
}
