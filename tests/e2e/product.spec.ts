import { expect, test } from "@playwright/test";
import {
  createAccount,
  createSession,
  findOrCreateOAuthUser,
  pool,
  updateProfile
} from "../../packages/database/src/index";

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

test("global search excludes private profiles while direct visits show identity only", async ({ page }, testInfo) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const publicHandle = `public-${suffix}`.slice(0, 29);
  const privateHandle = `private-${suffix}`.slice(0, 29);
  const publicUser = await createAccount({
    email: `${publicHandle}@example.com`,
    password: "a-strong-test-password",
    handle: publicHandle,
    displayName: "Public Directory Test",
    timezone: "UTC"
  });
  const privateUser = await createAccount({
    email: `${privateHandle}@example.com`,
    password: "a-strong-test-password",
    handle: privateHandle,
    displayName: "Private Directory Test",
    timezone: "UTC"
  });

  try {
    await updateProfile(publicUser.id, { is_public: true });
    await page.goto(`/${privateHandle}`);
    await expect(page.getByRole("heading", { name: "Private Directory Test" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "This profile is private." })).toBeVisible();
    await expect(page.getByText(`@${privateHandle}`, { exact: true })).toBeVisible();
    await expect(page.getByRole("grid", { name: "Daily token activity" })).toHaveCount(0);
    expect((await page.request.get(`/v1/profiles/${privateHandle}`)).status()).toBe(404);

    if (testInfo.project.name === "mobile") {
      await page.getByRole("button", { name: "Search public profiles" }).click();
    }
    const search = page.getByPlaceholder("Search profiles");
    await search.fill(privateHandle);
    await expect(page.getByText(`No public profile matches “${privateHandle}”.`)).toBeVisible();
    await search.fill(publicHandle);
    await expect(page.getByRole("option", { name: `Public Directory Test @${publicHandle}` })).toBeVisible();
    await search.press("ArrowDown");
    await search.press("Enter");
    await expect(page).toHaveURL(new RegExp(`/${publicHandle}$`));
    await expect(page.getByRole("heading", { name: "Public Directory Test" })).toBeVisible();
    await expect(page.getByRole("grid", { name: "Daily token activity" })).toBeVisible();
  } finally {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[publicUser.id, privateUser.id]]);
  }
});

