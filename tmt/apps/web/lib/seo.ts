const LOCAL_BASE_URL = "http://localhost:3000";

export function webBaseUrl(
  env: NodeJS.ProcessEnv = process.env,
): URL {
  const configured = env.PUBLIC_WEB_BASE_URL?.trim();
  return new URL(configured || LOCAL_BASE_URL);
}

export function canonicalFor(
  pathname: string,
  env: NodeJS.ProcessEnv = process.env,
): string {
  const normalizedPath = pathname.startsWith("/") ? pathname : `/${pathname}`;
  return new URL(normalizedPath, webBaseUrl(env)).toString();
}
