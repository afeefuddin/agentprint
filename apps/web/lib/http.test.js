import { afterEach, describe, expect, test } from "bun:test";
import { requestUrl } from "./http";

const originalAppUrl = process.env.APP_URL;
const originalPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL;

afterEach(() => {
  if (originalAppUrl === undefined) delete process.env.APP_URL;
  else process.env.APP_URL = originalAppUrl;

  if (originalPublicAppUrl === undefined) delete process.env.NEXT_PUBLIC_APP_URL;
  else process.env.NEXT_PUBLIC_APP_URL = originalPublicAppUrl;
});

describe("requestUrl", () => {
  test("uses the canonical app URL instead of the forwarded host", () => {
    process.env.APP_URL = "https://agentprint.tech";
    process.env.NEXT_PUBLIC_APP_URL = "https://www.agentprint.tech";
    const request = new Request("https://www.agentprint.tech/api/auth/google", {
      headers: {
        host: "www.agentprint.tech",
        "x-forwarded-host": "www.agentprint.tech",
        "x-forwarded-proto": "https"
      }
    });

    expect(requestUrl(request, "/api/auth/google/callback").toString()).toBe(
      "https://agentprint.tech/api/auth/google/callback"
    );
  });

  test("falls back to the request host when no app URL is configured", () => {
    delete process.env.APP_URL;
    delete process.env.NEXT_PUBLIC_APP_URL;
    const request = new Request("https://www.agentprint.tech/api/auth/google", {
      headers: {
        host: "www.agentprint.tech",
        "x-forwarded-host": "www.agentprint.tech",
        "x-forwarded-proto": "https"
      }
    });

    expect(requestUrl(request, "/api/auth/google/callback").toString()).toBe(
      "https://www.agentprint.tech/api/auth/google/callback"
    );
  });
});
