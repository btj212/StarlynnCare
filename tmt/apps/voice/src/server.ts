import websocket from "@fastify/websocket";
import {
  twilioHandoffWebhookSchema,
  twilioVoiceWebhookSchema,
  type Language,
} from "@tmt/contracts";
import Fastify, { type FastifyInstance } from "fastify";

import {
  languageForCalledNumber,
  relayWebSocketUrl,
  type VoiceConfig,
} from "./config.js";
import {
  InMemoryVoicePersistence,
  SupabaseVoicePersistence,
  type VoiceHandoffTrigger,
  type VoicePersistence,
} from "./persistence.js";
import { RelaySession } from "./relay/session.js";
import {
  hasValidTwilioSignature,
  parseTwilioForm,
  type TwilioForm,
} from "./signature.js";
import { buildConversationRelayTwiml, buildHandoffTwiml } from "./twiml.js";

export interface BuildVoiceAppOptions {
  readonly config: VoiceConfig;
  readonly logger?: boolean;
  readonly persistence?: VoicePersistence;
}

interface HandoffData {
  readonly idempotencyKey?: string;
  readonly reason?: string;
  readonly trigger?: VoiceHandoffTrigger;
}

const HANDOFF_TRIGGERS = new Set<VoiceHandoffTrigger>([
  "dtmf_zero",
  "spoken_request",
  "agent_escalation",
  "session_end",
  "system_error",
]);

function createPersistence(config: VoiceConfig): VoicePersistence {
  if (
    config.supabaseUrl !== undefined &&
    config.supabaseServiceRoleKey !== undefined
  ) {
    return new SupabaseVoicePersistence(
      config.supabaseUrl,
      config.supabaseServiceRoleKey,
    );
  }
  if (
    config.supabaseUrl !== undefined ||
    config.supabaseServiceRoleKey !== undefined
  ) {
    throw new Error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured together",
    );
  }
  if (process.env["NODE_ENV"] === "test") {
    return new InMemoryVoicePersistence();
  }
  throw new Error("Voice persistence requires server-side Supabase credentials");
}

function signatureHeader(
  value: string | string[] | undefined,
): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function validateSignedForm(options: {
  readonly authToken: string;
  readonly body: unknown;
  readonly signature: string | undefined;
  readonly url: string;
}): TwilioForm | undefined {
  const form = parseTwilioForm(options.body);
  if (
    form === undefined ||
    !hasValidTwilioSignature({
      authToken: options.authToken,
      signature: options.signature,
      url: options.url,
      params: form,
    })
  ) {
    return undefined;
  }
  return form;
}

function parseHandoffData(value: string | undefined): HandoffData {
  if (value === undefined) {
    return {};
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const data = parsed as Record<string, unknown>;
    return {
      ...(typeof data["idempotencyKey"] === "string"
        ? { idempotencyKey: data["idempotencyKey"] }
        : {}),
      ...(typeof data["reason"] === "string"
        ? { reason: data["reason"] }
        : {}),
      ...(typeof data["trigger"] === "string" &&
      HANDOFF_TRIGGERS.has(data["trigger"] as VoiceHandoffTrigger)
        ? { trigger: data["trigger"] as VoiceHandoffTrigger }
        : {}),
    };
  } catch {
    return {};
  }
}

function handoffLanguage(
  language: Language | undefined,
): Language {
  return language ?? "en";
}

function relayMessageText(
  data: Buffer | ArrayBuffer | Buffer[],
): string {
  if (Array.isArray(data)) {
    return Buffer.concat(data).toString("utf8");
  }
  if (data instanceof ArrayBuffer) {
    return Buffer.from(new Uint8Array(data)).toString("utf8");
  }
  return data.toString("utf8");
}

