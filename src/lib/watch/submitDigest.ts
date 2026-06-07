export async function submitDigest(params: {
  email: string;
  source: string;
  stateCode?: string;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch("/api/watch/digest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(params),
    });
    if (res.ok) return { ok: true };
    const json = await res.json().catch(() => ({}));
    return { ok: false, error: (json as { error?: string }).error ?? "Try again." };
  } catch {
    return { ok: false, error: "Network error." };
  }
}
