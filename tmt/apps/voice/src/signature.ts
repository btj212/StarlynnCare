import { validateRequest } from "twilio";

export type TwilioForm = Record<string, string>;

export function parseTwilioForm(body: unknown): TwilioForm | undefined {
  if (body === null || typeof body !== "object" || Array.isArray(body)) {
    return undefined;
  }

  const entries: [string, string][] = [];
  for (const [key, value] of Object.entries(body)) {
    if (typeof value !== "string") {
      return undefined;
    }
    entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

export function hasValidTwilioSignature(options: {
  readonly authToken: string;
  readonly signature: string | undefined;
  readonly url: string;
  readonly params: TwilioForm;
}): boolean {
  if (options.signature === undefined || options.signature === "") {
    return false;
  }

  return validateRequest(
    options.authToken,
    options.signature,
    options.url,
    options.params,
  );
}