test("another profile can send and retain a friend request", async ({ page }) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const requesterHandle = `requester-${suffix}`.slice(0, 29);
  const targetHandle = `target-${suffix}`.slice(0, 29);
  const requester = await createAccount({
    email: `${requesterHandle}@example.com`,
    password: "a-strong-test-password",
    handle: requesterHandle,
    displayName: "Requesting Builder",
    timezone: "UTC"
  });
  const target = await createAccount({
    email: `${targetHandle}@example.com`,
    password: "a-strong-test-password",
    handle: targetHandle,
    displayName: "Target Builder",
    timezone: "UTC"
  });

  try {
    await updateProfile(target.id, { is_public: true });
    const token = await createSession(requester.id);
    await page.context().addCookies([{ name: "pm_session", value: token, url: "http://localhost:3000" }]);

    await page.goto(`/${targetHandle}`);
    await expect(page.getByRole("heading", { name: "Target Builder" })).toBeVisible();
    await page.getByRole("button", { name: "Add friend" }).click();
    await expect(page.getByText("Request sent", { exact: true })).toBeVisible();

    await page.reload();
    await expect(page.getByText("Request sent", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add friend" })).toHaveCount(0);

    await page.goto(`/${requesterHandle}`);
    await expect(page.getByRole("heading", { name: "Requesting Builder" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add friend" })).toHaveCount(0);
  } finally {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[requester.id, target.id]]);
  }
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

test("friends can connect, opt in, and compare paired traces", async ({ page, browser }, testInfo) => {
  const suffix = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
  const firstHandle = `trace-a-${suffix}`.slice(0, 29);
  const secondHandle = `trace-b-${suffix}`.slice(0, 29);
  const first = await createAccount({
    email: `${firstHandle}@example.com`,
    password: "a-strong-test-password",
    handle: firstHandle,
    displayName: "Avery Trace",
    timezone: "UTC"
  });
  const second = await createAccount({
    email: `${secondHandle}@example.com`,
    password: "a-strong-test-password",
    handle: secondHandle,
    displayName: "Morgan Trace",
    timezone: "UTC"
  });

  try {
    await pool.query(
      `INSERT INTO daily_usage (
        user_id, local_date, harness_id, model_id, total_tokens, event_count
       ) VALUES
        ($1, current_date, 'codex', 'gpt-5.6-sol', 2500, 1),
        ($1, current_date - 1, 'codex', 'gpt-5.6-sol', 1400, 1),
        ($2, current_date, 'claude-code', 'claude-opus-4.1', 1800, 1)`,
      [first.id, second.id]
    );
    const firstToken = await createSession(first.id);
    await page.context().addCookies([{ name: "pm_session", value: firstToken, url: "http://localhost:3000" }]);
    await page.goto("/dashboard/friends");
    await expect(page.getByRole("heading", { name: "Compare traces, not people." })).toBeVisible();
    await Promise.all([
      page.waitForResponse((response) => response.url().endsWith("/v1/me/profile") && response.request().method() === "PATCH"),
      page.getByRole("switch", { name: "Friend comparisons" }).click()
    ]);
    await page.getByLabel("Exact Agentprint handle").fill(secondHandle);
    await page.getByRole("button", { name: "Find friend" }).click();
    await expect(page.getByText("Morgan Trace")).toBeVisible();
    await page.getByRole("button", { name: "Send request" }).click();
    await expect(page.getByText(`Request sent to @${secondHandle}.`)).toBeVisible();

    const secondToken = await createSession(second.id);
    const secondContext = await browser.newContext({
      baseURL: "http://localhost:3000",
      viewport: page.viewportSize() ?? { width: 1280, height: 720 }
    });
    try {
      await secondContext.addCookies([{ name: "pm_session", value: secondToken, url: "http://localhost:3000" }]);
      const secondPage = await secondContext.newPage();
      await secondPage.goto("/dashboard/friends");
      await expect(secondPage.getByRole("heading", { name: "Compare traces, not people." })).toBeVisible();
      await Promise.all([
        secondPage.waitForResponse((response) => response.url().endsWith("/v1/me/profile") && response.request().method() === "PATCH"),
        secondPage.getByRole("switch", { name: "Friend comparisons" }).click()
      ]);
      await expect(secondPage.getByText("Requests for you")).toBeVisible();
      await secondPage.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(secondPage.getByText("Ready to compare")).toBeVisible();
      await secondPage.getByRole("link", { name: "Compare traces" }).click();

      await expect(secondPage.getByRole("heading", { name: "Two traces. One window." })).toBeVisible();
      await expect(secondPage.getByRole("heading", { name: "Shared date rail" })).toBeVisible();
      await expect(secondPage.getByLabel("Morgan Trace daily activity")).toBeVisible();
      await expect(secondPage.getByLabel("Avery Trace daily activity")).toBeVisible();
      await expect(secondPage.getByText("30-day tokens")).toBeVisible();
      await expect(secondPage.getByText("Only metrics enabled by both friends appear here.")).toBeVisible();
      const traceDay = secondPage.getByRole("button", { name: /Morgan Trace .* tokens/ }).first();
      await traceDay.focus();
      await expect(traceDay).toBeFocused();
      await expect(secondPage.locator(".trace-live-detail")).toContainText("Morgan Trace");
      await expect.poll(() => secondPage.locator(".trace-scroll").evaluate((element) =>
        element.scrollWidth > element.clientWidth
      )).toBe(false);
      await expect.poll(() => secondPage.evaluate(() =>
        document.documentElement.scrollWidth > document.documentElement.clientWidth
      )).toBe(false);

      await secondPage.getByRole("link", { name: "90 days" }).click();
      await expect(secondPage).toHaveURL(/window=90/);
      await expect.poll(() => secondPage.locator(".trace-scroll").evaluate((element) =>
        element.scrollWidth > element.clientWidth
      )).toBe(testInfo.project.name === "mobile");
      if (testInfo.project.name === "mobile") {
        await expect(secondPage.getByText("Scroll to explore 90 days")).toBeVisible();
      }

      await secondPage.getByRole("link", { name: "Back to friends" }).click();
      await secondPage.getByLabel("More actions for Avery Trace").click();
      await secondPage.getByRole("button", { name: "Remove friend" }).click();
      await expect(secondPage.getByRole("dialog", { name: new RegExp(`Remove @${firstHandle}`) })).toBeVisible();
      await expect(secondPage.getByRole("button", { name: "Keep connection" })).toBeFocused();
      await secondPage.getByRole("button", { name: "Keep connection" }).click();
      await expect(secondPage.getByRole("dialog")).toHaveCount(0);
    } finally {
      await secondContext.close();
    }
  } finally {
    await pool.query("DELETE FROM users WHERE id = ANY($1::uuid[])", [[first.id, second.id]]);
  }
});
