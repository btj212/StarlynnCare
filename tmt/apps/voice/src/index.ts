import { pathToFileURL } from "node:url";

import { loadVoiceConfig } from "./config.js";
import { buildVoiceApp } from "./server.js";

export * from "./config.js";
export * from "./persistence.js";
export * from "./server.js";
export * from "./twiml.js";

async function start(): Promise<void> {
  const config = loadVoiceConfig();
  const app = await buildVoiceApp({ config });
  await app.listen({ host: config.host, port: config.port });
}

const entrypoint = process.argv[1];
if (
  entrypoint !== undefined &&
  import.meta.url === pathToFileURL(entrypoint).href
) {
  start().catch((error: unknown) => {
    console.error("Failed to start TMT voice service", error);
    process.exitCode = 1;
  });
}
