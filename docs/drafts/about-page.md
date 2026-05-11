<!-- Q5 CONFIRMED: All 5 states live; TX data pipeline still maturing. Language updated accordingly. -->

# About StarlynnCare — Draft for human review
> **STATUS: DRAFT — not published. Requires Blake's approval before any changes go live.**
> Word count target: 1,000–1,200. Current estimate: ~1,100 words.
> Questions for Blake listed at the bottom.

---

## Why this got built

The first time you tour a memory care facility, you are already behind. The marketing materials are professional. The lobby smells like fresh flowers. The admissions coordinator knows exactly how long to make eye contact. And the state inspection record — the document where a regulator walked those same halls and wrote down what they found — is buried on a government portal in a format that assumes you know what a Type-A deficiency is.

Most families don't. Most families are calling facilities the same week a neurologist uses the word "placement." There is no runway. There is no research team. There is one person — usually a daughter or a spouse — Googling at midnight and clicking through paid directories where the top results are whoever wrote the largest referral check that month.

StarlynnCare exists because that information gap is not a technical problem. California's Department of Social Services publishes every inspection narrative, every deficiency classification, and every complaint outcome for licensed residential care facilities for the elderly. Texas publishes its HHSC inspection records. Oregon, Washington, and Minnesota each maintain their own licensing portals. The data is public. It was never assembled into something a family in crisis could read in twenty minutes and act on.

## What we actually do

The technical core is a data pipeline that ingests state inspection exports and normalizes them into facility profiles. For California, that means pulling directly from CDSS Community Care Licensing — license numbers, facility characteristics, deficiency narratives, and complaint outcomes, matched to facilities by their official CDSS license identifier. Texas records come from HHSC's Long-Term Care licensing system. Oregon runs through DHS, Washington through DSHS, Minnesota through MDH. Each regulator uses different severity classifications and different inspection frequencies; the profiles explain those differences in plain language so a family comparing a California RCFE to a Texas ALF doesn't mistake the terminology for the quality signal.

Facility grades are derived from peer comparison within each state, not across states. A grade reflects how a facility's citation history compares to similarly-licensed facilities in the same regulatory environment — not against a national average that would obscure what California's inspection frequency actually looks like relative to Minnesota's. The methodology is published and linkable. Discharge planners and geriatric care managers are welcome to cite StarlynnCare profiles directly in placement packets; the license numbers link straight to the originating regulator portal whenever families want to verify the primary source.

## What we don't do

StarlynnCare takes no referral commissions, lead bonuses, or paid placement fees from facility operators. No facility can purchase a higher grade, a featured listing, or adjacency to the top of any search result on this site. That is not a marketing claim — it is a structural constraint. Referral fees create the exact conflict that motivated building this in the first place: a directory paid by operators cannot tell families which operators fail inspections. If that policy ever changes, this page will say so before any contract is signed.

## The people behind it

Rebecca Lynn Starkey — friends call her Star — is a registered nurse whose career spans older adult primary care, public health case management, and regulatory survey work in California. That last category is the relevant one here: she has walked into facilities after complaints, reviewed records, interviewed staff, and seen firsthand whether cited deficiencies were being fixed or being reframed. Her California RN license (Board of Registered Nursing #95100373, verifiable at search.dca.ca.gov) is the credential that anchors StarlynnCare's clinical review chain. Every guide, every glossary entry, and every tour question on this site passes through Star's review before it publishes.

What she saw in that work was a pattern: the same facilities appeared on repeat. The same classes of deficiency — medication errors, staffing shortfalls, inadequate dementia programming — kept showing up under new administration names or after a round of cosmetic renovations. Families making placement decisions had no systematic way to see that history. Paid review sites, referral aggregators, and facility marketing filled the void with content that served operators. Star decided to build something that served families.

Blake Jones leads the publishing stack — the ingestion scripts, the normalization layer, the data pipeline that turns raw CDSS and HHSC exports into the structured facility profiles on this site. His background is brand strategy and operations; he is currently an MBA candidate at UC Berkeley Haas, where his concentration is Social Impact. He is also Star's husband, which is how this project started: a conversation about why the families she was trying to help kept making decisions without the information she already had access to.

The site launched in California in 2025 and has been rolling out state by state — Oregon, Washington, and Minnesota followed, with Texas expanding now as the data pipeline matures. Every new state requires a parity audit before profiles go live — a check that the underlying inspection data is complete, the severity classification is explained correctly for that state's regulatory framework, and the methodology page is updated before the first profile is indexed.

## Editorial independence

StarlynnCare's editorial decisions — which facilities appear, how they are graded, what the guides say — are made by the founders without operator input. Neither Blake nor Star holds equity in any licensed memory care operator reviewed on this site. No pending commercial relationships with operators exist. Future partnerships — research grants, foundation funding, or data licensing arrangements — will be disclosed on this page if they could materially influence how facilities are graded or ranked.

Errors happen. When primary regulatory records contradict something published on a facility profile, the correction goes up within five business days of verifiable notice. Substantive clinical changes to editorial guides carry an updated reviewer date and a note on what changed. The fastest path to a correction is hello@starlynncare.com with the facility's license number and a link to the primary source.

---

## Questions for Blake before publishing

1. ~~**Star's survey work geography:** Is the regulatory survey experience specifically in California?~~ **CONFIRMED: California only.** Copy scoped accordingly.
2. ~~**Blake's Haas program:** Any particular concentration?~~ **CONFIRMED: Social Impact concentration.** Updated in copy.
3. ~~**Founding year:** The schema has `foundingDate: "2024"` — is this accurate?~~ **CONFIRMED: 2025.** Updated in copy.
4. ~~**Star's RN license status:** Is license #95100373 current and active?~~ **CONFIRMED: current and active.** License remains in copy.
5. ~~**States live:** CA, OR, WA, MN, TX — any partial/soft launches to distinguish?~~ **CONFIRMED: All 5 live; TX data pipeline still maturing.** Copy framed as rolling rollout with TX actively expanding.
6. **Anything to add about Star's older adult primary care setting** — specific clinic context, or keep it general?
