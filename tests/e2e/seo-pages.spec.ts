import { expect, test } from "@playwright/test";

const seoRoutes = [
  "/integrations",
  "/guides",
  "/docs",
  "/integrations/claude-code",
  "/integrations/codex",
  "/integrations/kimi-code",
  "/integrations/opencode",
  "/guides/share-claude-code-session",
  "/guides/share-codex-session",
  "/guides/share-kimi-code-session",
  "/methodology/activity",
  "/security/session-redaction",
  "/privacy/what-agentprint-collects",
  "/use-cases/ai-coding-activity-tracker",
  "/use-cases/developer-ai-profile"
] as const;

test("the SEO library is reachable and internally navigable", async ({ page, request }) => {
  for (const route of seoRoutes) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }

  await page.goto("/integrations");
  await expect(page.getByRole("heading", { level: 1, name: "One activity history for the coding agents you actually use." })).toBeVisible();
  await expect(page.getByRole("link", { name: /Claude Code activity tracking/ })).toBeVisible();
  await page.getByRole("link", { name: /Kimi Code activity tracking/ }).click();
  await expect(page).toHaveURL(/\/integrations\/kimi-code$/);
  await expect(page.getByRole("img", { name: /Kimi Code activity flowing through Agentprint/ })).toBeVisible();
});

test("a detailed SEO page remains readable without horizontal overflow", async ({ page }) => {
  await page.goto("/guides/share-codex-session");
  await expect(page.getByRole("heading", { level: 1, name: "Share a Codex session without sharing your whole machine." })).toBeVisible();
  await expect(page.getByRole("img", { name: /Codex session moving through local preview and redaction/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A deliberate link, not a background recording." })).toBeVisible();

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
