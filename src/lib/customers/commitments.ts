import { createHash, randomBytes } from "crypto";
import { getServiceClient } from "@/lib/supabase/server";
import { sendLoopsEvent, upsertLoopsContact, type LoopsContactPayload } from "@/lib/loops";
import { canonicalFor } from "@/lib/seo/canonical";
import { requestWindowKey } from "@/lib/customers/sla";

export type CommitmentProduct =
  | "records_email"
  | "tour_pack"
  | "area_watch"
  | "facility_watch"
  | "paid_facility_watch"
  | "library_magnet"
  | "contract_review"
  | "shortlist_report"
  | "waitlist"
  | "monthly_update"
  | "decision_course";

export const JOURNEY_STAGES = ["researching", "touring", "signing", "placed", "finished"] as const;
export type JourneyStage = (typeof JOURNEY_STAGES)[number];

export function isJourneyStage(value: string): value is JourneyStage {
  return (JOURNEY_STAGES as readonly string[]).includes(value);
}

export type CommitmentStatus =
  | "open"
  | "active"
  | "fulfilled"
  | "overdue"
  | "canceled"
  | "unsubscribed"
  | "needs_review";

export type DeliveryKind =
  | "asset"
  | "alert"
  | "follow_up"
  | "catchup"
  | "manual_followup"
  | "confirmation"
  | "admin";

export type DeliveryStatus = "pending" | "sent" | "failed" | "skipped";

const ONE_TIME_FULFILLMENT = new Set<CommitmentProduct>([
  "records_email",
  "tour_pack",
  "library_magnet",
  "shortlist_report",
]);

export function preferenceUrl(token: string): string {
  return canonicalFor(`/preferences/${token}`);
}

export function commitmentIdempotencyKey(parts: string[]): string {
  const digest = createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 40);
  return `cmt-${digest}`;
}

export async function registerCustomerCommitment(input: {
  email: string;
  product: CommitmentProduct;
  subjectKey?: string;
  source?: string;
  status?: CommitmentStatus;
  stage?: string | null;
  dueAt?: string | null;
  followUpDueAt?: string | null;
  facilityId?: string | null;
  metadata?: Record<string, unknown>;
  contact?: LoopsContactPayload;
}): Promise<{ commitmentId: string; preferenceToken: string }> {
  const email = input.email.trim().toLowerCase();
  const subjectKey = input.subjectKey ?? "";
  const supabase = getServiceClient();
  const preferenceToken = await ensurePreference(email);
  await restoreProductConsent(email, input.product);
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("customer_commitments")
    .upsert(
      {
        email,
        product: input.product,
        subject_key: subjectKey,
        source: input.source ?? null,
        status: input.status ?? "open",
        stage: input.stage ?? null,
        due_at: input.dueAt ?? null,
        follow_up_due_at: input.followUpDueAt ?? null,
        facility_id: input.facilityId ?? null,
        metadata: input.metadata ?? {},
        consent_at: now,
        updated_at: now,
      },
      { onConflict: "email,product,subject_key" },
    )
    .select("id")
    .single();

  if (error || !data) {
    throw new Error(`[commitments] save failed: ${error?.message ?? "no row"}`);
  }

  const commitmentId = readId(data);
  if (!commitmentId) throw new Error("[commitments] save failed: missing id");

  const contact: LoopsContactPayload = {
    email,
    source: input.source,
    ...input.contact,
  };
  const loopsContact = await upsertLoopsContact(contact);
  const event = await sendLoopsEvent({
    email,
    eventName: `signup_${input.product}`,
    idempotencyKey: commitmentIdempotencyKey([
      email,
      input.product,
      subjectKey,
      requestWindowKey(),
    ]),
    eventProperties: {
      source: input.source,
      magnet: contact.magnet,
      facilityName: contact.facilityName,
      stateCode: contact.stateCode,
      journeyStage: contact.journeyStage,
    },
  });

  if (!loopsContact.ok || !event.ok) {
    await recordCustomerDelivery({
      commitmentId,
      idempotencyKey: commitmentIdempotencyKey(["loops", commitmentId, requestWindowKey()]),
      kind: "confirmation",
      status: "failed",
      error: loopsContact.error ?? event.error ?? "loops_failed",
    });
  }

  return { commitmentId, preferenceToken };
}

