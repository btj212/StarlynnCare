import Link from "next/link";
import { SiteNav } from "@/components/site/SiteNav";
import { SiteFooter } from "@/components/site/SiteFooter";

export default function FacilityNotFound() {
  return (
    <>
      <SiteNav />
      <main className="border-b border-sc-border bg-warm-white px-6 py-24 md:px-8">
        <div className="mx-auto max-w-[680px] text-center">
          <h1 className="font-[family-name:var(--font-serif)] text-3xl font-semibold text-navy">
            Facility not found
          </h1>
          <p className="mt-4 text-slate">
            There is no Florida facility with that URL slug in the database yet.
          </p>
          <Link
            href="/florida"
            className="mt-8 inline-block font-semibold text-teal underline-offset-4 hover:underline"
          >
            Browse Florida facilities
          </Link>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
