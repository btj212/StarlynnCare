import type { Facility, CareCategory } from "@/lib/types";

/** Lightweight citation record passed from the page. */
export type CitationRecord = { code: string; date: string };

const MC_CATEGORIES: CareCategory[] = [
  "rcfe_memory_care",
  "alf_memory_care",
  "snf_dementia_scu",
];

function isMcFacility(facility: Facility): boolean {
  return (
    MC_CATEGORIES.includes(facility.care_category) || facility.serves_memory_care
  );
}

/** Find the most recent citation date matching any of the given code patterns. */
function latestCitationDate(
  citations: CitationRecord[],
  patterns: RegExp[],
): string | null {
  const matches = citations
    .filter((c) => patterns.some((re) => re.test(c.code)))
    .map((c) => c.date)
    .sort()
    .reverse();
  return matches[0] ?? null;
}

/** Format an ISO date string to "MMM YYYY". */
function fmtCiteDate(iso: string): string {
  const d = new Date(iso + "T12:00:00Z");
  return d.toLocaleString("en-US", { month: "short", year: "numeric", timeZone: "UTC" });
}

function CitedTag({ date }: { date: string }) {
  return (
    <span className="ml-2 inline-flex items-center rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
      Cited {fmtCiteDate(date)}
    </span>
  );
}

type NightStaffing = { requirement: string; note: string | null };

function nightStaffingFromBeds(beds: number | null): NightStaffing {
  if (beds === null) {
    return {
      requirement: "Bed count not yet indexed — staffing tier cannot be computed automatically.",
      note: "Ask the facility directly which §87415 staffing tier they operate under.",
    };
  }
  if (beds <= 15) {
    return {
      requirement: "One qualified staff member must be on call and physically on premises at all times overnight.",
      note: null,
    };
  }
  if (beds <= 100) {
    return {
      requirement: "One awake caregiver must be on duty, plus one additional caregiver on call who can respond within 10 minutes.",
      note: null,
    };
  }
  if (beds <= 200) {
    return {
      requirement:
        "One awake caregiver on duty, one on-call caregiver physically on premises, and one additional on-call caregiver.",
      note: null,
    };
  }
  const extraHundreds = Math.floor((beds - 200) / 100);
  const awake = 1 + extraHundreds;
  return {
    requirement: `${awake} awake caregivers on duty overnight, one on-call caregiver physically on premises, and one additional on-call caregiver.`,
    note: "State law adds one awake caregiver for each 100 residents above 200.",
  };
}

function RegChip({ cite }: { cite: string }) {
  return (
    <span className="inline-block rounded bg-sc-border/60 px-1.5 py-0.5 font-mono text-[10px] text-muted">
      {cite}
    </span>
  );
}

function TourCta({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 text-xs font-medium text-teal">
      Ask on tour: {children}
    </p>
  );
}

type CardProps = {
  question: string;
  defaultOpen?: boolean;
  icon: React.ReactNode;
  cite: string;
  citedDate?: string | null;
  children: React.ReactNode;
};

function Card({ question, defaultOpen = false, icon, cite, citedDate, children }: CardProps) {
  return (
    <details
      open={defaultOpen}
      className="group border-b border-sc-border/60 last:border-b-0"
    >
      <summary className="flex cursor-pointer list-none items-start gap-3 px-5 py-4 hover:bg-sc-border/10 transition-colors">
        <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-teal-light text-teal">
          {icon}
        </span>
        <span className="flex-1 min-w-0">
          <span className="block text-sm font-semibold text-ink leading-snug">
            {question}
            {citedDate && <CitedTag date={citedDate} />}
          </span>
          <span className="mt-0.5 block">
            <RegChip cite={cite} />
          </span>
        </span>
        <svg
          aria-hidden="true"
          className="mt-1 h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-90"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path
            fillRule="evenodd"
            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
            clipRule="evenodd"
          />
        </svg>
      </summary>
      <div className="px-5 pb-5 pt-1 pl-[3.75rem]">{children}</div>
    </details>
  );
}

