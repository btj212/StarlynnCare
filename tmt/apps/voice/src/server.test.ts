import type { Language } from "@tmt/contracts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getExpectedTwilioSignature } from "twilio";

import type { VoiceConfig } from "./config.js";
import { InMemoryVoicePersistence } from "./persistence.js";
import { buildVoiceApp } from "./server.js";

const CALL_SID = `CA${"a".repeat(32)}`;
const ACCOUNT_SID = `AC${"b".repeat(32)}`;
const AUTH_TOKEN = "test-auth-token";
const PUBLIC_BASE_URL = "https://voice.test.example";

const config: VoiceConfig = {
  host: "127.0.0.1",
  port: 3001,
  publicBaseUrl: PUBLIC_BASE_URL,
  recordingEnabled: false,
  supabaseServiceRoleKey: undefined,
  supabaseUrl: undefined,
  twilioAccountSid: ACCOUNT_SID,
  twilioAuthToken: AUTH_TOKEN,
  onCallFallbackE164: "+14155550199",
  numbersByLanguage: {
    en: "+14155550100",
    pa: "+14155550101",
    hi: "+14155550102",
    es: "+14155550103",
  },
};

function voiceForm(to: string): Record<string, string> {
  return {
    CallSid: CALL_SID,
    AccountSid: ACCOUNT_SID,
    From: "+14155550110",
    To: to,
    CallStatus: "in-progress",
    Direction: "inbound",
    ApiVersion: "2010-04-01",
  };
}

function signedHeaders(
  path: string,
  form: Record<string, string>,
): Record<string, string> {
  return {
    "content-type": "application/x-www-form-urlencoded",
    "x-twilio-signature": getExpectedTwilioSignature(
      AUTH_TOKEN,
      `${PUBLIC_BASE_URL}${path}`,
      form,
    ),
  };
}

function encoded(form: Record<string, string>): string {
  return new URLSearchParams(form).toString();
}

function nextMessage(socket: {
  once(event: "message", listener: (data: Buffer) => void): unknown;
}): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    socket.once("message", (data) => {
      resolve(JSON.parse(data.toString()) as Record<string, unknown>);
    });
  });
}

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 10));
}

