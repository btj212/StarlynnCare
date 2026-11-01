export const OPS_REALTIME_TABLES = [
  "calls",
  "utterances",
  "consents",
  "handoff_events",
  "escalations",
] as const;

export type OpsRealtimeTable = (typeof OPS_REALTIME_TABLES)[number];

export const OPS_REALTIME_EVENT = "*" as const;
export const OPS_REALTIME_SCHEMA = "public" as const;
