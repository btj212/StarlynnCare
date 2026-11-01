import { z } from "zod";

const relaySidSchema = z.string().min(1).max(64);

const relaySetupEventSchema = z
  .object({
    type: z.literal("setup"),
    sessionId: relaySidSchema,
    callSid: z.string().regex(/^CA[a-fA-F0-9]{32}$/),
    parentCallSid: z
      .union([z.string().regex(/^CA[a-fA-F0-9]{32}$/), z.literal("")])
      .nullable(),
    from: z.string().min(1),
    to: z.string().min(1),
    forwardedFrom: z.string().nullable(),
    callerName: z.string().nullable(),
    direction: z.enum(["inbound", "outbound"]),
    callType: z.string().min(1),
    callStatus: z.string().min(1),
    accountSid: z.string().regex(/^AC[a-fA-F0-9]{32}$/),
    customParameters: z.record(z.string(), z.string()),
  })
  .strict();

const relayPromptEventSchema = z
  .object({
    type: z.literal("prompt"),
    voicePrompt: z.string().min(1),
    lang: z.string().min(2),
    last: z.boolean(),
  })
  .strict();

const relayInterruptEventSchema = z
  .object({
    type: z.literal("interrupt"),
    utteranceUntilInterrupt: z.string(),
    durationUntilInterruptMs: z.number().nonnegative(),
  })
  .strict();

const relayDtmfEventSchema = z
  .object({
    type: z.literal("dtmf"),
    digit: z.enum(["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "*", "#"]),
  })
  .strict();

const relayEndEventSchema = z
  .object({
    type: z.literal("end"),
    reason: z.string().min(1).nullable().optional(),
  })
  .strict();

const relayErrorEventSchema = z
  .object({
    type: z.literal("error"),
    description: z.string().min(1),
  })
  .strict();

export const conversationRelayEventSchema = z.discriminatedUnion("type", [
  relaySetupEventSchema,
  relayPromptEventSchema,
  relayInterruptEventSchema,
  relayDtmfEventSchema,
  relayEndEventSchema,
  relayErrorEventSchema,
]);

export type ConversationRelayEvent = z.infer<
  typeof conversationRelayEventSchema
>;

export const conversationRelayTextMessageSchema = z
  .object({
    type: z.literal("text"),
    token: z.string(),
    last: z.boolean(),
    lang: z.string().min(2).optional(),
    interruptible: z.boolean().optional(),
    preemptible: z.boolean().optional(),
  })
  .strict();

export const conversationRelayEndMessageSchema = z
  .object({
    type: z.literal("end"),
    handoffData: z.string().max(4096).optional(),
  })
  .strict();

export type ConversationRelayEndMessage = z.infer<
  typeof conversationRelayEndMessageSchema
>;
export type ConversationRelayTextMessage = z.infer<
  typeof conversationRelayTextMessageSchema
>;