export async function recordCustomerDelivery(input: {
  commitmentId: string;
  idempotencyKey: string;
  kind: DeliveryKind;
  status: DeliveryStatus;
  templateKey?: string;
  error?: string;
  payload?: Record<string, unknown>;
  fulfills?: boolean;
  stage?: string | null;
}): Promise<void> {
  const supabase = getServiceClient();
  const now = new Date().toISOString();
  const { error } = await supabase.from("customer_deliveries").upsert(
    {
      commitment_id: input.commitmentId,
      idempotency_key: input.idempotencyKey,
      kind: input.kind,
      status: input.status,
      template_key: input.templateKey ?? null,
      error: input.error ?? null,
      payload: input.payload ?? {},
      attempted_at: now,
      sent_at: input.status === "sent" ? now : null,
    },
    { onConflict: "idempotency_key" },
  );
  if (error) {
    console.error("[commitments] delivery save failed:", error.message);
    return;
  }

  if (!input.fulfills || input.status !== "sent") return;

  const { data: row } = await supabase
    .from("customer_commitments")
    .select("product")
    .eq("id", input.commitmentId)
    .maybeSingle();
  const product = readString(row, "product");
  if (!product || !ONE_TIME_FULFILLMENT.has(product as CommitmentProduct)) return;

  await supabase
    .from("customer_commitments")
    .update({
      status: "fulfilled",
      stage: input.stage ?? "asset_sent",
      last_fulfilled_at: now,
      updated_at: now,
    })
    .eq("id", input.commitmentId);
}

export async function syncPaidCommitment(row: {
  id: string;
  email: string;
  status: string;
  fulfillment_status: string;
}): Promise<void> {
  const status: CommitmentStatus =
    row.status === "active" && row.fulfillment_status === "pending"
      ? "open"
      : row.status === "active"
        ? "active"
        : "canceled";
  const supabase = getServiceClient();
  await supabase
    .from("customer_commitments")
    .update({
      status,
      stage: row.fulfillment_status,
      updated_at: new Date().toISOString(),
    })
    .eq("email", row.email.trim().toLowerCase())
    .eq("product", "paid_facility_watch")
    .eq("subject_key", row.id);
}

export async function setJourneyStage(input: {
  token: string;
  stage: JourneyStage;
}): Promise<{ ok: boolean; error?: string }> {
  if (!/^[a-f0-9]{64}$/.test(input.token)) return { ok: false, error: "Invalid link." };
  const supabase = getServiceClient();
  const { data: pref } = await supabase
    .from("customer_preferences")
    .select("email")
    .eq("token", input.token)
    .maybeSingle();
  const email = readString(pref, "email");
  if (!email) return { ok: false, error: "This link is not active." };

  const now = new Date().toISOString();
  const { error } = await supabase
    .from("customer_preferences")
    .update({ journey_stage: input.stage, journey_stage_at: now, updated_at: now })
    .eq("email", email);
  if (error) return { ok: false, error: "Could not save." };

  await upsertLoopsContact({ email, journeyStage: input.stage });
  return { ok: true };
}

export async function updateCustomerPreference(input: {
  token: string;
  action: "unsubscribe" | "resubscribe" | "unsubscribe_all";
  commitmentId?: string;
}): Promise<{ ok: boolean; error?: string; billingSeparate?: boolean }> {
  if (!/^[a-f0-9]{64}$/.test(input.token)) return { ok: false, error: "Invalid link." };
  const supabase = getServiceClient();
  const { data: pref } = await supabase
    .from("customer_preferences")
    .select("email, unsubscribed_products")
    .eq("token", input.token)
    .maybeSingle();
  const email = readString(pref, "email");
  if (!email) return { ok: false, error: "This link is not active." };

  const now = new Date().toISOString();
  if (input.action === "unsubscribe_all") {
    await supabase
      .from("customer_preferences")
      .update({ unsubscribed_all: true, updated_at: now })
      .eq("email", email);
    await supabase
      .from("customer_commitments")
      .update({ status: "unsubscribed", updated_at: now })
      .eq("email", email)
      .neq("status", "canceled");
    await supabase.from("area_watchers").update({ active: false }).eq("email", email);
    await supabase.from("facility_watchers").update({ alerts_eligible: false }).eq("email", email);
    return { ok: true, billingSeparate: true };
  }

  if (!input.commitmentId) return { ok: false, error: "Missing promise." };
  const { data: commitment } = await supabase
    .from("customer_commitments")
    .select("id, email, product, subject_key, facility_id, status")
    .eq("id", input.commitmentId)
    .maybeSingle();
  if (readString(commitment, "email") !== email) return { ok: false, error: "Missing promise." };

  const product = readString(commitment, "product") ?? "";
  const products = readStringArray(pref, "unsubscribed_products");
  const unsubscribed = input.action === "unsubscribe";
  const nextProducts = unsubscribed
    ? Array.from(new Set([...products, product]))
    : products.filter((item) => item !== product);

  await supabase
    .from("customer_preferences")
    .update({
      unsubscribed_all: false,
      unsubscribed_products: nextProducts,
      updated_at: now,
    })
    .eq("email", email);

  const nextStatus: CommitmentStatus = unsubscribed
    ? "unsubscribed"
    : product === "area_watch" || product === "facility_watch" || product === "paid_facility_watch"
      ? "active"
      : "open";
  await supabase
    .from("customer_commitments")
    .update({ status: nextStatus, updated_at: now })
    .eq("id", input.commitmentId);

  await applyDomainPreference(email, product, readString(commitment, "subject_key") ?? "", readString(commitment, "facility_id"), unsubscribed);

  return { ok: true, billingSeparate: product === "paid_facility_watch" };
}

