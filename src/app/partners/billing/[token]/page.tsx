import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getServiceClient } from "@/lib/supabase/server";
import { canonicalFor } from "@/lib/seo/canonical";
import { formatFacilityName } from "@/lib/facility/displayName";
import { PartnerPortalButton } from "@/components/partners/PartnerPortalButton";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified Partner billing | StarlynnCare",
  robots: { index: false, follow: false },
  alternates: { canonical: canonicalFor("/partners") },
};

type PageProps = { params: Promise<{ token: string }> };

export default async function PartnerBillingPage({ params }: PageProps) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();
  const supabase = getServiceClient();
  const { data } = await supabase
    .from("partners")
    .select("status, plan, billing_interval, facility_id, stripe_customer_id")
    .eq("billing_token", token)
    .maybeSingle();
  if (!data) notFound();
  const { data: facility } = await supabase
    .from("facilities")
    .select("name")
    .eq("id", data.facility_id)
    .maybeSingle();
  const name = facility?.name;

  return (
    <>
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh] bg-paper px-4 py-20">
        <div className="mx-auto max-w-[640px]">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,48px)] text-ink">
            {formatFacilityName(name) || "Partner billing"}
          </h1>
          <p className="mt-4 text-ink-2">
            {data.plan} · {data.billing_interval} · {data.status}
          </p>
          <p className="mt-4 text-sm leading-relaxed text-ink-3">
            Canceling stops the labeled panel. It does not change the public record.
          </p>
          {data.stripe_customer_id ? <PartnerPortalButton token={token} /> : null}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
