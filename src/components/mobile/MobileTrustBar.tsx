import { GovernanceStatement } from "@/components/site/GovernanceBar";

/** Verbatim governance + editorial independence label (brief §1, §3). */
export function MobileTrustBar() {
  return (
    <section className="m-trust" aria-label="Editorial independence statement">
      <div className="label">Editorial Independence</div>
      <p>
        <GovernanceStatement />
      </p>
    </section>
  );
}