describe("voice webhooks", () => {
  let persistence: InMemoryVoicePersistence;
  let app: Awaited<ReturnType<typeof buildVoiceApp>>;

  beforeEach(async () => {
    persistence = new InMemoryVoicePersistence();
    app = await buildVoiceApp({ config, persistence, logger: false });
  });

  afterEach(async () => {
    await app.close();
  });

  it("rejects an invalid signature before creating a call", async () => {
    const response = await app.inject({
      method: "POST",
      url: "/twilio/voice",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "invalid",
      },
      payload: encoded(voiceForm(config.numbersByLanguage.en)),
    });

    expect(response.statusCode).toBe(403);
    expect(persistence.calls).toHaveLength(0);
  });

  it.each(Object.entries(config.numbersByLanguage) as [Language, string][])(
    "returns a localized, non-recording AI greeting for %s",
    async (language, number) => {
      const form = voiceForm(number);
      const response = await app.inject({
        method: "POST",
        url: "/twilio/voice",
        headers: signedHeaders("/twilio/voice", form),
        payload: encoded(form),
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers["content-type"]).toContain("text/xml");
      expect(response.body).toContain("ConversationRelay");
      expect(response.body).toMatch(/AI|inteligencia artificial/u);
      expect(response.body).toContain("0");
      expect(response.body).not.toMatch(
        /recorded|recording|ਰਿਕਾਰਡ|रिकॉर्ड|graba/iu,
      );
      expect(persistence.calls[0]?.language).toBe(language);
    },
  );

  it("accepts a valid signature and deduplicates a retried voice webhook", async () => {
    const form = voiceForm(config.numbersByLanguage.en);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const response = await app.inject({
        method: "POST",
        url: "/twilio/voice",
        headers: signedHeaders("/twilio/voice", form),
        payload: encoded(form),
      });
      expect(response.statusCode).toBe(200);
    }

    expect(persistence.calls).toHaveLength(1);
    expect(persistence.calls[0]?.twilioCallSid).toBe(CALL_SID);
  });

  it.each(Object.entries(config.numbersByLanguage) as [Language, string][])(
    "adds recording consent language for %s only when enabled",
    async (_language, number) => {
      await app.close();
      app = await buildVoiceApp({
        config: { ...config, recordingEnabled: true },
        persistence,
        logger: false,
      });
      const form = voiceForm(number);
      const response = await app.inject({
        method: "POST",
        url: "/twilio/voice",
        headers: signedHeaders("/twilio/voice", form),
        payload: encoded(form),
      });

      expect(response.body).toMatch(
        /recorded|ਰਿਕਾਰਡ|रिकॉर्ड|graba/iu,
      );
      expect(persistence.calls[0]?.recordingNoticePlayed).toBe(true);
    },
  );

  it("records a duplicate handoff callback once and dials the fallback", async () => {
    const initial = voiceForm(config.numbersByLanguage.en);
    await app.inject({
      method: "POST",
      url: "/twilio/voice",
      headers: signedHeaders("/twilio/voice", initial),
      payload: encoded(initial),
    });
    const handoff = {
      CallSid: CALL_SID,
      AccountSid: ACCOUNT_SID,
      SessionStatus: "ended",
      HandoffData: JSON.stringify({
        trigger: "dtmf_zero",
        reason: "Caller pressed 0",
        idempotencyKey: "session:dtmf_zero",
      }),
    };

    const first = await app.inject({
      method: "POST",
      url: "/twilio/handoff",
      headers: signedHeaders("/twilio/handoff", handoff),
      payload: encoded(handoff),
    });
    const duplicate = await app.inject({
      method: "POST",
      url: "/twilio/handoff",
      headers: signedHeaders("/twilio/handoff", handoff),
      payload: encoded(handoff),
    });

    expect(first.statusCode).toBe(200);
    expect(duplicate.statusCode).toBe(200);
    expect(first.body).toContain("<Dial");
    expect(first.body).toContain(config.onCallFallbackE164);
    expect(first.body).toContain("human dispatcher");
    expect(persistence.handoffs).toHaveLength(1);
  });

  it("rejects an invalid handoff signature before recording or dialing", async () => {
    const handoff = {
      CallSid: CALL_SID,
      AccountSid: ACCOUNT_SID,
      SessionStatus: "ended",
    };
    const response = await app.inject({
      method: "POST",
      url: "/twilio/handoff",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-twilio-signature": "invalid",
      },
      payload: encoded(handoff),
    });

    expect(response.statusCode).toBe(403);
    expect(response.body).not.toContain("<Dial");
    expect(persistence.handoffs).toHaveLength(0);
  });

  it("parses DTMF and end callback paths idempotently", async () => {
    const initial = voiceForm(config.numbersByLanguage.en);
    await app.inject({
      method: "POST",
      url: "/twilio/voice",
      headers: signedHeaders("/twilio/voice", initial),
      payload: encoded(initial),
    });
    const dtmf = {
      CallSid: CALL_SID,
      AccountSid: ACCOUNT_SID,
      Digits: "0",
    };
    const ended = {
      CallSid: CALL_SID,
      AccountSid: ACCOUNT_SID,
      SessionStatus: "ended",
    };

    await app.inject({
      method: "POST",
      url: "/twilio/handoff",
      headers: signedHeaders("/twilio/handoff", dtmf),
      payload: encoded(dtmf),
    });
    await app.inject({
      method: "POST",
      url: "/twilio/handoff",
      headers: signedHeaders("/twilio/handoff", ended),
      payload: encoded(ended),
    });

    expect(persistence.handoffs.map((event) => event.trigger)).toEqual([
      "dtmf_zero",
      "session_end",
    ]);
  });
});

