import { describe, expect, it } from "vitest";

import {
  callSchema,
  consentKindSchema,
  consentSchema,
  conversationRelayEventSchema,
  escalationSchema,
  handoffSchema,
  twilioVoiceWebhookSchema,
  utteranceSchema,
} from "./index.js";

const uuid = "11111111-1111-4111-8111-111111111111";
const timestamp = "2026-11-01T19:00:00.000Z";
const callSid = `CA${"a".repeat(32)}`;
const accountSid = `AC${"b".repeat(32)}`;

describe("external voice contracts", () => {
  it("accepts required Twilio fields while preserving future string fields", () => {
    const result = twilioVoiceWebhookSchema.safeParse({
      CallSid: callSid,
      AccountSid: accountSid,
      From: "+12095550101",
      To: "+16615550102",
      CallStatus: "ringing",
      Direction: "inbound",
      ApiVersion: "2010-04-01",
      CallerCity: "Fresno",
    });

    expect(result.success).toBe(true);
  });

  it("rejects malformed Twilio and ConversationRelay input", () => {
    expect(
      twilioVoiceWebhookSchema.safeParse({
        CallSid: "not-a-call-sid",
        AccountSid: accountSid,
        From: "+12095550101",
        To: "+16615550102",
        CallStatus: "invented",
        Direction: "inbound",
        ApiVersion: "2010-04-01",
      }).success,
    ).toBe(false);

    expect(
      conversationRelayEventSchema.safeParse({
        type: "dtmf",
        digit: "A",
      }).success,
    ).toBe(false);

    expect(
      conversationRelayEventSchema.safeParse({
        type: "prompt",
        voicePrompt: "",
        lang: "pa-IN",
        last: true,
        unexpected: "unsafe",
      }).success,
    ).toBe(false);
  });
});

describe("operational contracts", () => {
  it("supports auditable callback consent", () => {
    expect(consentKindSchema.parse("callback")).toBe("callback");
    expect(
      consentSchema.parse({
        id: uuid,
        callId: uuid,
        subjectType: "caller",
        subjectId: uuid,
        kind: "callback",
        granted: true,
        source: "voice",
        evidence: { utterance_id: uuid },
        createdAt: timestamp,
        revokedAt: null,
      }).kind,
    ).toBe("callback");
  });

  it("rejects malformed calls, utterances, consent, and handoffs", () => {
    expect(
      callSchema.safeParse({
        id: uuid,
        callerId: null,
        providerId: null,
        twilioCallSid: callSid,
        direction: "inbound",
        status: "in_progress",
        fromE164: "209-555-0101",
        toE164: "+16615550102",
        language: "pa",
        startedAt: timestamp,
        endedAt: null,
        recordingNoticePlayed: false,
        recordingPath: null,
        aiSeconds: -1,
        humanSeconds: 0,
        handoffReason: null,
      }).success,
    ).toBe(false);

    expect(
      utteranceSchema.safeParse({
        id: uuid,
        callId: uuid,
        externalEventId: null,
        sequenceNumber: 0,
        speaker: "caller",
        language: "pa",
        textOriginal: "",
        textEn: null,
        confidence: 1.2,
        isFinal: true,
        interrupted: false,
        startedAt: timestamp,
        endedAt: null,
      }).success,
    ).toBe(false);

    expect(
      consentSchema.safeParse({
        id: uuid,
        callId: null,
        subjectType: "caller",
        subjectId: uuid,
        kind: "callback",
        granted: true,
        source: "",
        evidence: {},
        createdAt: timestamp,
        revokedAt: null,
      }).success,
    ).toBe(false);

    expect(
      handoffSchema.safeParse({
        id: uuid,
        callId: uuid,
        idempotencyKey: "",
        trigger: "dtmf_zero",
        status: "connected",
        reason: "caller request",
        targetE164: "not-a-phone",
        requestedAt: timestamp,
        attemptedAt: null,
        connectedAt: null,
        completedAt: null,
        failureCode: null,
      }).success,
    ).toBe(false);

    expect(
      escalationSchema.safeParse({
        id: uuid,
        callId: uuid,
        reason: "safety",
        priority: "p1",
        status: "resolved",
        assignedTo: null,
        createdAt: timestamp,
        resolvedAt: null,
        resolutionNote: null,
      }).success,
    ).toBe(false);
  });
});
