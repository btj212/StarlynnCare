import { z } from "zod";

const twilioCallSidSchema = z.string().regex(/^CA[a-fA-F0-9]{32}$/);
const twilioAccountSidSchema = z.string().regex(/^AC[a-fA-F0-9]{32}$/);
const twilioFormFieldSchema = z.union([z.string(), z.array(z.string())]);

export const twilioVoiceWebhookSchema = z
  .object({
    CallSid: twilioCallSidSchema,
    AccountSid: twilioAccountSidSchema,
    From: z.string().min(1),
    To: z.string().min(1),
    CallStatus: z.enum([
      "queued",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "failed",
      "no-answer",
      "canceled",
    ]),
    Direction: z.string().min(1),
    ApiVersion: z.string().min(1),
  })
  .catchall(twilioFormFieldSchema);

export const twilioStatusWebhookSchema = z
  .object({
    CallSid: twilioCallSidSchema,
    AccountSid: twilioAccountSidSchema,
    CallStatus: z.enum([
      "queued",
      "ringing",
      "in-progress",
      "completed",
      "busy",
      "failed",
      "no-answer",
      "canceled",
    ]),
    CallDuration: z.coerce.number().int().nonnegative().optional(),
    SipResponseCode: z.coerce.number().int().min(100).max(699).optional(),
  })
  .catchall(twilioFormFieldSchema);

export const twilioHandoffWebhookSchema = z
  .object({
    CallSid: twilioCallSidSchema,
    AccountSid: twilioAccountSidSchema,
    SessionStatus: z.string().min(1).optional(),
    HandoffData: z.string().max(4096).optional(),
    Digits: z.string().max(32).optional(),
    ErrorCode: z.string().max(32).optional(),
  })
  .catchall(twilioFormFieldSchema);

export type TwilioHandoffWebhook = z.infer<
  typeof twilioHandoffWebhookSchema
>;
export type TwilioStatusWebhook = z.infer<typeof twilioStatusWebhookSchema>;
export type TwilioVoiceWebhook = z.infer<typeof twilioVoiceWebhookSchema>;
