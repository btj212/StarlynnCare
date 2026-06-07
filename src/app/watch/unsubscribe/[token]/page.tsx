import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";
import { GovernanceBar } from "@/components/site/GovernanceBar";
import { getServiceClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ token: string }>;
};

export const dynamic = "force-dynamic";

export default async function WatchUnsubscribePage({ params }: PageProps) {
  const { token } = await params;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    notFound();
  }

  const supabase = getServiceClient();

  const { error } = await supabase
    .from("facility_watchers")
    .delete()
    .eq("unsubscribe_token", token);

  if (error) {
    console.error("[watch] unsubscribe error:", error.message);
  }

  return (
    <>
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper min-h-[60vh] px-4 py-20 md:px-8">
        <div className="mx-auto max-w-[640px]">
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-ink-2 mb-4">
            Watch · Unsubscribed
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink">
            You&rsquo;ve been removed.
          </h1>
          <p className="mt-6 font-[family-name:var(--font-display)] text-[18px] italic leading-relaxed text-ink-2">
            You won&rsquo;t receive any more updates for this facility.
          </p>
          <div className="mt-10">
            <Link
              href="/"
              className="font-[family-name:var(--font-mono)] text-[12px] tracking-[0.08em] text-teal underline underline-offset-4 decoration-teal/30 hover:decoration-teal transition-colors"
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
