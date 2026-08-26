import { afterEach, describe, expect, test } from "bun:test";
import { assetUrl } from "./assets";

const originalBaseUrl = process.env.NEXT_PUBLIC_ASSET_BASE_URL;

afterEach(() => {
  if (originalBaseUrl === undefined) delete process.env.NEXT_PUBLIC_ASSET_BASE_URL;
  else process.env.NEXT_PUBLIC_ASSET_BASE_URL = originalBaseUrl;
});

describe("assetUrl", () => {
  test("keeps local public paths when Spaces is not configured", () => {
    delete process.env.NEXT_PUBLIC_ASSET_BASE_URL;
    expect(assetUrl("/brands/codex.svg")).toBe("/brands/codex.svg");
  });

  test("resolves versioned public assets from the configured origin", () => {
    process.env.NEXT_PUBLIC_ASSET_BASE_URL =
      "https://agentprint.blr1.digitaloceanspaces.com/public-assets/2026-08-26/";
    expect(assetUrl("/landing/sessions-to-heatmap.webp")).toBe(
      "https://agentprint.blr1.digitaloceanspaces.com/public-assets/2026-08-26/landing/sessions-to-heatmap.webp"
    );
  });

  test("rejects paths outside the public image inventory", () => {
    expect(() => assetUrl("/releases/latest/manifest.json")).toThrow("invalid_public_asset_path");
    expect(() => assetUrl("/brands/../install.sh")).toThrow("invalid_public_asset_path");
    expect(() => assetUrl("/brand/agentprint-lockup-dark.svg")).toThrow("invalid_public_asset_path");
  });
});
