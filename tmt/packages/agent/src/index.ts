import type { Language } from "@tmt/contracts";

import {
  BCP47_BY_LANGUAGE,
  SPOKEN_MESSAGES,
  type SpokenMessages,
} from "./i18n/messages.js";

export interface M0AgentTurn {
  readonly language: Language;
  readonly prompt: string;
}

export interface VoiceGreetingOptions {
  readonly language: Language;
  readonly recordingEnabled: boolean;
}

export function getSpokenMessages(language: Language): SpokenMessages {
  return SPOKEN_MESSAGES[language];
}

export function getVoiceGreeting(options: VoiceGreetingOptions): string {
  const messages = getSpokenMessages(options.language);
  return options.recordingEnabled
    ? messages.greetingWithRecording
    : messages.greeting;
}

export function getVoiceLanguage(
  language: Language,
): (typeof BCP47_BY_LANGUAGE)[Language] {
  return BCP47_BY_LANGUAGE[language];
}

/**
 * M0 transport boundary. It intentionally does not repeat untrusted caller
 * speech; the deterministic acknowledgement keeps the loop safe until the
 * policy-backed model dispatcher is introduced in M1.
 */
export async function* streamM0Acknowledgement(
  turn: M0AgentTurn,
): AsyncGenerator<string> {
  if (turn.prompt.trim().length === 0) {
    return;
  }

  await Promise.resolve();
  yield getSpokenMessages(turn.language).acknowledgement;
}
