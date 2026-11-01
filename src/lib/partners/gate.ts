import { getServiceClient } from "@/lib/supabase/server";
import { FOUNDING_PARTNER_CAP } from "@/lib/partners/constants";

const FACILITY_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isFacilityUuid(value: string): boolean {
  return FACILITY_UUID.test(value);
}

export type PartnerRuleCode =
  | "grade"
  | "severity_4"
  | "severity_3"
  | "license"
  | "current_record";

export type PartnerGateRule = {
  code: PartnerRuleCode;
  pass: boolean;
  detail: string;
};

export type PartnerGate = {
  pass: boolean;
  retained: boolean;
  facility_id: string;
  state_code: string | null;
  publishable: boolean;
  rules: PartnerGateRule[];
};

const RULE_CODES: PartnerRuleCode[] = [
  "grade",
  "severity_4",
  "severity_3",
  "license",
  "current_record",
];

function isRule(value: unknown): value is PartnerGateRule {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  return (
    RULE_CODES.includes(row.code as PartnerRuleCode) &&
    typeof row.pass === "boolean" &&
    typeof row.detail === "string"
  );
}

/** Drops evidence. Families see the result and the reason, not the raw counts. */
export function publicGate(value: unknown): PartnerGate | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (typeof row.pass !== "boolean" || !Array.isArray(row.rules)) return null;
  const rules = row.rules.filter(isRule).map((rule) => ({
    code: rule.code,
    pass: rule.pass,
    detail: rule.detail,
  }));
  if (rules.length !== RULE_CODES.length) return null;
  return {
    pass: row.pass,
    retained: row.retained === true,
    facility_id: typeof row.facility_id === "string" ? row.facility_id : "",
    state_code: typeof row.state_code === "string" ? row.state_code : null,
    publishable: row.publishable === true,
    rules,
  };
}

export async function loadPartnerGate(facilityId: string): Promise<PartnerGate | null> {
  const supabase = getServiceClient();
  const { data, error } = await supabase.rpc("partner_gate", {
    p_facility_id: facilityId,
  });
  if (error) {
    console.error("[partners] gate failed:", error.message);
    return null;
  }
  return publicGate(data);
}

export type PartnerProgramCounts =
  | { ok: true; active: number; paused: number; foundingTaken: number; foundingCap: number }
  | { ok: false };

export async function loadPartnerProgramCounts(): Promise<PartnerProgramCounts> {
  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase
      .from("partners")
      .select("status, is_founding, checkout_reserved_until");
    if (error) {
      console.error("[partners] counts failed:", error.message);
      return { ok: false };
    }
    const now = Date.now();
    let active = 0;
    let paused = 0;
    let foundingTaken = 0;
    for (const row of data ?? []) {
      if (row.status === "active") active += 1;
      if (row.status === "paused") paused += 1;
      const reserved =
        row.status === "pending" &&
        row.checkout_reserved_until &&
        new Date(row.checkout_reserved_until).getTime() > now;
      if (
        row.is_founding &&
        (row.status === "active" || row.status === "paused" || row.status === "past_due" || reserved)
      ) {
        foundingTaken += 1;
      }
    }
    return { ok: true, active, paused, foundingTaken, foundingCap: FOUNDING_PARTNER_CAP };
  } catch (err) {
    console.error("[partners] counts unavailable:", err);
    return { ok: false };
  }
}
