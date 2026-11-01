import type { Metadata } from "next";
import Link from "next/link";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { getStripe } from "@/lib/stripe/server";
import { getServiceClient } from "@/lib/supabase/server";
import { canonicalFor } from "@/lib/seo/canonical";
import { formatFacilityName } from "@/lib/facility/displayName";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Verified Partner · Payment received | StarlynnCare",
  robots: { index: false, follow: false },
  alternates: { canonical: canonicalFor("/partners/success") },
};

type PageProps = { searchParams: Promise<{ session_id?: string }> };

export default async function PartnerSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;
  let community = "your community";
  let confirmed = false;
  let managePath: string | null = null;

  if (sessionId && process.env.STRIPE_SECRET_KEY && sessionId.startsWith("cs_")) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session.metadata?.product === "verified_partner" && (session.payment_status === "paid" || session.status === "complete")) {
        confirmed = true;
        const facilityId = session.metadata.facility_id;
        if (facilityId) {
          const supabase = getServiceClient();
          const { data: facility } = await supabase
            .from("facilities")
            .select("name")
            .eq("id", facilityId)
            .maybeSingle();
          if (facility?.name) community = formatFacilityName(facility.name);
          const { data: partner } = await supabase
            .from("partners")
            .select("billing_token")
            .eq("facility_id", facilityId)
            .maybeSingle();
          if (partner?.billing_token) managePath = `/partners/billing/${partner.billing_token}`;
        }
      }
    } catch (err) {
      console.error("[partners/success] session lookup failed:", err);
    }
  }

  return (
    <>
      <GovernanceBar />
      <SiteNav />
      <main className="min-h-[60vh] bg-paper px-4 py-20">
        <div className="mx-auto max-w-[640px]">
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,48px)] text-ink">
            {confirmed ? "Payment received." : "Checking the payment."}
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            {confirmed
              ? `The partnership for ${community} is recorded when Stripe confirms the subscription. The labeled panel goes up after the profile is published. The payment does not change the grade or the rank.`
              : "If you just finished checkout, give it a moment. If something looks wrong, write to hello@starlynncare.com."}
          </p>
          {managePath ? (
            <p className="mt-6">
              <Link href={managePath} className="underline text-ink">
                Manage billing
              </Link>
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
