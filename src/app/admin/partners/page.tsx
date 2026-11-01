import Link from "next/link";
import { getServiceClient } from "@/lib/supabase/server";
import { formatFacilityName } from "@/lib/facility/displayName";
import { stateFromCode } from "@/lib/states";
import { loadPartnerGate } from "@/lib/partners/gate";
import {
  endPartnership,
  pausePartnerManually,
  resumePartner,
  savePartnerProfile,
} from "@/app/admin/partners/actions";

export const dynamic = "force-dynamic";

type PartnerListRow = {
  id: string;
  facility_id: string;
  contact_email: string;
  plan: string;
  billing_interval: string;
  status: string;
  is_founding: boolean;
  pause_reason: string | null;
  collection_paused: boolean;
  stripe_subscription_id: string | null;
  gate_last_pass: boolean | null;
  gate_last_checked_at: string | null;
};

type ProfileRow = {
  facility_id: string;
  photo_urls: string[] | null;
  price_min: number | null;
  price_max: number | null;
  openings_text: string | null;
  staffing_day: string | null;
  staffing_night: string | null;
  description: string | null;
  tour_contact_email: string | null;
  content_updated_at: string | null;
  published: boolean;
};

type FacilityRow = {
  id: string;
  name: string;
  slug: string;
  city_slug: string;
  state_code: string;
};

