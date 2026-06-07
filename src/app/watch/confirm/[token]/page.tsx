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

export default async function WatchConfirmPage({ params }: PageProps) {
  const { token } = await params;

  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    notFound();
  }

  const supabase = getServiceClient();

  // Fetch the watcher row before updating so we can show the facility name
  const { data: existing } = await supabase
    .from("facility_watchers")
    .select("id, confirmed_at, email, facility_id, facilities(name, slug, city_slug, state_slug)")
    .eq("confirmation_token", token)
    .maybeSingle();

  if (!existing) {
    return (
      <>
        <GovernanceBar />
        <SiteNav badge="" />
        <main className="bg-paper min-h-[60vh] px-4 py-20 md:px-8">
          <div className="mx-auto max-w-[640px]">
            <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-rust mb-4">
              Watch · Confirmation
            </p>
            <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink">
              This link has already been used or has expired.
            </h1>
            <p className="mt-5 font-[family-name:var(--font-display)] text-[18px] italic leading-relaxed text-ink-2">
              If you still want to watch this facility, go back to the facility
              page and sign up again.
            </p>
          </div>
        </main>
        <SiteFooter />
      </>
    );
  }

  type FacilityRef = { name: string; slug: string; city_slug: string; state_slug: string } | null;
  const facility = (existing.facilities as FacilityRef | FacilityRef[]);
  const fac = Array.isArray(facility) ? facility[0] : facility;

  // Mark confirmed if not already
  if (!existing.confirmed_at) {
    await supabase
      .from("facility_watchers")
      .update({ confirmed_at: new Date().toISOString() })
      .eq("confirmation_token", token)
      .is("confirmed_at", null);
  }

  const facilityHref =
    fac ? `/${fac.state_slug}/${fac.city_slug}/${fac.slug}` : null;
  const facilityName = fac?.name ?? "this facility";

  return (
    <>
      <GovernanceBar />
      <SiteNav badge="" />
      <main className="bg-paper min-h-[60vh] px-4 py-20 md:px-8">
        <div className="mx-auto max-w-[640px]">
          <p className="font-[family-name:var(--font-mono)] text-[10.5px] uppercase tracking-[0.18em] text-teal mb-4">
            Watch confirmed
          </p>
          <h1 className="font-[family-name:var(--font-display)] text-[clamp(32px,5vw,52px)] leading-[1.05] tracking-[-0.02em] text-ink">
            You&rsquo;re watching{" "}
            <em className="not-italic text-rust">{facilityName}.</em>
          </h1>

          <div className="mt-8 border-l-2 border-teal/40 pl-5 space-y-3">
            <p className="font-[family-name:var(--font-display)] text-[18px] italic leading-relaxed text-ink-2">
              You&rsquo;ll get an email when their inspection record changes. We&rsquo;re
              building that now — expect alerts starting later this summer.
            </p>
          </div>

          <div className="mt-10 flex flex-col gap-3 sm:flex-row sm:gap-5 font-[family-name:var(--font-mono)] text-[12px] tracking-[0.08em]">
            {facilityHref && (
              <Link
                href={facilityHref}
                className="text-teal underline underline-offset-4 decoration-teal/30 hover:decoration-teal transition-colors"
              >
                ← Back to {facilityName}
              </Link>
            )}
            <Link
              href="/methodology"
              className="text-ink-2 underline underline-offset-4 decoration-ink/20 hover:decoration-ink transition-colors"
            >
              How we score facilities →
            </Link>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
