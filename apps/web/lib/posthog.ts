import type { CaptureResult, CapturedNetworkRequest } from "posthog-js";

const URL_PROPERTIES = [
  "$current_url",
  "$initial_current_url",
  "$referrer",
  "$initial_referrer",
  "$session_entry_url"
] as const;

const SENSITIVE_PROPERTIES = new Set([
  "authorization",
  "cookie",
  "set-cookie",
  "password",
  "access_token",
  "refresh_token",
  "device_code",
  "user_code"
]);

export function withoutQueryOrHash(value: string) {
  return value.split(/[?#]/, 1)[0];
}

function sanitizeString(value: string) {
  return value
    .replace(/https?:\/\/[^\s)\]}]+/g, (url) => withoutQueryOrHash(url))
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:code|state|token)=)[^&#\s]+/gi, "$1[redacted]");
}

function sanitizeValue(value: unknown): unknown {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeValue);
  if (!value || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, nested]) => (
      SENSITIVE_PROPERTIES.has(key.toLowerCase())
        ? []
        : [[key, sanitizeValue(nested)]]
    ))
  );
}

export function sanitizePostHogEvent(event: CaptureResult | null) {
  if (!event) return null;

  const properties = sanitizeValue(event.properties) as CaptureResult["properties"];

  for (const property of URL_PROPERTIES) {
    const value = properties[property];
    if (typeof value === "string") properties[property] = withoutQueryOrHash(value);
  }

  return { ...event, properties };
}

export function sanitizeCapturedNetworkRequest(request: CapturedNetworkRequest) {
  return {
    ...request,
    name: withoutQueryOrHash(request.name),
    requestHeaders: undefined,
    responseHeaders: undefined,
    requestBody: null,
    responseBody: null
  };
}
