import type { UtteranceRow } from "@tmt/db";
import type { RawOpsSnapshot } from "./mapper";

export const FIXTURE_LIVE_UTTERANCE_DELAY_MS = 150;

export function fixtureLiveUtterance(): UtteranceRow {
  return {
    id: "00000000-0000-4000-8000-000000005004",
    call_id: "00000000-0000-4000-8000-000000004002",
    external_event_id: "fixture-relay-event-4",
    sequence_number: 2,
    speaker: "agent",
    lang: "es",
    text_original: "Actualización simulada del transcript en vivo.",
    text_en: "Mock live transcript update received.",
    confidence: null,
    is_final: true,
    interrupted: false,
    started_at: "2026-11-01T18:12:08Z",
    ended_at: "2026-11-01T18:12:09Z",
    created_at: "2026-11-01T18:12:09Z",
  };
}

export function fixtureOpsSnapshot(): RawOpsSnapshot {
  return {
    calls: [
      {
        id: "00000000-0000-4000-8000-000000004002",
        caller_id: "00000000-0000-4000-8000-000000002002",
        provider_id: null,
        twilio_call_sid: "CA22222222222222222222222222222222",
        direction: "inbound",
        status: "in_progress",
        from_e164: "+15595550111",
        to_e164: "+12095550131",
        language: "es",
        started_at: "2026-11-01T18:12:00Z",
        ended_at: null,
        recording_notice_played: false,
        recording_path: null,
        ai_seconds: 45,
        human_seconds: 0,
        handoff_reason: null,
        created_at: "2026-11-01T18:12:00Z",
        updated_at: "2026-11-01T18:12:00Z"
      },
      {
        id: "00000000-0000-4000-8000-000000004001",
        caller_id: "00000000-0000-4000-8000-000000002001",
        provider_id: null,
        twilio_call_sid: "CA11111111111111111111111111111111",
        direction: "inbound",
        status: "completed",
        from_e164: "+12095550110",
        to_e164: "+12095550130",
        language: "pa",
        started_at: "2026-11-01T18:10:00Z",
        ended_at: "2026-11-01T18:14:00Z",
        recording_notice_played: false,
        recording_path: null,
        ai_seconds: 180,
        human_seconds: 60,
        handoff_reason: "caller requested a dispatcher",
        created_at: "2026-11-01T18:10:00Z",
        updated_at: "2026-11-01T18:14:00Z"
      }
    ],
    utterances: [
      {
        id: "00000000-0000-4000-8000-000000005003",
        call_id: "00000000-0000-4000-8000-000000004002",
        external_event_id: "fixture-relay-event-3",
        sequence_number: 1,
        speaker: "caller",
        lang: "es",
        text_original:
          "Estoy fuera del camino y necesito ayuda con una llanta.",
        text_en: "I am off the road and need tire help.",
        confidence: 0.94,
        is_final: true,
        interrupted: false,
        started_at: "2026-11-01T18:12:03Z",
        ended_at: "2026-11-01T18:12:07Z",
        created_at: "2026-11-01T18:12:07Z"
      },
      {
        id: "00000000-0000-4000-8000-000000005001",
        call_id: "00000000-0000-4000-8000-000000004001",
        external_event_id: "fixture-relay-event-1",
        sequence_number: 1,
        speaker: "agent",
        lang: "pa",
        text_original: "ਸਤ ਸ੍ਰੀ ਅਕਾਲ ਜੀ। ਮੈਂ TMT ਦੀ AI ਡਿਸਪੈਚਰ ਹਾਂ।",
        text_en: "Hello. I am TMT's AI dispatcher.",
        confidence: null,
        is_final: true,
        interrupted: false,
        started_at: "2026-11-01T18:10:01Z",
        ended_at: "2026-11-01T18:10:04Z",
        created_at: "2026-11-01T18:10:04Z"
      },
      {
        id: "00000000-0000-4000-8000-000000005002",
        call_id: "00000000-0000-4000-8000-000000004001",
        external_event_id: "fixture-relay-event-2",
        sequence_number: 2,
        speaker: "caller",
        lang: "pa",
        text_original: "ਮੈਂ ਸੁਰੱਖਿਅਤ ਥਾਂ ਤੇ ਹਾਂ।",
        text_en: "I am in a safe place.",
        confidence: 0.96,
        is_final: true,
        interrupted: false,
        started_at: "2026-11-01T18:10:05Z",
        ended_at: "2026-11-01T18:10:08Z",
        created_at: "2026-11-01T18:10:08Z"
      }
    ],
    consents: [
      {
        id: "00000000-0000-4000-8000-000000006001",
        call_id: "00000000-0000-4000-8000-000000004001",
        subject_type: "caller",
        subject_id: "00000000-0000-4000-8000-000000002001",
        kind: "callback",
        granted: true,
        source: "voice",
        evidence: {
          fixture: true,
          utterance_id: "00000000-0000-4000-8000-000000005002"
        },
        created_at: "2026-11-01T18:10:09Z",
        revoked_at: null
      }
    ],
    handoffEvents: [
      {
        id: "00000000-0000-4000-8000-000000007001",
        call_id: "00000000-0000-4000-8000-000000004001",
        idempotency_key: "fixture-handoff-1",
        trigger: "dtmf_zero",
        status: "connected",
        reason: "caller requested a dispatcher",
        target_e164: "+12095550101",
        requested_at: "2026-11-01T18:13:00Z",
        attempted_at: "2026-11-01T18:13:01Z",
        connected_at: "2026-11-01T18:13:05Z",
        completed_at: "2026-11-01T18:14:00Z",
        failure_code: null,
        created_at: "2026-11-01T18:13:00Z"
      }
    ],
    escalations: [
      {
        id: "00000000-0000-4000-8000-000000008002",
        call_id: "00000000-0000-4000-8000-000000004002",
        reason: "Driver reports travel-lane exposure",
        priority: "p1",
        status: "open",
        assigned_to: null,
        created_at: "2026-11-01T18:12:08Z",
        resolved_at: null,
        resolution_note: null
      }
    ]
  };
}
