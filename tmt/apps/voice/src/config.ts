import type { Language } from "@tmt/contracts";

export interface VoiceConfig {
  readonly host: string;
  readonly port: number;
  readonly publicBaseUrl: string;
  readonly recordingEnabled: boolean;
  readonly supabaseServiceRoleKey: string | undefined;
  readonly supabaseUrl: string | undefined;
  readonly twilioAccountSid: string;
  readonly twilioAuthToken: string;
  readonly onCallFallbackE164: string;
  readonly numbersByLanguage: Readonly<Record<Language, string>>;
}

function required(env: NodeJS.ProcessEnv, name: string): string {
  const value = env[name]?.trim();
  if (value === undefined || value === "") {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export function loadVoiceConfig(
  env: NodeJS.ProcessEnv = process.env,
): VoiceConfig {
  const port = Number(env["PORT"] ?? "3001");
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error("PORT must be an integer between 1 and 65535");
  }

  return {
    host: env["HOST"]?.trim() || "0.0.0.0",
    port,
    publicBaseUrl: required(env, "PUBLIC_VOICE_BASE_URL").replace(/\/+$/, ""),
    recordingEnabled: env["RECORDING_ENABLED"] === "true",
    supabaseServiceRoleKey: env["SUPABASE_SERVICE_ROLE_KEY"]?.trim() || undefined,
    supabaseUrl: env["SUPABASE_URL"]?.trim() || undefined,
    twilioAccountSid: required(env, "TWILIO_ACCOUNT_SID"),
    twilioAuthToken: required(env, "TWILIO_AUTH_TOKEN"),
    onCallFallbackE164: required(env, "ON_CALL_FALLBACK_E164"),
    numbersByLanguage: {
      en: required(env, "TWILIO_NUMBER_GENERAL"),
      pa: required(env, "TWILIO_NUMBER_PA"),
      hi: required(env, "TWILIO_NUMBER_HI"),
      es: required(env, "TWILIO_NUMBER_ES"),
    },
  };
}

export function languageForCalledNumber(
  to: string,
  numbersByLanguage: VoiceConfig["numbersByLanguage"],
): Language | undefined {
  return (Object.entries(numbersByLanguage) as [Language, string][]).find(
    ([, number]) => number === to,
  )?.[0];
}

export function relayWebSocketUrl(publicBaseUrl: string): string {
  const url = new URL("/relay", publicBaseUrl);
  url.protocol = url.protocol === "http:" ? "ws:" : "wss:";
  return url.toString();
}
