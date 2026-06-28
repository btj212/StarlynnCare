import Link from "next/link";
import { tryPublicSupabaseClient } from "@/lib/supabase/server";
import { stateFromSlug } from "@/lib/states";

type Props = {
  facilityId: string;
  operatorName: string | null;
  stateSlug: string;
};

type Row = {
  id: string;
  name: string;
  city: string | null;
  slug: string;
  city_slug: string;
};

const MAX_SAME_OPERATOR = 6;
const MIN_OPERATOR_LEN = 3;

/**
 * Other publishable facilities in the same state sharing this operator name (from licensing records).
 */
export async function SameOperatorFacilities({ facilityId, operatorName, stateSlug }: Props) {
  const trimmed = operatorName?.trim() ?? "";
  if (trimmed.length < MIN_OPERATOR_LEN) return null;

  const stateInfo = stateFromSlug(stateSlug);
  if (!stateInfo) return null;

  const supabase = tryPublicSupabaseClient();
  if (!supabase) return null;

  const { data: raw } = await supabase
    .from("facilities")
    .select("id, name, city, slug, city_slug")
    .eq("state_code", stateInfo.code)
    .eq("publishable", true)
    .eq("operator_name", trimmed)
    .neq("id", facilityId)
    .order("last_inspection_date", { ascending: false, nullsFirst: false })
    .limit(MAX_SAME_OPERATOR);

  if (!raw?.length) return null;

  const ranked = raw as Row[];

  return (
    <section className="border-t border-paper-rule pt-12 mt-12">
      <div className="mb-3 font-[family-name:var(--font-mono)] text-[11px] uppercase tracking-[0.14em] text-rust border-t-2 border-ink pt-2.5 inline-block">
        Same operator group
      </div>
      <h2 className="font-[family-name:var(--font-sans)] font-semibold text-[28px] leading-[1.1] tracking-[-0.01em] text-ink mb-3">
        Other facilities <em>under this operator</em>
      </h2>
      <p className="text-[14px] text-ink-3 max-w-[72ch] leading-relaxed mb-2">
        <span className="text-ink font-medium">{trimmed}</span>
        <span className="text-ink-3">
          {" "}
          — as recorded on state license extracts. Each facility still has its own inspection history.
        </span>
      </p>

      <div className="grid gap-0 border-t border-ink md:grid-cols-3 mt-8">
        {ranked.map((f) => (
          <Link
            key={f.id}
            href={`/${stateSlug}/${f.city_slug}/${f.slug}`}
            className="flex items-start gap-4 px-5 py-5 border-r border-b border-paper-rule last:border-r-0 no-underline text-ink hover:bg-paper-2 transition-colors"
          >
            <div>
              <p className="font-[family-name:var(--font-sans)] font-semibold text-[18px] leading-[1.15] tracking-[-0.005em] m-0">
                {f.name}
              </p>
              {f.city && (
                <p className="font-[family-name:var(--font-mono)] text-[11px] text-ink-3 tracking-[0.06em] mt-1">
                  {f.city}
                </p>
              )}
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