describe("ConversationRelay websocket lifecycle", () => {
  let persistence: InMemoryVoicePersistence;
  let app: Awaited<ReturnType<typeof buildVoiceApp>>;

  beforeEach(async () => {
    persistence = new InMemoryVoicePersistence();
    app = await buildVoiceApp({ config, persistence, logger: false });
    const form = voiceForm(config.numbersByLanguage.en);
    await app.inject({
      method: "POST",
      url: "/twilio/voice",
      headers: signedHeaders("/twilio/voice", form),
      payload: encoded(form),
    });
  });

  afterEach(async () => {
    await app.close();
  });

  function setupMessage(): Record<string, unknown> {
    return {
      type: "setup",
      sessionId: "VX-test-session",
      callSid: CALL_SID,
      parentCallSid: "",
      from: "+14155550110",
      to: config.numbersByLanguage.en,
      forwardedFrom: "",
      callerName: "",
      direction: "inbound",
      callType: "PSTN",
      callStatus: "RINGING",
      accountSid: ACCOUNT_SID,
      customParameters: {
        callId: persistence.calls[0]?.id,
        language: "en",
      },
    };
  }

  it("persists final caller and agent turns and streams a safe acknowledgement", async () => {
    const socket = await app.injectWS("/relay");
    socket.send(JSON.stringify(setupMessage()));
    const responsePromise = nextMessage(socket);
    socket.send(
      JSON.stringify({
        type: "prompt",
        voicePrompt: "My truck is on fire. Quote me a price.",
        lang: "en-US",
        last: true,
      }),
    );
    const response = await responsePromise;
    await settle();

    expect(response).toMatchObject({
      type: "text",
      last: true,
      lang: "en-US",
      interruptible: true,
    });
    expect(response["token"]).not.toContain("Quote me");
    expect(persistence.utterances).toHaveLength(2);
    expect(persistence.utterances.map((item) => item.speaker)).toEqual([
      "caller",
      "agent",
    ]);
    expect(persistence.utterances.every((item) => item.startedAt.length > 0)).toBe(
      true,
    );
    socket.close();
  });

  it("rejects malformed events by ending to a human", async () => {
    const socket = await app.injectWS("/relay");
    const responsePromise = nextMessage(socket);
    socket.send(JSON.stringify({ type: "prompt", voicePrompt: 123 }));
    const response = await responsePromise;

    expect(response["type"]).toBe("end");
    expect(response["handoffData"]).toContain("system_error");
    socket.close();
  });

  it("handles interrupt and deduplicates repeated prompt events", async () => {
    const socket = await app.injectWS("/relay");
    socket.send(JSON.stringify(setupMessage()));
    const prompt = {
      type: "prompt",
      voicePrompt: "I need help",
      lang: "en-US",
      last: true,
    };
    const responsePromise = nextMessage(socket);
    socket.send(JSON.stringify(prompt));
    await responsePromise;
    await settle();
    socket.send(JSON.stringify(prompt));
    socket.send(
      JSON.stringify({
        type: "interrupt",
        utteranceUntilInterrupt: "I heard",
        durationUntilInterruptMs: 120,
      }),
    );
    await settle();

    expect(persistence.utterances).toHaveLength(2);
    expect(persistence.utterances[1]?.interrupted).toBe(true);
    socket.close();
  });

  it("records an unexpected websocket close and fails the call", async () => {
    const socket = await app.injectWS("/relay");
    socket.send(JSON.stringify(setupMessage()));
    await settle();
    socket.terminate();
    await vi.waitFor(() => {
      expect(persistence.handoffs).toHaveLength(1);
    });

    expect(persistence.handoffs[0]?.trigger).toBe("system_error");
    expect(persistence.calls[0]?.status).toBe("failed");
    expect(persistence.calls[0]?.endedAt).toBeDefined();
  });

  it.each([
    [{ type: "dtmf", digit: "0" }, "dtmf_zero"],
    [{ type: "end", reason: "caller finished" }, "session_end"],
    [{ type: "error", description: "64103 internal error" }, "system_error"],
  ] as const)("ends to human for %s", async (event, expectedTrigger) => {
    const socket = await app.injectWS("/relay");
    socket.send(JSON.stringify(setupMessage()));
    const responsePromise = nextMessage(socket);
    socket.send(JSON.stringify(event));
    const response = await responsePromise;
    await settle();

    expect(response["type"]).toBe("end");
    expect(response["handoffData"]).toContain(expectedTrigger);
    expect(persistence.handoffs[0]?.trigger).toBe(expectedTrigger);
    socket.close();
  });
});
