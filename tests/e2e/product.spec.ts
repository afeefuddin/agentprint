import { expect, test } from "@playwright/test";
import { createSession, findOrCreateOAuthUser } from "../../packages/database/src/index";

test("desktop registration remains scrollable when the form exceeds the viewport", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Desktop layout only");
  await page.setViewportSize({ width: 1440, height: 420 });
  await page.goto("/register");
  const layout = page.locator(".auth-layout");
  const dimensions = await layout.evaluate((element) => ({
    clientHeight: element.clientHeight,
    scrollHeight: element.scrollHeight
  }));
  expect(dimensions.scrollHeight).toBeGreaterThan(dimensions.clientHeight);
  await layout.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect.poll(() => layout.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(page.getByText("By continuing, you agree to the Terms")).toBeVisible();
});

test("public profile renders the contribution instrument and keyboard grid", async ({ page }) => {
  await page.goto("/maya-builds");
  await expect(page.getByRole("heading", { name: "Maya Chen" })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Daily token activity" })).toBeVisible();
  const cells = page.getByRole("gridcell");
  await expect(cells).toHaveCount(371);
  await cells.last().focus();
  await page.keyboard.press("ArrowLeft");
  await expect(page.locator(".activity-cell:focus")).toBeVisible();
});

test("legacy profile URLs redirect to the root profile", async ({ page }) => {
  await page.goto("/u/maya-builds");
  await expect(page).toHaveURL(/\/maya-builds$/);
  await expect(page.getByRole("heading", { name: "Maya Chen" })).toBeVisible();
});

test("landing activity field updates its heat levels", async ({ page }) => {
  await page.goto("/");
  const cells = page.locator(".landing-instrument .instrument-grid i");
  await expect(cells).toHaveCount(371);
  const initialLevels = await cells.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-level"))
  );

  await expect.poll(
    () => cells.evaluateAll((items) => items.map((item) => item.getAttribute("data-level"))),
    { timeout: 3_500 }
  ).not.toEqual(initialLevels);
});

test("new account starts private and can be published", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const handle = `e2e-${suffix}`.slice(0, 29);
  const user = await findOrCreateOAuthUser({
    provider: "github",
    accountId: `e2e-${suffix}`,
    email: `${handle}@example.com`
  });
  const token = await createSession(user.id);
  await page.context().addCookies([{ name: "pm_session", value: token, url: "http://localhost:3000" }]);
  await page.goto("/onboarding");
  await page.getByLabel("Name", { exact: true }).fill("Browser Test");
  await page.getByLabel("Username").fill(handle);
  await page.getByRole("button", { name: "Claim profile and continue" }).click();
  await expect(page.getByRole("heading", { name: "One command. Then forget it." })).toBeVisible();
  await page.goto("/dashboard");
  const publicSwitch = page.getByRole("switch", { name: "Public profile" });
  await expect(publicSwitch).not.toBeChecked();
  await publicSwitch.click();
  await expect(publicSwitch).toBeChecked();
  const response = await page.request.get(`/v1/profiles/${handle}`);
  expect(response.ok()).toBeTruthy();
});

test("OAuth choices preserve a pending device activation path", async ({ page }) => {
  await page.goto("/login?next=%2Factivate%3Fcode%3DAAAAAA-BBBBBB");
  await expect(page.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
    "href",
    "/api/auth/github?source=login&next=%2Factivate%3Fcode%3DAAAAAA-BBBBBB"
  );
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    "/api/auth/google?source=login&next=%2Factivate%3Fcode%3DAAAAAA-BBBBBB"
  );
  await expect(page.getByRole("textbox")).toHaveCount(0);
});
