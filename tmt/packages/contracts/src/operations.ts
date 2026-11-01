import { z } from "zod";

export const uuidSchema = z.uuid();
export const timestampSchema = z.iso.datetime({ offset: true });
export const e164Schema = z.string().regex(/^\+[1-9]\d{7,14}$/, "Expected E.164");

export const languageSchema = z.enum(["en", "pa", "hi", "es"]);
export const staffRoleSchema = z.enum(["dispatcher", "admin"]);
export const callDirectionSchema = z.enum(["inbound", "outbound"]);
export const callStatusSchema = z.enum([
  "queued",
  "ringing",
  "in_progress",
  "handoff_requested",
  "handoff_in_progress",
  "completed",
  "failed",
]);
export const utteranceSpeakerSchema = z.enum([
  "caller",
  "agent",
  "dispatcher",
  "provider",
]);
export const consentKindSchema = z.enum([
  "sms",
  "whatsapp",
  "callback",
  "ai_outbound_calls",
  "recording",
  "terms",
  "data_for_quality",
]);
export const consentSubjectTypeSchema = z.enum([
  "caller",
  "provider",
  "staff",
]);
export const handoffTriggerSchema = z.enum([
  "dtmf_zero",
  "spoken_request",
  "agent_escalation",
  "session_end",
  "system_error",
]);
export const handoffStatusSchema = z.enum([
  "requested",
  "attempted",
  "connected",
  "failed",
  "callback_queued",
  "cancelled",
]);
export const escalationPrioritySchema = z.enum(["p1", "p2", "p3"]);
export const escalationStatusSchema = z.enum([
  "open",
  "acknowledged",
  "resolved",
]);

export const callSchema = z
  .object({
    id: uuidSchema,
    callerId: uuidSchema.nullable(),
    providerId: uuidSchema.nullable(),
    twilioCallSid: z.string().regex(/^CA[a-fA-F0-9]{32}$/),
    direction: callDirectionSchema,
    status: callStatusSchema,
    fromE164: e164Schema,
    toE164: e164Schema,
    language: languageSchema,
    startedAt: timestampSchema,
    endedAt: timestampSchema.nullable(),
    recordingNoticePlayed: z.boolean(),
    recordingPath: z.string().min(1).nullable(),
    aiSeconds: z.number().int().nonnegative(),
    humanSeconds: z.number().int().nonnegative(),
    handoffReason: z.string().min(1).nullable(),
  })
  .strict();

export const utteranceSchema = z
  .object({
    id: uuidSchema,
    callId: uuidSchema,
    externalEventId: z.string().min(1).nullable(),
    sequenceNumber: z.number().int().nonnegative(),
    speaker: utteranceSpeakerSchema,
    language: languageSchema,
    textOriginal: z.string().min(1),
    textEn: z.string().min(1).nullable(),
    confidence: z.number().min(0).max(1).nullable(),
    isFinal: z.boolean(),
    interrupted: z.boolean(),
    startedAt: timestampSchema,
    endedAt: timestampSchema.nullable(),
  })
  .strict();

export const consentSchema = z
  .object({
    id: uuidSchema,
    callId: uuidSchema.nullable(),
    subjectType: consentSubjectTypeSchema,
    subjectId: uuidSchema,
    kind: consentKindSchema,
    granted: z.boolean(),
    source: z.string().min(1),
    evidence: z.record(z.string(), z.unknown()),
    createdAt: timestampSchema,
    revokedAt: timestampSchema.nullable(),
  })
  .strict();

export const handoffSchema = z
  .object({
    id: uuidSchema,
    callId: uuidSchema,
    idempotencyKey: z.string().min(1).max(255),
    trigger: handoffTriggerSchema,
    status: handoffStatusSchema,
    reason: z.string().min(1),
    targetE164: e164Schema.nullable(),
    requestedAt: timestampSchema,
    attemptedAt: timestampSchema.nullable(),
    connectedAt: timestampSchema.nullable(),
    completedAt: timestampSchema.nullable(),
    failureCode: z.string().min(1).nullable(),
  })
  .strict();

export const escalationSchema = z
  .object({
    id: uuidSchema,
    callId: uuidSchema.nullable(),
    reason: z.string().min(1),
    priority: escalationPrioritySchema,
    status: escalationStatusSchema,
    assignedTo: uuidSchema.nullable(),
    createdAt: timestampSchema,
    resolvedAt: timestampSchema.nullable(),
    resolutionNote: z.string().min(1).nullable(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.status === "resolved" && value.resolvedAt === null) {
      context.addIssue({
        code: "custom",
        message: "Resolved escalations require resolvedAt",
        path: ["resolvedAt"],
      });
    }
    if (value.status !== "resolved" && value.resolvedAt !== null) {
      context.addIssue({
        code: "custom",
        message: "Open escalations cannot have resolvedAt",
        path: ["resolvedAt"],
      });
    }
  });

export type Call = z.infer<typeof callSchema>;
export type Consent = z.infer<typeof consentSchema>;
export type ConsentKind = z.infer<typeof consentKindSchema>;
export type Escalation = z.infer<typeof escalationSchema>;
export type Handoff = z.infer<typeof handoffSchema>;
export type Language = z.infer<typeof languageSchema>;
export type Utterance = z.infer<typeof utteranceSchema>;