const IconTraining = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
    <path d="M10.75 16.82A7.462 7.462 0 0115 15.5c.71 0 1.396.098 2.046.282A.75.75 0 0018 15.06v-11a.75.75 0 00-.546-.721A9.006 9.006 0 0015 3a8.963 8.963 0 00-4.25 1.065V16.82zM9.25 4.065A8.963 8.963 0 005 3c-.85 0-1.673.118-2.454.339A.75.75 0 002 4.06v11a.75.75 0 00.954.721A7.506 7.506 0 015 15.5c1.579 0 3.042.487 4.25 1.32V4.065z" />
  </svg>
);

const IconStaff = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
    <path d="M10 9a3 3 0 100-6 3 3 0 000 6zM6 8a2 2 0 11-4 0 2 2 0 014 0zM1.49 15.326a.78.78 0 01-.358-.442 3 3 0 014.308-3.516 6.484 6.484 0 00-1.905 3.959c-.023.222-.014.442.025.654a4.97 4.97 0 01-2.07-.655zM16.44 15.98a4.97 4.97 0 002.07-.654.78.78 0 00.357-.442 3 3 0 00-4.308-3.517 6.484 6.484 0 011.907 3.96 2.32 2.32 0 01-.026.654zM18 8a2 2 0 11-4 0 2 2 0 014 0zM5.304 16.19a.844.844 0 01-.277-.71 5 5 0 019.947 0 .843.843 0 01-.277.71A6.975 6.975 0 0110 18a6.974 6.974 0 01-4.696-1.81z" />
  </svg>
);

const IconHealth = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
    <path
      fillRule="evenodd"
      d="M3.5 2A1.5 1.5 0 002 3.5V5c0 1.149.15 2.263.43 3.326a13.022 13.022 0 009.244 9.244c1.063.28 2.177.43 3.326.43h1.5a1.5 1.5 0 001.5-1.5v-1.148a1.5 1.5 0 00-1.175-1.465l-3.223-.716a1.5 1.5 0 00-1.767 1.052l-.267.933c-.117.41-.555.643-.95.48a11.542 11.542 0 01-6.254-6.254c-.163-.395.07-.833.48-.95l.933-.267a1.5 1.5 0 001.051-1.767l-.716-3.223A1.5 1.5 0 004.648 2H3.5z"
      clipRule="evenodd"
    />
  </svg>
);

const IconReport = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
    <path
      fillRule="evenodd"
      d="M2 3.5A1.5 1.5 0 013.5 2h9A1.5 1.5 0 0114 3.5v11.75A2.75 2.75 0 0016.75 18h-12A2.75 2.75 0 012 15.25V3.5zm3.75 7a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zm0 3a.75.75 0 000 1.5h4.5a.75.75 0 000-1.5h-4.5zM5 5.75A.75.75 0 015.75 5h4.5a.75.75 0 01.75.75v2.5a.75.75 0 01-.75.75h-4.5A.75.75 0 015 8.25v-2.5z"
      clipRule="evenodd"
    />
    <path d="M16.5 6.5h-1v8.75a1.25 1.25 0 002.5 0V8a1.5 1.5 0 00-1.5-1.5z" />
  </svg>
);

const IconEnforce = () => (
  <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4" aria-hidden>
    <path
      fillRule="evenodd"
      d="M9.661 2.237a.531.531 0 01.678 0 11.947 11.947 0 007.078 2.749.5.5 0 01.479.425c.069.52.104 1.05.104 1.589 0 5.162-3.26 9.563-7.834 11.256a.48.48 0 01-.332 0C5.26 16.563 2 12.162 2 7c0-.538.035-1.069.104-1.589a.5.5 0 01.48-.425 11.947 11.947 0 007.077-2.749zm4.196 5.954a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z"
      clipRule="evenodd"
    />
  </svg>
);

