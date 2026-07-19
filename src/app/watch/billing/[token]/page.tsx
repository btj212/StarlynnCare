import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { getSubscriptionByBillingToken } from "@/lib/facility-watch/subscriptions";
import { getServiceClient } from "@/lib/supabase/server";
import { BillingPortalButton } from "./BillingPortalButton";
import { canonicalFor } from "@/lib/seo/canonical";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manage Facility Watch billing | StarlynnCare",
  robots: { index: false, follow: false },
  alternates: { canonical: canonicalFor("/watch/billing") },
};

type PageProps = {
  params: Promise<{ token: string }>;
};

export default async function WatchBillingPage({ params }: PageProps) {
  const { token } = await params;
  const sub = await getSubscriptionByBillingToken(token);
  if (!sub) notFound();

  const supabase = getServiceClient();
  const { data: facility } = await supabase
    .from("facilities")
    .select("name, slug, city_slug, state_slug")
    .eq("id", sub.facility_id)
    .maybeSingle();

  const facilityName = facility?.name ?? "Facility";
  const facilityHref = facility
    ? `/${facility.state_slug}/${facility.city_slug}/${facility.slug}`
    : "/";

  const statusLabel =
    sub.status === "active"
      ? "Active"
      : sub.status === "past_due"
        ? "Past due"
        : sub.status === "canceled"
          ? "Canceled"
          : sub.status === "pending"
            ? "Pending activation"
            : sub.status;

  const fulfillmentLabel =
    sub.fulfillment_status === "active"
      ? "Monitoring active"
      : sub.fulfillment_status === "paused"
        ? "Monitoring paused"
        : "Monitoring setup in progress";

  return (
    <>
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper min-h-[60vh] px-4 py-20 md:px-8">
        <div className="mx-auto max-w-[640px]">
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-ink-2 mb-4">
            Facility Watch · Billing
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,48px)] leading-[1.05] tracking-[-0.02em] text-ink">
            Manage your subscription
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            Watching{" "}
            <Link
              href={facilityHref}
              className="text-teal underline underline-offset-4"
            >
              {facilityName}
            </Link>
            .
          </p>

          <dl className="mt-8 space-y-3 border border-paper-rule bg-paper-2 p-5 font-[family-name:var(--font-mono)] text-[12px]">
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Status</dt>
              <dd className="text-ink">{statusLabel}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Plan</dt>
              <dd className="text-ink">
                {sub.billing_interval === "year" ? "Annual" : "Monthly"}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-ink-3">Monitoring</dt>
              <dd className="text-ink">{fulfillmentLabel}</dd>
            </div>
            {sub.current_period_end && (
              <div className="flex justify-between gap-4">
                <dt className="text-ink-3">
                  {sub.cancel_at_period_end ? "Ends" : "Renews"}
                </dt>
                <dd className="text-ink">
                  {new Date(sub.current_period_end).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            )}
          </dl>

          <div className="mt-8">
            <BillingPortalButton token={token} />
          </div>

          <p className="mt-8 font-[family-name:var(--font-mono)] text-[11px] leading-relaxed text-ink-3">
            Canceling paid Facility Watch does not remove a legacy official-record
            alert, if you already have one. Those alerts are managed separately
            from the unsubscribe link in those emails.
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
