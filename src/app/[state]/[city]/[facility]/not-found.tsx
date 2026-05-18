"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function FacilityNotFound() {
  const pathname = usePathname();
  // pathname is like /oregon/brookings/brightcreek-at-sea-view
  const segments = (pathname ?? "").split("/").filter(Boolean);
  const stateSlug = segments[0] ?? null;
  const citySlug = segments[1] ?? null;

  const stateLabel = stateSlug
    ? stateSlug.charAt(0).toUpperCase() + stateSlug.slice(1).replace(/-/g, " ")
    : null;
  const cityLabel = citySlug
    ? citySlug.charAt(0).toUpperCase() + citySlug.slice(1).replace(/-/g, " ")
    : null;

  const browseHref = stateSlug ? `/${stateSlug}/facilities` : "/states";
  const browseLabel =
    cityLabel && stateLabel
      ? `Browse ${cityLabel}, ${stateLabel} memory care facilities`
      : stateLabel
        ? `Browse ${stateLabel} memory care facilities`
        : "Browse all memory care facilities";

  return (
    <>
      <SiteNav badge="" />
      <main className="border-b border-sc-border bg-warm-white px-6 py-24 md:px-8">
        <div className="mx-auto max-w-[680px] text-center">
          <h1 className="font-[family-name:var(--font-sans)] text-3xl font-semibold text-navy">
            Facility not published
          </h1>
          <p className="mt-4 text-slate">
            Either this facility is not in our database yet, or it has not been
            marked publishable because we do not yet have verified state-agency
            data for it.
          </p>
          <Link
            href={browseHref}
            className="mt-8 inline-block font-semibold text-teal underline-offset-4 hover:underline"
          >
            {browseLabel}
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