async function applyDomainPreference(
  email: string,
  product: string,
  subjectKey: string,
  facilityId: string | null,
  unsubscribed: boolean,
): Promise<void> {
  const supabase = getServiceClient();
  if (product === "area_watch") {
    const splitAt = subjectKey.indexOf(":");
    if (splitAt === -1) return;
    const stateCode = subjectKey.slice(0, splitAt);
    const areaSlug = subjectKey.slice(splitAt + 1);
    await supabase
      .from("area_watchers")
      .update({ active: !unsubscribed })
      .eq("email", email)
      .eq("state_code", stateCode)
      .eq("area_slug", areaSlug);
  }
  if ((product === "facility_watch" || product === "paid_facility_watch") && facilityId) {
    await supabase
      .from("facility_watchers")
      .update({ alerts_eligible: !unsubscribed })
      .eq("email", email)
      .eq("facility_id", facilityId);
  }
}

async function restoreProductConsent(email: string, product: string): Promise<void> {
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("customer_preferences")
    .select("unsubscribed_all, unsubscribed_products")
    .eq("email", email)
    .maybeSingle();
  if (!data || typeof data !== "object") return;

  const current = readStringArray(data, "unsubscribed_products");
  const unsubscribedAll = (data as Record<string, unknown>).unsubscribed_all === true;
  let next = current.filter((item) => item !== product);

  if (unsubscribedAll) {
    const { data: rows } = await supabase
      .from("customer_commitments")
      .select("product")
      .eq("email", email);
    const others = (Array.isArray(rows) ? rows : [])
      .map((row) => readString(row, "product"))
      .filter((item): item is string => Boolean(item) && item !== product);
    next = Array.from(new Set([...next, ...others]));
  }

  await supabase
    .from("customer_preferences")
    .update({
      unsubscribed_all: false,
      unsubscribed_products: next,
      updated_at: new Date().toISOString(),
    })
    .eq("email", email);
}

async function ensurePreference(email: string): Promise<string> {
  const supabase = getServiceClient();
  const existing = await supabase
    .from("customer_preferences")
    .select("token")
    .eq("email", email)
    .maybeSingle();
  const token = readString(existing.data, "token");
  if (token) return token;

  const created = randomBytes(32).toString("hex");
  const { error } = await supabase.from("customer_preferences").insert({
    email,
    token: created,
  });
  if (!error) return created;

  const again = await supabase
    .from("customer_preferences")
    .select("token")
    .eq("email", email)
    .maybeSingle();
  const raced = readString(again.data, "token");
  if (raced) return raced;
  throw new Error(`[commitments] preference save failed: ${error.message}`);
}

function readId(value: unknown): string | null {
  return readString(value, "id");
}

function readString(value: unknown, key: string): string | null {
  if (!value || typeof value !== "object") return null;
  const raw = (value as Record<string, unknown>)[key];
  return typeof raw === "string" && raw.length > 0 ? raw : null;
}

function readStringArray(value: unknown, key: string): string[] {
  if (!value || typeof value !== "object") return [];
  const raw = (value as Record<string, unknown>)[key];
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is string => typeof item === "string");
}
