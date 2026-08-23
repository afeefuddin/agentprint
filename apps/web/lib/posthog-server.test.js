import { describe, expect, test } from "bun:test";
import { sanitizePostHogError } from "./posthog-server";

describe("sanitizePostHogError", () => {
  test("removes credentials and URL parameters while preserving diagnostics", () => {
    const error = new Error(
      "Request to https://agentprint.tech/activate?code=secret failed with Bearer private-token"
    );
    error.stack = "Error: failed\n at https://agentprint.tech/server.js?token=secret:10:2";

    const sanitized = sanitizePostHogError(error);
    expect(sanitized.message).toBe(
      "Request to https://agentprint.tech/activate failed with Bearer [redacted]"
    );
    expect(sanitized.stack).toBe("Error: failed\n at https://agentprint.tech/server.js");
  });
});
