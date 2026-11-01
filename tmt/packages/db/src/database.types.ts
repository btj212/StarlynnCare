// Schema-derived Supabase client types. Regenerate after applying migrations:
// pnpm dlx supabase gen types typescript --local > packages/db/src/database.types.ts

export type Json =
  | boolean
  | number
  | string
  | null
  | Json[]
  | { [key: string]: Json | undefined };

export type LangCode = "en" | "pa" | "hi" | "es";
export type StaffRole = "dispatcher" | "admin";
export type ServiceCategory =
  | "towing"
  | "mechanic"
  | "tires"
  | "roadside_assistance"
  | "diagnostics"
  | "mobile_repair";
export type ProviderStatus = "active" | "paused" | "removed";
export type CallDirection = "inbound" | "outbound";
export type CallStatus =
  | "queued"
  | "ringing"
  | "in_progress"
  | "handoff_requested"
  | "handoff_in_progress"
  | "completed"
  | "failed";
export type UtteranceSpeaker =
  | "caller"
  | "agent"
  | "dispatcher"
  | "provider";
export type ConsentSubjectType = "caller" | "provider" | "staff";
export type ConsentKind =
  | "sms"
  | "whatsapp"
  | "callback"
  | "ai_outbound_calls"
  | "recording"
  | "terms"
  | "data_for_quality";
export type HandoffTrigger =
  | "dtmf_zero"
  | "spoken_request"
  | "agent_escalation"
  | "session_end"
  | "system_error";
export type HandoffStatus =
  | "requested"
  | "attempted"
  | "connected"
  | "failed"
  | "callback_queued"
  | "cancelled";
export type EscalationPriority = "p1" | "p2" | "p3";
export type EscalationStatus = "open" | "acknowledged" | "resolved";

type RecordShape<Value> = { [Key in keyof Value]: Value[Key] };

type TableDefinition<Row, Insert, Update = Partial<Insert>> = {
  Row: RecordShape<Row>;
  Insert: RecordShape<Insert>;
  Update: RecordShape<Update>;
  Relationships: [];
};

export interface ProfileRow {
  id: string;
  role: StaffRole;
  display_name: string;
  languages: LangCode[];
  phone_e164: string | null;
  on_call: boolean;
  created_at: string;
  updated_at: string;
}

export interface CallerRow {
  id: string;
  phone_e164: string;
  display_name: string | null;
  preferred_language: LangCode;
  created_at: string;
  last_seen_at: string | null;
}

export interface ProviderRow {
  id: string;
  business_name: string;
  contact_name: string | null;
  phone_e164: string;
  languages: LangCode[];
  categories: ServiceCategory[];
  status: ProviderStatus;
  created_at: string;
  updated_at: string;
}