export default async function AdminPartnersPage({
  searchParams,
}: {
  searchParams: Promise<{ facility?: string }>;
}) {
  const { facility: selectedId } = await searchParams;
  const supabase = getServiceClient();
  const { data: partnerRows, error } = await supabase
    .from("partners")
    .select(
      "id, facility_id, contact_email, plan, billing_interval, status, is_founding, pause_reason, collection_paused, stripe_subscription_id, gate_last_pass, gate_last_checked_at",
    )
    .order("updated_at", { ascending: false });
  if (error) {
    return <p className="text-sm text-red-700">Partner records could not be loaded. Apply migration 0071 first.</p>;
  }
  const partners = (partnerRows ?? []) as PartnerListRow[];
  const ids = partners.map((row) => row.facility_id);
  const [{ data: facilities }, { data: profiles }] = await Promise.all([
    ids.length
      ? supabase.from("facilities").select("id, name, slug, city_slug, state_code").in("id", ids)
      : Promise.resolve({ data: [] as FacilityRow[] }),
    ids.length
      ? supabase
          .from("partner_profiles")
          .select(
            "facility_id, photo_urls, price_min, price_max, openings_text, staffing_day, staffing_night, description, tour_contact_email, content_updated_at, published",
          )
          .in("facility_id", ids)
      : Promise.resolve({ data: [] as ProfileRow[] }),
  ]);
  const facilityById = new Map(((facilities ?? []) as FacilityRow[]).map((row) => [row.id, row]));
  const profileById = new Map(((profiles ?? []) as ProfileRow[]).map((row) => [row.facility_id, row]));
  const selected = partners.find((row) => row.facility_id === selectedId) ?? null;
  const selectedFacility = selected ? facilityById.get(selected.facility_id) : undefined;
  const selectedProfile = selected ? profileById.get(selected.facility_id) : undefined;
  const gate = selected ? await loadPartnerGate(selected.facility_id) : null;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold text-navy">Verified Partners</h1>
        <p className="mt-1 max-w-3xl text-sm text-gray-500">
          Concierge only. A partnership adds a labeled block on that community’s own page. It does not change a grade, a rank, or a citation. Checkout stays closed until PARTNER_CHECKOUT_ENABLED is 1.
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-xs font-semibold text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left">Community</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Plan</th>
              <th className="px-4 py-3 text-left">Last gate</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {partners.map((row) => {
              const facility = facilityById.get(row.facility_id);
              return (
                <tr key={row.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/partners?facility=${row.facility_id}`} className="font-medium text-teal hover:underline">
                      {facility ? formatFacilityName(facility.name) : row.facility_id}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.status}
                    {row.pause_reason ? ` · ${row.pause_reason}` : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.plan} · {row.billing_interval}
                    {row.is_founding ? " · founding" : ""}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.gate_last_pass == null ? "Not checked" : row.gate_last_pass ? "Pass" : "Fail"}
                  </td>
                </tr>
              );
            })}
            {partners.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  No partners yet.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {selected && selectedFacility ? (
        <PartnerEditor
          partner={selected}
          facility={selectedFacility}
          profile={selectedProfile}
          gatePass={gate?.pass === true && gate.publishable}
          gateDetail={gate?.rules.map((rule) => `${rule.pass ? "Pass" : "Fail"}: ${rule.detail}`).join("\n") ?? "Gate unavailable."}
        />
      ) : null}
    </div>
  );
}

function PartnerEditor({
  partner,
  facility,
  profile,
  gatePass,
  gateDetail,
}: {
  partner: PartnerListRow;
  facility: FacilityRow;
  profile: ProfileRow | undefined;
  gatePass: boolean;
  gateDetail: string;
}) {
  const state = stateFromCode(facility.state_code)?.slug ?? facility.state_code.toLowerCase();
  const href = `/${state}/${facility.city_slug}/${facility.slug}`;
  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-navy">{formatFacilityName(facility.name)}</h2>
      <p className="mt-1 text-sm text-gray-500">
        <a href={href} className="text-teal hover:underline">{href}</a>
        {" · "}
        {partner.stripe_subscription_id ? "Stripe subscription on file" : "No Stripe subscription"}
        {" · "}
        {gatePass ? "Gate passes now" : "Gate does not pass now"}
      </p>
      <pre className="mt-3 whitespace-pre-wrap text-xs text-gray-600">{gateDetail}</pre>
      <form action={savePartnerProfile} className="mt-4 grid gap-3">
        <input type="hidden" name="facilityId" value={partner.facility_id} />
        <label className="text-sm text-gray-600">
          Billing contact
          <input name="contactEmail" defaultValue={partner.contact_email} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm text-gray-600">
          Tour inbox
          <input name="tourEmail" defaultValue={profile?.tour_contact_email ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <label className="text-sm text-gray-600">
          Description, 150 words
          <textarea name="description" rows={5} defaultValue={profile?.description ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-600">
            Price low
            <input name="priceMin" defaultValue={profile?.price_min ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm text-gray-600">
            Price high
            <input name="priceMax" defaultValue={profile?.price_max ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
        </div>
        <label className="text-sm text-gray-600">
          Openings
          <input name="openings" defaultValue={profile?.openings_text ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm text-gray-600">
            Day staffing
            <input name="staffingDay" defaultValue={profile?.staffing_day ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
          <label className="text-sm text-gray-600">
            Night staffing
            <input name="staffingNight" defaultValue={profile?.staffing_night ?? ""} className="mt-1 w-full rounded border px-3 py-2" />
          </label>
        </div>
        <label className="text-sm text-gray-600">
          Photo URLs, one https link per line, up to 12
          <textarea name="photos" rows={4} defaultValue={(profile?.photo_urls ?? []).join("\n")} className="mt-1 w-full rounded border px-3 py-2 font-mono text-xs" />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input type="checkbox" name="published" defaultChecked={profile?.published === true} />
          Published. The public page still requires an active partnership and a passing gate.
        </label>
        <p className="text-xs text-gray-500">
          Prices and openings were last confirmed {profile?.content_updated_at ?? "never"}. Saving confirms them again.
        </p>
        <button type="submit" className="w-fit rounded bg-navy px-4 py-2 text-sm text-white">
          Save profile
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-3">
        <form action={pausePartnerManually}>
          <input type="hidden" name="facilityId" value={partner.facility_id} />
          <button type="submit" className="rounded border px-4 py-2 text-sm">Pause</button>
        </form>
        <form action={resumePartner}>
          <input type="hidden" name="facilityId" value={partner.facility_id} />
          <button type="submit" className="rounded border px-4 py-2 text-sm">Resume if the gate passes</button>
        </form>
        <form action={endPartnership}>
          <input type="hidden" name="facilityId" value={partner.facility_id} />
          <button type="submit" className="rounded border border-red-200 px-4 py-2 text-sm text-red-700">End partnership</button>
        </form>
      </div>
    </section>
  );
}
