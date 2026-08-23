import { describe, expect, test } from "bun:test";
import { sanitizeCapturedNetworkRequest, sanitizePostHogEvent } from "./posthog";

describe("sanitizePostHogEvent", () => {
  test("removes query strings and fragments from captured URLs", () => {
    const event = {
      uuid: "event-id",
      event: "$pageview",
      properties: {
        $current_url: "https://agentprint.dev/activate?code=secret#connect",
        $referrer: "https://example.com/path?campaign=private",
        retained: "value"
      }
    };

    expect(sanitizePostHogEvent(event)?.properties).toEqual({
      $current_url: "https://agentprint.dev/activate",
      $referrer: "https://example.com/path",
      retained: "value"
    });
  });

  test("preserves a dropped event", () => {
    expect(sanitizePostHogEvent(null)).toBeNull();
  });

  test("removes credentials from nested exception properties", () => {
    const event = {
      uuid: "event-id",
      event: "$exception",
      properties: {
        authorization: "Bearer top-secret",
        $exception_list: [{
          value: "Request failed at https://agentprint.tech/activate?code=secret",
          stacktrace: { frames: [{ filename: "https://agentprint.tech/app.js?token=secret" }] }
        }]
      }
    };

    expect(sanitizePostHogEvent(event)?.properties).toEqual({
      $exception_list: [{
        value: "Request failed at https://agentprint.tech/activate",
        stacktrace: { frames: [{ filename: "https://agentprint.tech/app.js" }] }
      }]
    });
  });
});

describe("sanitizeCapturedNetworkRequest", () => {
  test("keeps timing data but removes secrets and payloads", () => {
    expect(sanitizeCapturedNetworkRequest({
      name: "https://agentprint.tech/v1/me?token=secret",
      entryType: "resource",
      startTime: 10,
      duration: 20,
      requestHeaders: { authorization: "Bearer secret" },
      responseHeaders: { "set-cookie": "secret" },
      requestBody: "secret request",
      responseBody: "secret response"
    })).toMatchObject({
      name: "https://agentprint.tech/v1/me",
      startTime: 10,
      duration: 20,
      requestHeaders: undefined,
      responseHeaders: undefined,
      requestBody: null,
      responseBody: null
    });
  });
});