export interface CallRow {
  id: string;
  caller_id: string | null;
  provider_id: string | null;
  twilio_call_sid: string;
  direction: CallDirection;
  status: CallStatus;
  from_e164: string;
  to_e164: string;
  language: LangCode;
  started_at: string;
  ended_at: string | null;
  recording_notice_played: boolean;
  recording_path: string | null;
  ai_seconds: number;
  human_seconds: number;
  handoff_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface UtteranceRow {
  id: string;
  call_id: string;
  external_event_id: string | null;
  sequence_number: number;
  speaker: UtteranceSpeaker;
  lang: LangCode;
  text_original: string;
  text_en: string | null;
  confidence: number | null;
  is_final: boolean;
  interrupted: boolean;
  started_at: string;
  ended_at: string | null;
  created_at: string;
}

export interface ConsentRow {
  id: string;
  call_id: string | null;
  subject_type: ConsentSubjectType;
  subject_id: string;
  kind: ConsentKind;
  granted: boolean;
  source: string;
  evidence: Json;
  created_at: string;
  revoked_at: string | null;
}

export interface HandoffEventRow {
  id: string;
  call_id: string;
  idempotency_key: string;
  trigger: HandoffTrigger;
  status: HandoffStatus;
  reason: string;
  target_e164: string | null;
  requested_at: string;
  attempted_at: string | null;
  connected_at: string | null;
  completed_at: string | null;
  failure_code: string | null;
  created_at: string;
}

export interface EscalationRow {
  id: string;
  call_id: string | null;
  reason: string;
  priority: EscalationPriority;
  status: EscalationStatus;
  assigned_to: string | null;
  created_at: string;
  resolved_at: string | null;
  resolution_note: string | null;
}

export interface Database {
  public: {
    Tables: {
      profiles: TableDefinition<
        ProfileRow,
        {
          id: string;
          role: StaffRole;
          display_name: string;
          languages?: LangCode[];
          phone_e164?: string | null;
          on_call?: boolean;
          created_at?: string;
          updated_at?: string;
        }
      >;
      callers: TableDefinition<
        CallerRow,
        {
          id?: string;
          phone_e164: string;
          display_name?: string | null;
          preferred_language?: LangCode;
          created_at?: string;
          last_seen_at?: string | null;
        }
      >;
      providers: TableDefinition<
        ProviderRow,
        {
          id?: string;
          business_name: string;
          contact_name?: string | null;
          phone_e164: string;
          languages?: LangCode[];
          categories: ServiceCategory[];
          status?: ProviderStatus;
          created_at?: string;
          updated_at?: string;
        }
      >;
      calls: TableDefinition<
        CallRow,
        {
          id?: string;
          caller_id?: string | null;
          provider_id?: string | null;
          twilio_call_sid: string;
          direction: CallDirection;
          status?: CallStatus;
          from_e164: string;
          to_e164: string;
          language: LangCode;
          started_at?: string;
          ended_at?: string | null;
          recording_notice_played?: boolean;
          recording_path?: string | null;
          ai_seconds?: number;
          human_seconds?: number;
          handoff_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        }
      >;
      utterances: TableDefinition<
        UtteranceRow,
        {
          id?: string;
          call_id: string;
          external_event_id?: string | null;
          sequence_number: number;
          speaker: UtteranceSpeaker;
          lang: LangCode;
          text_original: string;
          text_en?: string | null;
          confidence?: number | null;
          is_final?: boolean;
          interrupted?: boolean;
          started_at: string;
          ended_at?: string | null;
          created_at?: string;
        }
      >;
      consents: TableDefinition<
        ConsentRow,
        {
          id?: string;
          call_id?: string | null;
          subject_type: ConsentSubjectType;
          subject_id: string;
          kind: ConsentKind;
          granted: boolean;
          source: string;
          evidence?: Json;
          created_at?: string;
          revoked_at?: string | null;
        }
      >;
      handoff_events: TableDefinition<
        HandoffEventRow,
        {
          id?: string;
          call_id: string;
          idempotency_key: string;
          trigger: HandoffTrigger;
          status: HandoffStatus;
          reason: string;
          target_e164?: string | null;
          requested_at?: string;
          attempted_at?: string | null;
          connected_at?: string | null;
          completed_at?: string | null;
          failure_code?: string | null;
          created_at?: string;
        }
      >;
      escalations: TableDefinition<
        EscalationRow,
        {
          id?: string;
          call_id?: string | null;
          reason: string;
          priority: EscalationPriority;
          status?: EscalationStatus;
          assigned_to?: string | null;
          created_at?: string;
          resolved_at?: string | null;
          resolution_note?: string | null;
        }
      >;
    };
    Views: Record<string, never>;
    Functions: {
      set_updated_at: {
        Args: Record<PropertyKey, never>;
        Returns: unknown;
      };
    };
    Enums: {
      lang_code: LangCode;
      staff_role: StaffRole;
      service_category: ServiceCategory;
      provider_status: ProviderStatus;
      call_direction: CallDirection;
      call_status: CallStatus;
      utterance_speaker: UtteranceSpeaker;
      consent_subject_type: ConsentSubjectType;
      consent_kind: ConsentKind;
      handoff_trigger: HandoffTrigger;
      handoff_status: HandoffStatus;
      escalation_priority: EscalationPriority;
      escalation_status: EscalationStatus;
    };
    CompositeTypes: Record<string, never>;
  };
}
