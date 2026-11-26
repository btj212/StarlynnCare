/**
 * Operator outreach helpers for /confirm.
 *
 * Listing facts are what the profile already prints. The home marks each
 * correct or wrong; we store that as pending. Memory-care program answers
 * (secured area, name, source URL) wait for a person before they can become
 * a Level 2 badge — this module never writes facilities.mc_program_confirmed.
 */

import { createHmac, timingSafeEqual } from "node:crypto";
import { facilityAliases } from "@/lib/facility/aliases";
import { formatFacilityName } from "@/lib/facility/displayName";
import { memoryCareBasis } from "@/lib/facility/memoryCareBasis";
import type { MemoryCareBasisInput } from "@/lib/facility/memoryCareBasis";

export const LISTING_FACT_KEYS = [
  "licensed_name",
  "marketing_name",
  "address",
  "phone",
  "website",
  "beds",
  "license_number",
  "memory_care_label",
] as const;

export type ListingFactKey = (typeof LISTING_FACT_KEYS)[number];

export const LISTING_FACT_LABELS: Record<ListingFactKey, string> = {
  licensed_name: "Licensed name",
  marketing_name: "Marketing name",
  address: "Street, city, ZIP",
  phone: "Phone",
  website: "Website",
  beds: "Licensed beds",
  license_number: "License number",
  memory_care_label: "Memory-care label",
};

export type ListingVerdict = "correct" | "fix";

export type ListingFactCheck = {
  shown: string;
  verdict: ListingVerdict;
  correction: string | null;
};

export type ListingChecks = {
  allCorrectShortcut: boolean;
  fields: Record<ListingFactKey, ListingFactCheck>;
};

export type ShownListingFact = {
  key: ListingFactKey;
  label: string;
  shown: string;
};

const NONE = "None on record";
const CORRECTION_MAX = 200;

export type ListingFacility = MemoryCareBasisInput & {
  name: string;
  street?: string | null;
  city?: string | null;
  zip?: string | null;
  phone?: string | null;
  phone_override?: string | null;
  website?: string | null;
  beds?: number | null;
  license_number?: string | null;
  marketing_name?: string | null;
  content?: { marketing_name?: string | null; name_aliases?: string[] | null } | null;
};

export function displayPhone(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const digits = raw.replace(/\D/g, "");
  const m = digits.match(/^1?(\d{3})(\d{3})(\d{4})$/);
  if (!m) return raw.trim();
  return `(${m[1]}) ${m[2]}-${m[3]}`;
}

function shownOrNone(value: string | null | undefined): string {
  const t = value?.trim();
  return t ? t : NONE;
}

/** Phone families see: operator override if set, else the state file. */
export function displayedPhone(facility: ListingFacility): string {
  return shownOrNone(displayPhone(facility.phone_override ?? facility.phone));
}

export function shownListingFacts(facility: ListingFacility): ShownListingFact[] {
  const legal = formatFacilityName(facility.name);
  const marketing = facilityAliases(facility).marketingName;
  const address = [facility.street, facility.city, facility.zip]
    .map((p) => p?.trim())
    .filter(Boolean)
    .join(", ");
  const basis = memoryCareBasis(facility);

  const values: Record<ListingFactKey, string> = {
    licensed_name: shownOrNone(legal),
    marketing_name: shownOrNone(marketing),
    address: shownOrNone(address),
    phone: displayedPhone(facility),
    website: shownOrNone(facility.website),
    beds: facility.beds != null ? String(facility.beds) : NONE,
    license_number: shownOrNone(facility.license_number),
    memory_care_label: shownOrNone(basis.label),
  };

  return LISTING_FACT_KEYS.map((key) => ({
    key,
    label: LISTING_FACT_LABELS[key],
    shown: values[key],
  }));
}

export function parseListingChecks(
  raw: unknown,
  shown: ShownListingFact[],
): { checks: ListingChecks } | { error: string } {
  if (typeof raw !== "object" || raw === null) {
    return { error: "Please mark each fact as correct or needing a fix." };
  }
  const body = raw as Record<string, unknown>;
  const shortcut = body.allCorrectShortcut === true;
  const fieldsRaw =
    typeof body.fields === "object" && body.fields !== null
      ? (body.fields as Record<string, unknown>)
      : {};
  const fields = {} as Record<ListingFactKey, ListingFactCheck>;

  for (const fact of shown) {
    const row = fieldsRaw[fact.key];
    const verdict =
      shortcut
        ? "correct"
        : typeof row === "object" && row !== null && (row as { verdict?: unknown }).verdict === "fix"
          ? "fix"
          : typeof row === "object" &&
              row !== null &&
              (row as { verdict?: unknown }).verdict === "correct"
            ? "correct"
            : null;
    if (!verdict) {
      return { error: `Please mark whether “${fact.label}” is correct.` };
    }
    let correction: string | null = null;
    if (verdict === "fix") {
      const text =
        typeof row === "object" && row !== null && typeof (row as { correction?: unknown }).correction === "string"
          ? (row as { correction: string }).correction.trim()
          : "";
      if (text.length < 2) {
        return { error: `Please tell us the correct ${fact.label.toLowerCase()}.` };
      }
      correction = text.slice(0, CORRECTION_MAX);
    }
    fields[fact.key] = { shown: fact.shown, verdict, correction };
  }

  return { checks: { allCorrectShortcut: shortcut, fields } };
}

export function registrableHost(website: string | null | undefined): string | null {
  if (!website?.trim()) return null;
  try {
    const url = new URL(website.includes("://") ? website : `https://${website}`);
    const host = url.hostname.replace(/^www\./i, "").toLowerCase();
    return host || null;
  } catch {
    return null;
  }
}

export function emailDomainMatchesWebsite(
  email: string,
  website: string | null | undefined,
): boolean {
  const domain = email.trim().toLowerCase().split("@")[1] ?? "";
  const host = registrableHost(website);
  if (!domain || !host) return false;
  return domain === host || host.endsWith(`.${domain}`) || domain.endsWith(`.${host}`);
}

function outreachSecret(): string | null {
  const secret = process.env.HOME_OUTREACH_SECRET?.trim();
  return secret ? secret : null;
}

function b64url(buf: Buffer): string {
  return buf.toString("base64url");
}

/** Signed per-facility token for outreach emails (`?t=`). Unique per home, not per send. */
export function signOutreachToken(
  facilityId: string,
  secret = outreachSecret(),
): string {
  if (!secret) {
    throw new Error(
      "HOME_OUTREACH_SECRET is not set. Add it to the environment (openssl rand -base64 32) before generating outreach links.",
    );
  }
  const id = facilityId.trim();
  if (!id) throw new Error("facility id is required");
  const sig = createHmac("sha256", secret).update(`v1:${id}`).digest();
  return `v1.${b64url(Buffer.from(id, "utf8"))}.${b64url(sig)}`;
}

export function verifyOutreachToken(
  token: string | null | undefined,
  facilityId: string,
  secret = outreachSecret(),
): boolean {
  if (!token || !secret || !facilityId) return false;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return false;
  let id: string;
  try {
    id = Buffer.from(parts[1], "base64url").toString("utf8");
  } catch {
    return false;
  }
  if (id !== facilityId) return false;
  let got: Buffer;
  try {
    got = Buffer.from(parts[2], "base64url");
  } catch {
    return false;
  }
  const expected = createHmac("sha256", secret).update(`v1:${id}`).digest();
  if (got.length !== expected.length) return false;
  return timingSafeEqual(got, expected);
}