export function RegulatoryBaseline({
  facility,
  citations = [],
}: {
  facility: Facility;
  citations?: CitationRecord[];
}) {
  const isMc = isMcFacility(facility);
  const nightStaffing = nightStaffingFromBeds(facility.beds);
  const bedLabel = facility.beds != null ? `${facility.beds} licensed beds` : null;

  // Find the most recent citation date for each card's regulation sections
  const trainingCited = latestCitationDate(citations, [/8770[56]/]);
  const staffingCited = latestCitationDate(citations, [/87415/]);
  const healthCited = latestCitationDate(citations, [/8761[2-5]/]);
  const reportingCited = latestCitationDate(citations, [/87211/]);
  const enforceCited = latestCitationDate(citations, [/877[6-7]\d/]);

  // Cards sorted: cited ones bubble to top, within that preserve original order
  type CardData = {
    id: string;
    citedDate: string | null;
    node: React.ReactNode;
  };

  const allCards: CardData[] = [
    {
      id: "training",
      citedDate: trainingCited,
      node: (
        <Card
          key="training"
          question={
            isMc
              ? "What dementia-care training must staff complete?"
              : "What training are all staff required to complete?"
          }
          defaultOpen={!trainingCited}
          icon={<IconTraining />}
          cite={isMc ? "22 CCR §87705 / HSC §1569.625" : "22 CCR §87411"}
          citedDate={trainingCited}
        >
          {isMc ? (
            <>
              <p className="text-sm leading-relaxed text-slate">
                Because this facility markets dementia or Alzheimer&apos;s care, state
                law mandates higher training standards:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span>
                    <strong className="text-ink">12 hours initial dementia training</strong> — 6 hours
                    before a staff member works independently with residents, 6
                    more within the first 4 weeks.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span>
                    <strong className="text-ink">8 hours annual dementia in-service</strong> — required
                    every year thereafter.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span>
                    <strong className="text-ink">Administrator CE</strong> — the administrator must
                    include 8 hours of dementia-specific continuing education in
                    every 2-year recertification cycle.
                  </span>
                </li>
              </ul>
              <p className="mt-3 text-xs text-muted">
                Training must cover individualized care plans, behavioral
                expressions, appropriate supervision, and the facility&apos;s
                dementia care philosophy.
              </p>
            </>
          ) : (
            <>
              <p className="text-sm leading-relaxed text-slate">
                All direct-care staff must complete:
              </p>
              <ul className="mt-3 space-y-2 text-sm text-slate">
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span>
                    <strong className="text-ink">10 hours initial training</strong> within the first
                    four weeks of employment.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span>
                    <strong className="text-ink">4 hours annual in-service</strong> every year
                    thereafter.
                  </span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-teal" />
                  <span>
                    <strong className="text-ink">Administrator certificate</strong> from a CDSS-approved
                    program — 80 hours for first-time, 40 hours renewal every 2
                    years.
                  </span>
                </li>
              </ul>
            </>
          )}
          <TourCta>
            {isMc
              ? "Ask how dementia training records are kept — families may request documentation."
              : "Ask when the last staff training was completed and how it's tracked."}
          </TourCta>
        </Card>
      ),
    },
    {
      id: "staffing",
      citedDate: staffingCited,
      node: (
        <Card
          key="staffing"
          question="How many staff must be on duty overnight?"
          icon={<IconStaff />}
          cite="22 CCR §87415"
          citedDate={staffingCited}
        >
          {bedLabel && (
            <p className="mb-2 text-xs text-muted">
              Based on {bedLabel}:
            </p>
          )}
          <p className="text-sm leading-relaxed text-slate">
            {nightStaffing.requirement}
          </p>
          {nightStaffing.note && (
            <p className="mt-2 text-xs text-muted">{nightStaffing.note}</p>
          )}
          <div className="mt-3 rounded-md border border-sc-border/60 bg-sc-border/10 px-3 py-2">
            <p className="text-xs text-slate">
              <strong className="text-ink">Violation pattern to watch for:</strong> A facility
              that documents a staff member as &quot;on call&quot; but with that person
              physically off-site — when the law requires on-premises presence —
              is in violation of this section.
            </p>
          </div>
          <TourCta>
            Ask the facility to walk you through their overnight staffing plan
            and confirm whether on-call staff are on premises or off-site.
          </TourCta>
        </Card>
      ),
    },
    {
      id: "health",
      citedDate: healthCited,
      node: (
        <Card
          key="health"
          question="What health conditions can this facility legally accept or refuse?"
          icon={<IconHealth />}
          cite="22 CCR §87612–87615"
          citedDate={healthCited}
        >
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                Restricted — allowed with physician order + care plan
              </p>
              <ul className="space-y-1.5 text-sm text-slate">
                {[
                  "Supplemental oxygen",
                  "Insulin and injectable medications",
                  "Indwelling or intermittent catheters",
                  "Colostomy / ileostomy",
                  "Stage 1 and Stage 2 pressure injuries",
                  "Wound care (non-complex)",
                  "Incontinence",
                  "Contractures",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate">
                Prohibited — facility must refuse or discharge
              </p>
              <ul className="space-y-1.5 text-sm text-slate">
                {[
                  "Stage 3 or Stage 4 pressure injuries",
                  "Feeding tubes (PEG, NG, or J-tube)",
                  "Tracheostomies",
                  "Active MRSA or communicable infections requiring isolation",
                  "24-hour skilled nursing needs",
                  "Total ADL dependence with inability to communicate needs",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-2">
                    <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-red-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <p className="mt-3 text-xs text-muted">
            A hospice waiver (HSC §1569.73) can allow continued care for
            residents on hospice who would otherwise fall into a prohibited
            category.
          </p>
          <TourCta>
            Ask whether your loved one&apos;s specific care needs are restricted
            or prohibited, and what the facility&apos;s process is if needs
            change after admission.
          </TourCta>
        </Card>
      ),
    },
    {
      id: "reporting",
      citedDate: reportingCited,
      node: (
        <Card
          key="reporting"
          question="What must this facility report to the state — and how fast?"
          icon={<IconReport />}
          cite="22 CCR §87211 / WIC §15630"
          citedDate={reportingCited}
        >
          <ul className="space-y-2.5 text-sm text-slate">
            {[
              {
                event: "Elopement, fire, epidemic outbreak, or poisoning",
                deadline: "Immediately",
                color: "text-red-600",
              },
              {
                event: "Abuse with serious bodily injury",
                deadline:
                  "2-hour phone report + 2-hour written report — to the California Department of Social Services (CDSS), Adult Protective Services, and law enforcement",
                color: "text-red-600",
              },
              {
                event: "Abuse without serious bodily injury",
                deadline: "Within 24 hours",
                color: "text-orange-600",
              },
              {
                event: "Death of a resident",
                deadline: "Phone by next working day; written within 7 days",
                color: "text-orange-600",
              },
              {
                event: "Injury requiring medical treatment beyond first aid",
                deadline: "Phone by next working day; written within 7 days",
                color: "text-slate",
              },
              {
                event:
                  "Bankruptcy, foreclosure, eviction, or utility shutoff notice",
                deadline:
                  "Written notice to CDSS and residents — $100/day penalty (max $2,000) for failure",
                color: "text-slate",
              },
            ].map(({ event, deadline, color }) => (
              <li key={event} className="flex items-start gap-3">
                <span
                  className={`mt-0.5 shrink-0 text-xs font-semibold ${color} w-20 text-right leading-snug`}
                >
                  {deadline.split(" ")[0] === "Immediately"
                    ? "Immediate"
                    : deadline.startsWith("2-hour")
                    ? "2 hours"
                    : deadline.startsWith("Within")
                    ? "24 hrs"
                    : deadline.startsWith("Phone")
                    ? "Next day"
                    : "Written"}
                </span>
                <span className="flex-1 leading-snug">
                  <strong className="text-ink">{event}</strong>
                  <span className="block text-xs text-muted">{deadline}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-3 rounded-md border border-sc-border/60 bg-sc-border/10 px-3 py-2">
            <p className="text-xs text-slate">
              <strong className="text-ink">Your enforcement lever:</strong> Incidents that aren&apos;t
              reported on time are themselves a separate violation. If you
              believe a reportable event wasn&apos;t filed, you can submit a
              complaint directly to the California Department of Social Services (CDSS).
            </p>
          </div>
        </Card>
      ),
    },
    {
      id: "enforce",
      citedDate: enforceCited,
      node: (
        <Card
          key="enforce"
          question="How does CDSS enforce these rules?"
          icon={<IconEnforce />}
          cite="22 CCR §87755–87777 / HSC §1569.58"
          citedDate={enforceCited}
        >
          <ol className="space-y-2 text-sm text-slate">
            {[
              {
                step: "Notice of Deficiency",
                detail:
                  "Written citation with a correction deadline. Facility must submit a Plan of Correction.",
              },
              {
                step: "Civil Penalty",
                detail:
                  "Starts at $50/day for non-serious; $150/day for serious deficiencies — immediately, with no grace period. Repeats escalate to $150 first day + $50/day, then $1,000 first day + $100/day.",
              },
              {
                step: "Suspension of Admissions",
                detail:
                  "Facility cannot accept new residents until violations are corrected.",
              },
              {
                step: "Temporary Suspension or Revocation",
                detail:
                  "Emergency suspension for imminent danger; full revocation after administrative hearing.",
              },
              {
                step: "Exclusion Order",
                detail:
                  "Administrator and operator can be barred from all CDSS-licensed facilities — not just this one.",
              },
            ].map(({ step, detail }, i) => (
              <li key={step} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-teal/10 text-[11px] font-bold text-teal">
                  {i + 1}
                </span>
                <span>
                  <strong className="text-ink">{step}</strong>
                  <span className="block text-xs text-muted leading-snug mt-0.5">
                    {detail}
                  </span>
                </span>
              </li>
            ))}
          </ol>
          <div className="mt-4 border-t border-sc-border/60 pt-4">
            <p className="text-sm text-slate">
              See how these rules have been applied to this specific facility:
            </p>
            <a
              href="#state-heading"
              className="mt-2 inline-flex items-center gap-1.5 text-sm font-semibold text-teal hover:underline underline-offset-2"
            >
              View state inspection record and citations
              <svg
                aria-hidden
                className="h-3.5 w-3.5"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 3a.75.75 0 01.75.75v10.638l3.96-4.158a.75.75 0 111.08 1.04l-5.25 5.5a.75.75 0 01-1.08 0l-5.25-5.5a.75.75 0 111.08-1.04l3.96 4.158V3.75A.75.75 0 0110 3z"
                  clipRule="evenodd"
                />
              </svg>
            </a>
          </div>
        </Card>
      ),
    },
  ];

  // Bubble cards with citations to the top; within each group keep original order.
  const sorted = [
    ...allCards.filter((c) => c.citedDate !== null),
    ...allCards.filter((c) => c.citedDate === null),
  ];

  return (
    <section aria-labelledby="reg-baseline-heading" className="mt-10">
      <h2
        id="reg-baseline-heading"
        className="font-[family-name:var(--font-serif)] text-2xl font-semibold text-navy"
      >
        The rules that apply to this facility
      </h2>
      <p className="mt-1 text-sm text-muted">
        California Title 22 requirements for this facility, with the specific
        regulation and a suggested question for each.
        {allCards.some((c) => c.citedDate) && (
          <span className="ml-1 text-amber-700 font-medium">
            Rules this facility has been cited for are shown first.
          </span>
        )}
      </p>

      <div className="mt-4 overflow-hidden rounded-lg border border-sc-border bg-white shadow-card">
        {sorted.map((c) => c.node)}
      </div>
    </section>
  );
}
