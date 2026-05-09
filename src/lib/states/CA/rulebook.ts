/**
 * California RCFE/ALF regulatory rulebook.
 *
 * Five cards ported from RegulatoryBaseline.tsx.
 * Each card's `codePattern` is tested against `deficiency.code` to surface
 * the amber "Cited <Mon YYYY>" pill when this facility has a matching citation.
 *
 * Sources: California Title 22 CCR, Health & Safety Code.
 */

import type { Rule } from "@/lib/states/profileConfig";

export const CA_RULEBOOK: Rule[] = [
  {
    id: "training",
    icon: "training",
    question: "What dementia-care training must staff complete?",
    regCite: "22 CCR §87705 / HSC §1569.625",
    plain:
      "Because a facility markets dementia or Alzheimer's care, state law mandates higher training standards: 12 hours of initial dementia training (6 hours before a staff member works independently with residents, 6 more within the first 4 weeks), 8 hours of annual dementia in-service every year thereafter, and an administrator must include 8 hours of dementia-specific continuing education in every 2-year recertification cycle. Training must cover individualized care plans, behavioral expressions, appropriate supervision, and the facility's dementia care philosophy.",
    ask: "Can you show me each direct-care staffer's most recent dementia training certificate, and tell me when their next refresher is due?",
    codePattern: /8770[56]/,
  },
  {
    id: "staffing",
    icon: "staff",
    question: "How many staff must be on duty overnight?",
    regCite: "22 CCR §87415",
    plain:
      "RCFEs must maintain awake staff at all times, with the ratio scaled to resident count and acuity. Facilities with 15 or fewer beds must have one qualified staff member on call and physically on premises at all times overnight. Facilities with 16–100 beds must have one awake caregiver on duty plus one on call who can respond within 10 minutes. Larger facilities add further staffing tiers per regulation. The facility's approved staffing plan is on file with CDSS and must be available on request.",
    ask: "How many awake staff are on the floor between 11 pm and 7 am, and where can I see your approved staffing plan?",
    codePattern: /87415/,
  },
  {
    id: "health",
    icon: "health",
    question: "What health conditions can this facility legally accept or refuse?",
    regCite: "22 CCR §87612–87615",
    plain:
      "RCFEs may accept residents with most chronic conditions, including supplemental oxygen, insulin and injectable medications, indwelling catheters, colostomy/ileostomy, Stage 1–2 pressure injuries, wound care, incontinence, and contractures — with a physician order and care plan. Prohibited conditions (facility must refuse or discharge): Stage 3–4 pressure injuries, feeding tubes, tracheostomies, active MRSA or communicable infections requiring isolation, 24-hour skilled nursing needs, and total ADL dependence with inability to communicate needs. A hospice waiver (HSC §1569.73) can allow continued care for residents on hospice who would otherwise fall into a prohibited category.",
    ask: "If my parent's condition changes, what triggers a transfer out — and how does the discharge process work?",
    codePattern: /8761[2-5]/,
  },
  {
    id: "reporting",
    icon: "report",
    question: "What must this facility report to the state — and how fast?",
    regCite: "22 CCR §87211 / WIC §15630",
    plain:
      "Elopements, fires, epidemic outbreaks, and poisonings must be reported immediately. Abuse with serious bodily injury requires a 2-hour phone report + 2-hour written report to CDSS, Adult Protective Services, and law enforcement. Abuse without serious bodily injury must be reported within 24 hours. A resident death requires a phone call by the next working day and a written report within 7 days. Injuries requiring medical treatment beyond first aid, and bankruptcy/foreclosure/utility shutoff notices, must also be reported. Incidents not reported on time are a separate violation — families may file a complaint directly with CDSS.",
    ask: "When was the last incident report filed with CDSS, and may I see your incident log summary for the past 12 months?",
    codePattern: /87211/,
  },
  {
    id: "enforce",
    icon: "enforce",
    question: "How does CDSS enforce these rules?",
    regCite: "22 CCR §87755–87777 / HSC §1569.58",
    plain:
      "Inspectors visit at least once every five years, plus on every complaint and every reportable incident. Findings are categorized Type A (actual or imminent risk of harm) or Type B (potential harm). Operators have 30 days to submit a plan of correction. Civil penalties start at $50/day for non-serious deficiencies; $150/day for serious ones — immediately, with no grace period. Repeat violations escalate: $150 first day + $50/day, then $1,000 first day + $100/day. CDSS can also suspend admissions or revoke the license entirely after a hearing.",
    ask: "Can I see your most recent plan of correction and the verification visit that closed it out?",
    codePattern: /877[6-7]\d/,
  },
];
