import type { ComplianceFlag } from "@/lib/facility/complianceFlag";

function linked(text: string) {
  const parts = text.split(/(https?:\/\/[^\s)]+)/g);
  return parts.map((part, index) =>
    part.startsWith("http") ? (
      <a key={index} href={part} className="underline" rel="noopener noreferrer">
        DSHS
      </a>
    ) : (
      <span key={index}>{part}</span>
    ),
  );
}

export function ComplianceFlagBanner({
  flag,
  placement,
}: {
  flag: ComplianceFlag | null;
  placement: "top" | "section";
}) {
  if (!flag?.banner_text) return null;
  if (placement === "top" && flag.tier === 3) return null;
  if (placement === "section" && flag.tier !== 3) return null;

  const tone =
    flag.tier === 1
      ? { background: "var(--color-rust-soft)", border: "var(--color-rust)" }
      : flag.tier === 2
        ? { background: "var(--color-gold-soft)", border: "var(--color-gold)" }
        : { background: "var(--color-paper-2)", border: "var(--color-clearing-rule)" };

  return (
    <section
      className="border-b px-4 py-4 sm:px-6 md:px-[60px]"
      style={{ background: tone.background, borderColor: tone.border }}
    >
      <div className="mx-auto max-w-[1280px]">
        <p className="m-0 max-w-[75ch] font-[family-name:var(--font-sans)] text-[15px] leading-relaxed text-ink">
          {linked(flag.banner_text)}
        </p>
      </div>
    </section>
  );
}
