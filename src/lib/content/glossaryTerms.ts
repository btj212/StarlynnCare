/**
 * California memory-care regulatory glossary — anchor `id` matches <dt id="…"> on /california/glossary.
 */

export type GlossaryTerm = {
  id: string;
  name: string;
  definition: string;
};

export type GlossaryCategory = {
  slug: string;
  title: string;
  terms: GlossaryTerm[];
};

export const CALIFORNIA_MEMORY_CARE_GLOSSARY: GlossaryCategory[] = [
  {
    slug: "license-regulator",
    title: "License & regulator",
    terms: [
      {
        id: "cdss",
        name: "CDSS (California Department of Social Services)",
        definition:
          "State agency that oversees Community Care Licensing (CCL) for residential care in California, including RCFEs that offer memory care.",
      },
      {
        id: "ccld",
        name: "CCLD / Community Care Licensing Division",
        definition:
          "The division within CDSS that licenses facilities, conducts inspections, investigates complaints, and publishes deficiency data families see on StarlynnCare.",
      },
      {
        id: "rcfe",
        name: "RCFE (Residential Care Facility for the Elderly)",
        definition:
          "California license category for non-medical residential care for adults 60+. Memory care is typically offered within an RCFE’s secured dementia-capable area or dedicated unit.",
      },
      {
        id: "license-number",
        name: "Facility license number",
        definition:
          "The unique identifier issued by CCLD (often called the “fac num”). It is the authoritative key for matching a facility to inspection reports and CDSS public records.",
      },
      {
        id: "care-category",
        name: "Care category (on a license)",
        definition:
          "How CDSS classifies the population and services a facility is approved to serve. Memory care may appear as dementia-specific programming within an RCFE license.",
      },
      {
        id: "bru-nursing-license",
        name: "California RN license (BRN)",
        definition:
          "Registered nurses in California are licensed by the Board of Registered Nursing. StarlynnCare’s clinical reviewer holds an active RN license verifiable through the DCA license lookup.",
      },
    ],
  },
  {
    slug: "inspection-enforcement",
    title: "Inspection & enforcement",
    terms: [
      {
        id: "inspection",
        name: "Routine inspection",
        definition:
          "A scheduled visit by CCLD licensing staff to evaluate regulatory compliance. Findings are documented as deficiencies and appear on the public record.",
      },
      {
        id: "complaint-investigation",
        name: "Complaint investigation",
        definition:
          "An inquiry opened after a report of suspected violation. Outcomes may include substantiated findings that appear alongside routine inspection history.",
      },
      {
        id: "type-a-deficiency",
        name: "Type A deficiency",
        definition:
          "A citation for a violation that presents an immediate risk to resident health, safety, or rights under California law. Requires prompt corrective action and carries the highest penalty tier.",
      },
      {
        id: "type-b-deficiency",
        name: "Type B deficiency",
        definition:
          "A regulatory violation that does not meet the immediate-risk threshold for Type A. Still a public record of noncompliance until corrected.",
      },
      {
        id: "cap",
        name: "Corrective action plan (CAP)",
        definition:
          "A facility’s written plan to fix cited violations, sometimes due within 48 hours for Type A situations. CAP acceptance does not erase the historical citation.",
      },
      {
        id: "civil-penalty",
        name: "Civil penalty",
        definition:
          "Monetary fines CCLD may impose for regulatory violations. Penalty schedules depend on violation class and history and are part of the enforcement record.",
      },
    ],
  },
  {
    slug: "memory-care-dementia",
    title: "Memory care & dementia",
    terms: [
      {
        id: "memory-care",
        name: "Memory care (market term)",
        definition:
          "Industry language for secured or specialized dementia care services—often higher staffing ratios, wander-management design, and dementia-trained caregivers. Regulatory definitions vary; always verify against the facility license and assessment.",
      },
      {
        id: "secured-perimeter",
        name: "Secured perimeter / egress controls",
        definition:
          "Physical and procedural protections to reduce unsafe wandering. California regulations reference secured settings for memory care units (e.g., relevant Title 22 expectations cited in inspections).",
      },
      {
        id: "behavioral-expression",
        name: "Behavioral expression",
        definition:
          "Non-pharmacologic framing for dementia-related behaviors (agitation, pacing, vocalization) that require skilled observation and care planning—not only medication response.",
      },
      {
        id: "care-plan",
        name: "Resident care plan",
        definition:
          "Documented plan for services, preferences, and risks. Inspectors check whether plans reflect current needs and required updates after changes in condition.",
      },
      {
        id: "med-pass",
        name: "Medication administration / assist",
        definition:
          "How RCFE staff store, document, and administer or assist with medications. Medication errors are a recurring inspection theme in dementia settings.",
      },
    ],
  },
  {
    slug: "financial-benefits",
    title: "Financial & benefits",
    terms: [
      {
        id: "base-rate",
        name: "Base monthly rate",
        definition:
          "The advertised rent-and-services bundle before level-of-care add-ons. Families should obtain itemized quotes because “starting at” rates rarely reflect assessed care needs.",
      },
      {
        id: "level-of-care-fee",
        name: "Level-of-care (LOC) fee",
        definition:
          "Monthly add-on tied to assessed points for ADLs, behaviors, or medication complexity. Often the largest driver of bill growth after move-in.",
      },
      {
        id: "medicare",
        name: "Medicare (typical limits)",
        definition:
          "Federal health insurance primarily covering acute medical episodes. It does not pay for long-term room and board in RCFE memory care, though it may cover short-term SNF after qualifying hospital stays or outpatient medical services.",
      },
      {
        id: "medi-cal",
        name: "Medi-Cal",
        definition:
          "California’s Medicaid program. Traditional Medi-Cal generally does not pay RCFE rent. Some benefits (e.g., certain waiver services in participating counties) may cover care components—not the apartment fee.",
      },
      {
        id: "alw",
        name: "Assisted Living Waiver (ALW)",
        definition:
          "A Medi-Cal waiver that may pay for specific services in participating assisted living settings and counties—subject to eligibility, enrollment caps, and facility participation. Not a blanket ‘Medi-Cal pays memory care rent’ program.",
      },
    ],
  },
  {
    slug: "care-delivery-adjacent",
    title: "Care delivery & adjacent settings",
    terms: [
      {
        id: "adl",
        name: "ADLs (activities of daily living)",
        definition:
          "Core self-care tasks such as bathing, dressing, toileting, transferring, and eating. Assessments translate ADL needs into care hours and level-of-care tiers.",
      },
      {
        id: "iadl",
        name: "IADLs (instrumental ADLs)",
        definition:
          "Higher-order tasks like managing medications, finances, or transportation. Loss of IADLs often precedes full ADL dependence in dementia progression.",
      },
      {
        id: "snf",
        name: "SNF (skilled nursing facility)",
        definition:
          "Medicare-certified nursing home setting regulated differently from RCFEs. Some families transition between RCFE memory care and SNF for medical crises—coverage rules differ sharply.",
      },
      {
        id: "hospice",
        name: "Hospice",
        definition:
          "Benefit-focused end-of-life care emphasizing comfort. Coordination between RCFE memory care and hospice involves distinct staffing and billing rules.",
      },
      {
        id: "ombudsman",
        name: "Long-Term Care Ombudsman",
        definition:
          "Advocate program for residents of long-term care settings. Families can contact the local ombudsman for complaint navigation and resident rights support.",
      },
    ],
  },
];
