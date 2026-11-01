import {
  getSpokenMessages,
  getVoiceGreeting,
  getVoiceLanguage,
} from "@tmt/agent";
import type { Language } from "@tmt/contracts";
import twilio from "twilio";

export function buildConversationRelayTwiml(options: {
  readonly actionUrl: string;
  readonly callId: string;
  readonly language: Language;
  readonly recordingEnabled: boolean;
  readonly relayUrl: string;
}): string {
  const response = new twilio.twiml.VoiceResponse();
  const connect = response.connect({
    action: options.actionUrl,
    method: "POST",
  });
  const relay = connect.conversationRelay({
    url: options.relayUrl,
    language: getVoiceLanguage(options.language),
    transcriptionProvider: "Google",
    ttsProvider: "Google",
    dtmfDetection: true,
    interruptible: "any",
    welcomeGreetingInterruptible: "any",
    welcomeGreeting: getVoiceGreeting({
      language: options.language,
      recordingEnabled: options.recordingEnabled,
    }),
  });
  relay.parameter({ name: "callId", value: options.callId });
  relay.parameter({ name: "language", value: options.language });
  return response.toString();
}

export function buildHandoffTwiml(options: {
  readonly language: Language;
  readonly targetE164: string;
}): string {
  const response = new twilio.twiml.VoiceResponse();
  response.say(
    { language: getVoiceLanguage(options.language) },
    getSpokenMessages(options.language).handoff,
  );
  const dial = response.dial({
    answerOnBridge: true,
    timeout: 20,
  });
  dial.number(options.targetE164);
  return response.toString();
}
