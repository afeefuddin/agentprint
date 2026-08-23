import { PostHog } from "posthog-node";

type SafeProperty = string | number | boolean;

let posthog: PostHog | null | undefined;

export function getPostHogServer() {
  if (posthog !== undefined) return posthog;

  const token = process.env.POSTHOG_PROJECT_TOKEN
    ?? process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN;
  const host = process.env.POSTHOG_HOST
    ?? process.env.NEXT_PUBLIC_POSTHOG_HOST;

  posthog = token && host
    ? new PostHog(token, { host, flushAt: 1, flushInterval: 0 })
    : null;
  return posthog;
}

export async function capturePostHogEvent(input: {
  distinctId: string;
  event: string;
  properties?: Record<string, SafeProperty>;
}) {
  const client = getPostHogServer();
  if (!client) return;

  try {
    await client.captureImmediate(input);
  } catch {
    // Analytics is deliberately fail-open and must not change product behavior.
  }
}

function sanitizeErrorText(value: string) {
  return value
    .replace(/https?:\/\/[^\s)\]}]+/g, (url) => url.split(/[?#]/, 1)[0])
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [redacted]")
    .replace(/([?&](?:code|state|token)=)[^&#\s]+/gi, "$1[redacted]");
}

export function sanitizePostHogError(error: unknown) {
  if (!(error instanceof Error)) return new Error("Unknown server error");

  const sanitized = new Error(sanitizeErrorText(error.message));
  sanitized.name = error.name;
  if (error.stack) sanitized.stack = sanitizeErrorText(error.stack);
  return sanitized;
}

export async function capturePostHogException(
  error: unknown,
  properties: Record<string, SafeProperty> = {}
) {
  const client = getPostHogServer();
  if (!client) return;

  try {
    await client.captureExceptionImmediate(
      sanitizePostHogError(error),
      "agentprint-server",
      properties
    );
  } catch {
    // Error reporting cannot be allowed to create a second application error.
  }
}
