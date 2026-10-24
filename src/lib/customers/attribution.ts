/**
 * Where a signup came from. Stored on the commitment. Never used to send email.
 */

const LIMITS = {
  landingPath: 180,
  referrerHost: 120,
  utm: 80,
} as const;

export type SignupAttribution = {
  landingPath?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
};

export function captureAttribution(): SignupAttribution {
  if (typeof window === "undefined") return {};
  const params = new URLSearchParams(window.location.search);
  let referrerHost = "";
  try {
    referrerHost = document.referrer ? new URL(document.referrer).host : "";
  } catch {
    referrerHost = "";
  }
  return compact({
    landingPath: window.location.pathname,
    referrerHost,
    utmSource: params.get("utm_source") ?? undefined,
    utmMedium: params.get("utm_medium") ?? undefined,
    utmCampaign: params.get("utm_campaign") ?? undefined,
  });
}

export function readAttribution(body: Record<string, unknown>): SignupAttribution {
  return compact({
    landingPath: typeof body.landingPath === "string" ? body.landingPath : undefined,
    referrerHost: typeof body.referrerHost === "string" ? body.referrerHost : undefined,
    utmSource: typeof body.utmSource === "string" ? body.utmSource : undefined,
    utmMedium: typeof body.utmMedium === "string" ? body.utmMedium : undefined,
    utmCampaign: typeof body.utmCampaign === "string" ? body.utmCampaign : undefined,
  });
}

function compact(input: SignupAttribution): SignupAttribution {
  const landingPath = clean(input.landingPath, LIMITS.landingPath);
  const referrerHost = clean(input.referrerHost, LIMITS.referrerHost);
  const utmSource = clean(input.utmSource, LIMITS.utm);
  const utmMedium = clean(input.utmMedium, LIMITS.utm);
  const utmCampaign = clean(input.utmCampaign, LIMITS.utm);
  return {
    ...(landingPath && landingPath.startsWith("/") && !landingPath.startsWith("//")
      ? { landingPath }
      : {}),
    ...(referrerHost && !referrerHost.includes("/") ? { referrerHost } : {}),
    ...(utmSource ? { utmSource } : {}),
    ...(utmMedium ? { utmMedium } : {}),
    ...(utmCampaign ? { utmCampaign } : {}),
  };
}

function clean(value: string | undefined, max: number): string {
  return (value ?? "").trim().slice(0, max);
}