export async function buildVoiceApp(
  options: BuildVoiceAppOptions,
): Promise<FastifyInstance> {
  const { config } = options;
  const persistence = options.persistence ?? createPersistence(config);
  const app = Fastify({ logger: options.logger ?? true });

  app.addContentTypeParser(
    "application/x-www-form-urlencoded",
    { parseAs: "string" },
    (_request, body, done) => {
      done(null, Object.fromEntries(new URLSearchParams(body.toString())));
    },
  );
  await app.register(websocket);

  app.get("/status", () => ({ ok: true, service: "tmt-voice" }));

  app.post("/twilio/voice", async (request, reply) => {
    const form = validateSignedForm({
      authToken: config.twilioAuthToken,
      body: request.body,
      signature: signatureHeader(request.headers["x-twilio-signature"]),
      url: `${config.publicBaseUrl}/twilio/voice`,
    });
    if (form === undefined) {
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }

    const parsed = twilioVoiceWebhookSchema.safeParse(form);
    if (
      !parsed.success ||
      parsed.data.AccountSid !== config.twilioAccountSid
    ) {
      return reply.code(400).send({ error: "Invalid Twilio voice webhook" });
    }
    const language = languageForCalledNumber(
      parsed.data.To,
      config.numbersByLanguage,
    );
    if (language === undefined) {
      return reply.code(400).send({ error: "Unknown called number" });
    }

    const call = await persistence.upsertCall({
      twilioCallSid: parsed.data.CallSid,
      fromE164: parsed.data.From,
      toE164: parsed.data.To,
      language,
      recordingNoticePlayed: config.recordingEnabled,
    });
    const twiml = buildConversationRelayTwiml({
      actionUrl: `${config.publicBaseUrl}/twilio/handoff`,
      callId: call.id,
      language,
      recordingEnabled: config.recordingEnabled,
      relayUrl: relayWebSocketUrl(config.publicBaseUrl),
    });
    return reply.type("text/xml").send(twiml);
  });

  app.post("/twilio/handoff", async (request, reply) => {
    const form = validateSignedForm({
      authToken: config.twilioAuthToken,
      body: request.body,
      signature: signatureHeader(request.headers["x-twilio-signature"]),
      url: `${config.publicBaseUrl}/twilio/handoff`,
    });
    if (form === undefined) {
      return reply.code(403).send({ error: "Invalid Twilio signature" });
    }

    const parsed = twilioHandoffWebhookSchema.safeParse(form);
    if (
      !parsed.success ||
      parsed.data.AccountSid !== config.twilioAccountSid
    ) {
      return reply.code(400).send({ error: "Invalid Twilio handoff webhook" });
    }
    const call = await persistence.findCallBySid(parsed.data.CallSid);
    if (call === undefined) {
      return reply.code(404).send({ error: "Call not found" });
    }

    const handoffData = parseHandoffData(parsed.data.HandoffData);
    const trigger =
      handoffData.trigger ??
      (parsed.data.Digits?.includes("0") === true
        ? "dtmf_zero"
        : parsed.data.ErrorCode === undefined
          ? "session_end"
          : "system_error");
    const reason =
      handoffData.reason ??
      (trigger === "dtmf_zero"
        ? "Caller pressed 0"
        : trigger === "system_error"
          ? `ConversationRelay error ${parsed.data.ErrorCode ?? "unknown"}`
          : "ConversationRelay session ended");
    const idempotencyKey =
      handoffData.idempotencyKey ??
      `${parsed.data.CallSid}:${trigger}:${parsed.data.SessionStatus ?? "callback"}`;

    await persistence.recordHandoff({
      callId: call.id,
      idempotencyKey,
      trigger,
      reason,
      targetE164: config.onCallFallbackE164,
    });
    await persistence.updateCall(call.id, {
      status: "handoff_in_progress",
      handoffReason: reason,
    });

    return reply.type("text/xml").send(
      buildHandoffTwiml({
        language: handoffLanguage(call.language),
        targetE164: config.onCallFallbackE164,
      }),
    );
  });

  app.get("/relay", { websocket: true }, (socket, request) => {
    const session = new RelaySession({
      socket,
      persistence,
      onCallFallbackE164: config.onCallFallbackE164,
      onError: (error) => {
        request.log.error({ err: error }, "ConversationRelay session failed");
      },
    });
    let eventQueue = Promise.resolve();
    socket.on("message", (data: Buffer | ArrayBuffer | Buffer[]) => {
      eventQueue = eventQueue.then(() =>
        session.handleRawMessage(relayMessageText(data)),
      );
    });
    socket.on("error", () => {
      eventQueue = eventQueue.then(() => session.handleTransportError());
    });
    socket.on("close", () => {
      eventQueue = eventQueue.then(() => session.handleClose());
    });
  });

  return app;
}
