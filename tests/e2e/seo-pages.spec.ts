import { expect, test } from "@playwright/test";

const seoRoutes = [
  "/integrations",
  "/product/profile",
  "/product/session-sharing",
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
  for (const route of seoRoutes.filter((route) => route !== "/integrations")) {
    const response = await request.get(route);
    expect(response.status(), route).toBe(200);
  }

  const integrationRedirect = await request.get("/integrations", { maxRedirects: 0 });
  expect(integrationRedirect.status()).toBe(308);
  expect(integrationRedirect.headers().location).toBe("/integrations/claude-code");

  const productRedirect = await request.get("/docs", { maxRedirects: 0 });
  expect(productRedirect.status()).toBe(308);
  expect(productRedirect.headers().location).toBe("/product/profile");

  const gettingStartedRedirect = await request.get("/docs/getting-started", { maxRedirects: 0 });
  expect(gettingStartedRedirect.status()).toBe(308);
  expect(gettingStartedRedirect.headers().location).toBe("/product/profile");

  await page.goto("/integrations");
  await expect(page).toHaveURL(/\/integrations\/claude-code$/);
  await expect(page.getByRole("heading", { level: 1, name: "A Claude Code activity tracker built around local logs." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  await expect(page.locator("header").getByRole("link", { name: "Integrations" })).toHaveCount(0);
  await expect(page.locator("footer").getByText("Integrations", { exact: true })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Kimi Code" })).toBeVisible();

  await page.goto("/methodology/activity");
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);

  const removedGuidesIndex = await request.get("/guides");
  expect(removedGuidesIndex.status()).toBe(404);

  const removedProductIndex = await request.get("/product");
  expect(removedProductIndex.status()).toBe(404);

  await page.goto("/product/profile");
  await expect(page.getByRole("heading", { level: 1, name: "Your coding-agent work, in one profile." })).toBeVisible();
  await expect(page.getByRole("img", { name: /Agentprint developer profile/ })).toBeVisible();
  if ((page.viewportSize()?.width ?? 0) <= 681) {
    await page.getByRole("button", { name: "Open navigation menu" }).click();
    await expect(page.getByRole("menuitem", { name: /Profile/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Claude Code/ })).toBeVisible();
    await page.keyboard.press("Escape");
  } else {
    await page.getByRole("button", { name: "Product" }).click();
    await expect(page.getByRole("menuitem", { name: /Profile/ })).toBeVisible();
    await expect(page.getByRole("menuitem", { name: /Session sharing/ })).toBeVisible();
    await page.keyboard.press("Escape");
    await page.getByRole("button", { name: "Guides" }).click();
    await expect(page.getByRole("menuitem", { name: /Claude Code/ })).toBeVisible();
    await page.keyboard.press("Escape");
  }
  await expect(page.locator("footer").getByRole("link", { name: "Profile" })).toBeVisible();
  await expect(page.locator("footer").getByRole("link", { name: "Session sharing" })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);

  await page.goto("/product/session-sharing");
  await expect(page.getByRole("heading", { level: 1, name: "Share the session. Keep the rest private." })).toBeVisible();
  await expect(page.getByRole("img", { name: /session moving through local preview and redaction/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A readable record of how the work happened." })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A publishing tool, not a background recorder." })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
});

test("a detailed SEO page remains readable without horizontal overflow", async ({ page }) => {
  await page.goto("/guides/share-codex-session");
  await expect(page.getByRole("heading", { level: 1, name: "Share a Codex session without sharing your whole machine." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Breadcrumb" })).toHaveCount(0);
  await expect(page.getByRole("img", { name: /Codex session moving through local preview and redaction/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "A deliberate link, not a background recording." })).toBeVisible();
  const faqSection = page.getByRole("heading", { name: "Frequently asked questions" }).locator("xpath=ancestor::section");
  await expect(faqSection).toBeVisible();
  await expect(faqSection.getByText("01", { exact: true })).toHaveCount(0);
  await expect(page.getByText("FAQ", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Know what happens before you connect.")).toHaveCount(0);
  await expect(page.locator("details").first()).toHaveAttribute("open", "");

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(1);
});
