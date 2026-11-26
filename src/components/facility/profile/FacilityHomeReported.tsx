import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { MOVE_OUT_REASONS, type HomeResponse } from "@/lib/facility/homeResponse";

async function loadHomeResponse(facilityId: string): Promise<HomeResponse | null> {
  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;
  const { data, error } = await supabase
    .rpc("facility_home_response", { p_facility_id: facilityId })
    .limit(1);
  if (error) {
    console.error("[home-reported] facility_home_response failed:", error.message);
    return null;
  }
  return ((data ?? []) as HomeResponse[])[0] ?? null;
}

function money(n: number): string {
  return `$${n.toLocaleString("en-US")}`;
}

function formatDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function rows(r: HomeResponse): Array<{ label: string; value: string }> {
  const out: Array<{ label: string; value: string }> = [];
  if (r.memory_care) {
    out.push({
      label: "Memory and dementia care at this address",
      value: r.memory_care === "yes" ? "Yes" : "No",
    });
  }
  if (r.wandering) {
    out.push({
      label: "Residents who wander or become agitated",
      value:
        r.wandering === "yes"
          ? "Accepted"
          : r.wandering === "yes_after_assessment"
            ? "Accepted after an individual assessment"
            : "Not accepted",
    });
  }
  if (r.private_pay_low != null && r.private_pay_high != null) {
    out.push({
      label: "Private-pay range",
      value: `${money(r.private_pay_low)} to ${money(r.private_pay_high)} a month, depending on care needs`,
    });
  }
  if (r.medicaid) {
    out.push({
      label: "Medicaid",
      value:
        r.medicaid === "yes"
          ? `Accepted${r.medicaid_program ? ` through ${r.medicaid_program}` : ""}, subject to eligibility`
          : "Not accepted",
    });
  }
  if (r.overnight_staff != null && r.overnight_residents != null) {
    out.push({
      label: "Staff awake overnight",
      value: `${r.overnight_staff} ${r.overnight_staff === 1 ? "staff member" : "staff"} awake for ${r.overnight_residents} ${r.overnight_residents === 1 ? "resident" : "residents"}`,
    });
  }
  const reasons = (r.move_out_reasons ?? []).flatMap((v) =>
    MOVE_OUT_REASONS.filter((m) => m.value === v).map((m) => m.label as string),
  );
  if (reasons.length > 0 || r.move_out_note) {
    const list = reasons.length > 0 ? `If residents ${reasons.join("; or ")}.` : "";
    out.push({
      label: "When the home may ask a resident to move out",
      value: [list, r.move_out_note].filter(Boolean).join(" "),
    });
  }
  return out;
}

/**
 * What the home told us when we asked. Shown only when the home has answered,
 * and always as the home's own statement: neither the state nor StarlynnCare
 * checked these answers, and openings are never printed.
 */
export async function FacilityHomeReported({ facilityId }: { facilityId: string }) {
  const response = await loadHomeResponse(facilityId);
  if (!response) return null;
  const items = rows(response);
  if (items.length === 0) return null;
  const how =
    response.channel === "email"
      ? "by email"
      : response.channel === "phone"
        ? "by phone"
        : "through our online form";

  return (
    <section id="home-reported" className="border-y border-clearing-rule bg-clearing-tint">
      <div className="mx-auto max-w-[1280px] px-4 py-10 sm:px-6 md:px-[60px]">
        <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal/30 bg-clearing-card px-3 py-1 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.1em] text-teal">
          <span aria-hidden="true">&#10003;</span>
          Home-confirmed &middot; {formatDate(response.responded_on)}
        </p>
        <h2 className="mb-2 font-[family-name:var(--font-display)] text-[28px] leading-[1.1] tracking-[-0.01em] text-ink">
          What the home told us
        </h2>
        <p className="mb-6 max-w-[62ch] text-[15px] leading-relaxed text-ink-3">
          We asked the home these questions directly, and it answered {how} on{" "}
          {formatDate(response.responded_on)}. These are the home&rsquo;s own statements. Neither the
          state nor StarlynnCare has checked them, and prices and availability change, so confirm
          with the home before you decide.
        </p>
        <dl className="m-0 grid gap-3 md:grid-cols-2">
          {items.map((item) => (
            <div
              key={item.label}
              className="rounded-[16px] border border-clearing-rule-2 bg-clearing-card px-5 py-4 shadow-[var(--shadow-card)]"
            >
              <dt className="mb-1 font-[family-name:var(--font-sans)] text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">
                {item.label}
              </dt>
              <dd className="m-0 text-[16px] leading-snug text-ink">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
