import { createHash } from "node:crypto";

import {
  getVoiceLanguage,
  streamM0Acknowledgement,
} from "@tmt/agent";
import {
  conversationRelayEndMessageSchema,
  conversationRelayEventSchema,
  conversationRelayTextMessageSchema,
  languageSchema,
  type ConversationRelayEvent,
  type Language,
} from "@tmt/contracts";

import type {
  VoiceCall,
  VoiceHandoffTrigger,
  VoicePersistence,
} from "../persistence.js";

export interface RelaySocket {
  send(data: string): void;
}

export interface RelaySessionOptions {
  readonly onCallFallbackE164: string;
  readonly persistence: VoicePersistence;
  readonly socket: RelaySocket;
  readonly now?: () => Date;
  readonly onError?: (error: unknown) => void;
}

interface HandoffPayload {
  readonly idempotencyKey: string;
  readonly reason: string;
  readonly trigger: VoiceHandoffTrigger;
}

export class RelaySession {
  private readonly now: () => Date;
  private call: VoiceCall | undefined;
  private language: Language | undefined;
  private sessionId: string | undefined;
  private sequenceNumber = 0;
  private lastPromptFingerprint: string | undefined;
  private ending = false;

  constructor(private readonly options: RelaySessionOptions) {
    this.now = options.now ?? (() => new Date());
  }

  async handleRawMessage(raw: string): Promise<void> {
    let json: unknown;
    try {
      json = JSON.parse(raw);
    } catch {
      await this.failToHuman("Malformed ConversationRelay JSON");
      return;
    }

    const parsed = conversationRelayEventSchema.safeParse(json);
    if (!parsed.success) {
      await this.failToHuman("Malformed ConversationRelay event");
      return;
    }

    try {
      await this.handleEvent(parsed.data);
    } catch (error) {
      this.options.onError?.(error);
      await this.failToHuman("Voice session processing failed");
    }
  }

  async handleClose(): Promise<void> {
    if (this.ending || this.call === undefined) {
      return;
    }
    try {
      await this.recordHandoff(
        "system_error",
        "ConversationRelay WebSocket closed unexpectedly",
        `${this.sessionId ?? this.call.twilioCallSid}:close`,
      );
      await this.options.persistence.updateCall(this.call.id, {
        status: "failed",
        endedAt: this.now().toISOString(),
        handoffReason: "ConversationRelay WebSocket closed unexpectedly",
      });
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  async handleTransportError(): Promise<void> {
    try {
      await this.failToHuman("ConversationRelay WebSocket transport error");
    } catch (error) {
      this.options.onError?.(error);
    }
  }

  private async handleEvent(event: ConversationRelayEvent): Promise<void> {
    if (event.type === "setup") {
      await this.handleSetup(event);
      return;
    }
    if (this.call === undefined || this.language === undefined) {
      await this.failToHuman("ConversationRelay event arrived before setup");
      return;
    }

    switch (event.type) {
      case "prompt":
        if (event.last) {
          await this.handleFinalPrompt(event.voicePrompt);
        }
        break;
      case "interrupt":
        await this.options.persistence.markLastAgentUtteranceInterrupted(
          this.call.id,
          this.now().toISOString(),
        );
        break;
      case "dtmf":
        if (event.digit === "0") {
          await this.endToHuman("dtmf_zero", "Caller pressed 0");
        }
        break;
      case "end":
        await this.endToHuman(
          "session_end",
          event.reason ?? "ConversationRelay session ended",
        );
        break;
      case "error":
        await this.endToHuman("system_error", event.description);
        break;
    }
  }

  private async handleSetup(
    event: Extract<ConversationRelayEvent, { type: "setup" }>,
  ): Promise<void> {
    if (this.call !== undefined) {
      await this.failToHuman("Duplicate ConversationRelay setup");
      return;
    }

    const call = await this.options.persistence.findCallBySid(event.callSid);
    const language = languageSchema.safeParse(event.customParameters["language"]);
    if (
      call === undefined ||
      !language.success ||
      event.customParameters["callId"] !== call.id ||
      language.data !== call.language
    ) {
      await this.failToHuman("ConversationRelay setup did not match its call");
      return;
    }

    this.call = call;
    this.language = language.data;
    this.sessionId = event.sessionId;
  }

  private async handleFinalPrompt(prompt: string): Promise<void> {
    if (this.call === undefined || this.language === undefined) {
      return;
    }
    const fingerprint = createHash("sha256").update(prompt).digest("hex");
    if (fingerprint === this.lastPromptFingerprint) {
      return;
    }
    this.lastPromptFingerprint = fingerprint;

    const callerStartedAt = this.now().toISOString();
    const callerSequence = this.sequenceNumber++;
    const eventPrefix = this.sessionId ?? this.call.twilioCallSid;
    await this.options.persistence.appendUtterance({
      callId: this.call.id,
      externalEventId: `${eventPrefix}:prompt:${String(callerSequence)}:${fingerprint}`,
      sequenceNumber: callerSequence,
      speaker: "caller",
      language: this.language,
      text: prompt,
      isFinal: true,
      interrupted: false,
      startedAt: callerStartedAt,
      endedAt: this.now().toISOString(),
    });

    const agentStartedAt = this.now().toISOString();
    const tokens: string[] = [];
    for await (const token of streamM0Acknowledgement({
      language: this.language,
      prompt,
    })) {
      tokens.push(token);
    }

    for (const [index, token] of tokens.entries()) {
      const message = conversationRelayTextMessageSchema.parse({
        type: "text",
        token,
        last: index === tokens.length - 1,
        ...(index === 0
          ? { lang: getVoiceLanguage(this.language) }
          : {}),
        interruptible: true,
      });
      this.options.socket.send(JSON.stringify(message));
    }

    if (tokens.length > 0) {
      const agentSequence = this.sequenceNumber++;
      await this.options.persistence.appendUtterance({
        callId: this.call.id,
        externalEventId: `${eventPrefix}:agent:${String(agentSequence)}:${fingerprint}`,
        sequenceNumber: agentSequence,
        speaker: "agent",
        language: this.language,
        text: tokens.join(""),
        isFinal: true,
        interrupted: false,
        startedAt: agentStartedAt,
        endedAt: this.now().toISOString(),
      });
    }
  }

  private async failToHuman(reason: string): Promise<void> {
    await this.endToHuman("system_error", reason);
  }

  private async endToHuman(
    trigger: VoiceHandoffTrigger,
    reason: string,
  ): Promise<void> {
    if (this.ending) {
      return;
    }
    this.ending = true;
    const idempotencyKey = `${this.sessionId ?? this.call?.twilioCallSid ?? "unbound"}:${trigger}`;
    if (this.call !== undefined) {
      await this.recordHandoff(trigger, reason, idempotencyKey);
      await this.options.persistence.updateCall(this.call.id, {
        status: "handoff_requested",
        handoffReason: reason,
      });
    }

    const payload: HandoffPayload = { idempotencyKey, reason, trigger };
    const message = conversationRelayEndMessageSchema.parse({
      type: "end",
      handoffData: JSON.stringify(payload),
    });
    this.options.socket.send(JSON.stringify(message));
  }

  private async recordHandoff(
    trigger: VoiceHandoffTrigger,
    reason: string,
    idempotencyKey: string,
  ): Promise<void> {
    if (this.call === undefined) {
      return;
    }
    await this.options.persistence.recordHandoff({
      callId: this.call.id,
      idempotencyKey,
      trigger,
      reason,
      targetE164: this.options.onCallFallbackE164,
    });
  }
}
