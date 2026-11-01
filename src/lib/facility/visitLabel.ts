/**
 * Visit labels for the inspection record.
 * A facility-reported incident is not an annual compliance visit.
 * States that only store "inspection" or "routine" keep the annual label.
 */
const SPECIFIC_VISIT_LABELS: Record<string, string> = {
  facility_reported_incident: "Facility-reported incident",
  desk_audit: "Desk audit",
  initial: "Initial licensing visit",
  special: "Special survey",
  focused: "Focused visit",
  "follow-up": "Follow-up visit",
  follow_up: "Follow-up visit",
  monitoring: "Monitoring visit",
};

export function visitKindLabel(insp: {
  is_complaint: boolean;
  inspection_type: string | null;
}): string {
  if (insp.is_complaint) return "Complaint Investigation";
  const key = (insp.inspection_type ?? "").trim().toLowerCase();
  if (key === "other") return "Other Visit";
  return SPECIFIC_VISIT_LABELS[key] ?? "Annual Compliance Visit";
}
