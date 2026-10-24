import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteNav } from "@/components/site/SiteNav";
import { canonicalFor } from "@/lib/seo/canonical";
import { getServiceClient } from "@/lib/supabase/server";
import { PreferenceForm } from "./PreferenceForm";

type PageProps = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: "Email preferences | StarlynnCare",
    alternates: { canonical: canonicalFor(`/preferences/${token}`) },
    robots: { index: false, follow: false },
  };
}

type CommitmentRow = {
  id: string;
  product: string;
  subject_key: string;
  status: string;
  metadata: Record<string, unknown>;
};

const PRODUCT_LABEL: Record<string, string> = {
  records_email: "Inspection record",
  tour_pack: "Tour pack",
  area_watch: "Area Watch",
  facility_watch: "Facility Watch",
  paid_facility_watch: "Facility Watch Premium",
  library_magnet: "Guide",
  contract_review: "Contract review",
  shortlist_report: "Shortlist report",
  waitlist: "Waitlist",
};

export default async function PreferencesPage({ params }: PageProps) {
  const { token } = await params;
  if (!/^[a-f0-9]{64}$/.test(token)) notFound();

  const supabase = getServiceClient();
  const { data: pref } = await supabase
    .from("customer_preferences")
    .select("email, unsubscribed_all")
    .eq("token", token)
    .maybeSingle();

  if (!pref || typeof pref !== "object" || typeof pref.email !== "string") notFound();

  const { data } = await supabase
    .from("customer_commitments")
    .select("id, product, subject_key, status, metadata")
    .eq("email", pref.email)
    .order("created_at", { ascending: false });

  const rows = (Array.isArray(data) ? data : []) as CommitmentRow[];

  return (
    <>
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper min-h-[60vh] px-4 py-16 md:px-8">
        <div className="mx-auto max-w-[680px]">
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-ink-2 mb-4">
            Email preferences
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink">
            Choose what we send.
          </h1>
          <p className="mt-6 text-[17px] leading-relaxed text-ink-2">
            Stopping one update does not cancel the others. Facility Watch Premium billing is separate — use the manage link in your receipt to end a paid subscription.
          </p>
          <PreferenceForm
            token={token}
            unsubscribedAll={pref.unsubscribed_all === true}
            items={rows.map((row) => ({
              id: row.id,
              label: labelFor(row),
              status: row.status,
            }))}
          />
          <div className="mt-10">
            <Link
              href="/"
              className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.08em] text-teal underline underline-offset-4"
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

function labelFor(row: CommitmentRow): string {
  const product = PRODUCT_LABEL[row.product] ?? row.product;
  const area = row.metadata?.areaName;
  const magnet = row.metadata?.magnet;
  const detail = typeof area === "string" ? area : typeof magnet === "string" ? magnet : "";
  return detail ? `${product} · ${detail}` : product;
}
