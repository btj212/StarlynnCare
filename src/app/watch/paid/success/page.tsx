import Link from "next/link";
import type { Metadata } from "next";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { getStripe } from "@/lib/stripe/server";
import { getServiceClient } from "@/lib/supabase/server";
import { PaidWatchSuccessClient } from "./PaidWatchSuccessClient";
import { canonicalFor } from "@/lib/seo/canonical";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Facility Watch · Payment received | StarlynnCare",
  robots: { index: false, follow: false },
  alternates: { canonical: canonicalFor("/watch/paid/success") },
};

type PageProps = {
  searchParams: Promise<{ session_id?: string }>;
};

export default async function PaidWatchSuccessPage({ searchParams }: PageProps) {
  const { session_id: sessionId } = await searchParams;

  let facilityName = "your facility";
  let confirmed = false;

  if (sessionId && process.env.STRIPE_SECRET_KEY) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (
        session.payment_status === "paid" ||
        session.status === "complete"
      ) {
        confirmed = true;
        const facilityId = session.metadata?.facility_id;
        if (facilityId) {
          const supabase = getServiceClient();
          const { data: facility } = await supabase
            .from("facilities")
            .select("name")
            .eq("id", facilityId)
            .maybeSingle();
          if (facility?.name) facilityName = facility.name;
        }
      }
    } catch (err) {
      console.error("[paid-watch/success] session lookup failed:", err);
    }
  }

  return (
    <>
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper min-h-[60vh] px-4 py-20 md:px-8">
        <div className="mx-auto max-w-[640px]">
          <PaidWatchSuccessClient />
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-ink-2 mb-4">
            Facility Watch · Premium
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,48px)] leading-[1.05] tracking-[-0.02em] text-ink">
            {confirmed ? "Payment received." : "Thanks — checking your payment."}
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            {confirmed ? (
              <>
                We&rsquo;re setting up monitoring for <em>{facilityName}</em>.
                You&rsquo;ll receive a welcome email shortly. Alerts are typically
                active within one business day — we never claim monitoring is live
                until it is.
              </>
            ) : (
              <>
                If you just completed checkout, give it a moment and check your
                email. If something looks wrong, reply to your receipt or contact
                us.
              </>
            )}
          </p>
          <div className="mt-10 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/"
              className="inline-flex h-11 items-center justify-center px-5 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-teal underline underline-offset-4"
            >
              ← Back to StarlynnCare
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
