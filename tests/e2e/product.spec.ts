import { expect, test } from "@playwright/test";
import {
  createAccount,
  createSession,
  findOrCreateOAuthUser,
  pool,
  publishShare,
  updateProfile
} from "../../packages/database/src/index";

test("registration uses the canonical login page", async ({ page }) => {
  await page.goto("/register?error=github_denied");
  await expect(page).toHaveURL(/\/login\?error=github_denied$/);
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with GitHub" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Continue with Google" })).toBeVisible();
});

test("public profile renders the contribution instrument and keyboard grid", async ({ page }) => {
  await page.goto("/maya-builds");
  await expect(page.getByRole("heading", { name: "Maya Chen" })).toBeVisible();
  await expect(page.getByRole("grid", { name: "Daily token activity" })).toBeVisible();
  await expect(page.locator(".activity-cell")).toHaveCount(371);
  await page.getByRole("gridcell").last().focus();
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

test("landing keeps its live heatmap and ends with the session-to-heatmap card", async ({ page }) => {
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

  const install = page.getByRole("region", { name: "Install Agentprint" });
  await expect(install).toContainText("curl -fsSL https://agentprint.tech/install.sh | sh");
  await expect(install).not.toContainText("AGENTPRINT_DOWNLOAD_BASE");
  await expect(install.getByRole("tab", { name: "macOS" })).toHaveAttribute("aria-selected", "true");
  await install.getByRole("tab", { name: "Linux" }).click();
  await expect(install.getByRole("tabpanel", { name: "Linux install command" })).toContainText(
    "curl -fsSL https://agentprint.tech/install.sh | sh"
  );
  await install.getByRole("tab", { name: "Windows" }).click();
  await expect(install.getByRole("tabpanel", { name: "Windows install command" })).toContainText(
    "irm https://agentprint.tech/install.ps1 | iex"
  );
  await expect(install.getByRole("button", { name: "Copy Windows install command" })).toBeVisible();

  const finalCard = page.getByRole("region", { name: "Every session leaves a trace." });
  await expect(finalCard.getByRole("img", { name: "Coding-agent sessions flowing into an activity heatmap" })).toHaveAttribute("src", /sessions-to-heatmap\.webp/);
  await expect(finalCard.getByRole("link", { name: "Open your Agentprint" })).toBeVisible();
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
  await page.getByLabel("Username").fill("maya-builds");
  await expect(page.getByLabel("Handle unavailable")).toBeVisible();
  await page.getByLabel("Username").fill(handle);
  await expect(page.getByLabel("Handle available")).toBeVisible();
  await page.getByRole("button", { name: "Claim profile and continue" }).click();
  await expect(page.getByRole("heading", { name: "Connect your machine." })).toBeVisible();
  await expect(page.getByLabel("Login command", { exact: true })).toContainText(
    "agentprint login --server http://localhost:3000"
  );
  const windowsTab = page.getByRole("tab", { name: "Windows" });
  await windowsTab.click();
  await expect(windowsTab).toHaveAttribute("aria-selected", "true");
  await expect(page.getByText(/install\.ps1/)).toBeVisible();

  const device = await pool.query<{ id: string }>(
    `INSERT INTO devices (user_id, name, platform, agent_version, last_seen_at)
     VALUES ($1, 'Browser test device', 'darwin/arm64', '0.3.0', now())
     RETURNING id`,
    [user.id]
  );
  await page.reload();
  await expect(page.getByRole("heading", { name: "Run your first sync." })).toBeVisible();
  await expect(page.getByLabel("Sync command", { exact: true })).toContainText("agentprint sync");

  await pool.query("UPDATE devices SET last_sync_at = now() WHERE id = $1", [device.rows[0].id]);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your record is live." })).toBeVisible();

  await page.goto("/settings");
  const publicSwitch = page.getByRole("switch", { name: "Public profile" });
  await expect(publicSwitch).not.toBeChecked();
  await publicSwitch.click();
  await expect(publicSwitch).toBeChecked();
  const response = await page.request.get(`/v1/profiles/${handle}`);
  expect(response.ok()).toBeTruthy();
  await page.getByRole("button", { name: "Log out" }).click();
  await expect(page).toHaveURL(/\/$/);
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/login$/);
});

test("OAuth choices preserve a pending device activation path", async ({ page }, testInfo) => {
  await page.goto("/login?next=%2Factivate%3Fcode%3DAAAAAA-BBBBBB");
  await expect(page.getByRole("link", { name: "Create a profile" })).toHaveCount(0);
  if (testInfo.project.name === "desktop") {
    await expect(page.getByTestId("login-artwork")).toBeVisible();
  } else {
    await expect(page.getByTestId("login-artwork")).toBeHidden();
  }
  await expect(page.getByRole("link", { name: "Continue with GitHub" })).toHaveAttribute(
    "href",
    "/api/auth/github?source=login&next=%2Factivate%3Fcode%3DAAAAAA-BBBBBB"
  );
  await expect(page.getByRole("link", { name: "Continue with Google" })).toHaveAttribute(
    "href",
    "/api/auth/google?source=login&next=%2Factivate%3Fcode%3DAAAAAA-BBBBBB"
  );
  await expect(page.getByText("Use the same provider you chose when creating your profile.")).toHaveCount(0);
  await expect(page.getByRole("textbox")).toHaveCount(0);
});

test("friends can connect and compare paired traces", async ({ page, browser }, testInfo) => {
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
    await page.goto("/friends");
    await expect(page.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Friend comparisons" })).toHaveCount(0);
    await expect(page.getByText("Comparisons ready", { exact: true })).toHaveCount(0);
    const addFriendSection = page.getByRole("region", { name: "Add a friend" });
    const initialSearchHeight = (await addFriendSection.boundingBox())?.height;
    await page.getByLabel("Agentprint handle").fill(secondHandle);
    await expect(page.getByText("Morgan Trace")).toBeVisible();
    const resultPopover = page.locator('[data-slot="popover-content"]');
    await expect(resultPopover).toBeVisible();
    expect((await resultPopover.boundingBox())?.width).toBeLessThanOrEqual(361);
    expect((await addFriendSection.boundingBox())?.height).toBe(initialSearchHeight);
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
      await secondPage.goto("/friends");
      await expect(secondPage.getByRole("heading", { name: "Friends", exact: true })).toBeVisible();
      await expect(secondPage.getByRole("switch", { name: "Friend comparisons" })).toHaveCount(0);
      await expect(secondPage.getByText("Requests for you")).toBeVisible();
      await secondPage.getByRole("button", { name: "Accept", exact: true }).click();
      await expect(secondPage.getByText("Ready to compare")).toHaveCount(0);
      await secondPage.getByRole("link", { name: "Compare traces" }).click();

      const comparisonCard = secondPage.getByRole("region", { name: "Activity comparison" });
      await expect(comparisonCard).toBeVisible();
      await expect(comparisonCard).toHaveClass(/bg-panel/);
      await expect(comparisonCard.getByLabel("Friends being compared")).toBeVisible();
      await expect(comparisonCard.getByRole("navigation", { name: "Comparison window" })).toBeVisible();
      await expect(secondPage.getByText("Two traces.")).toHaveCount(0);
      await expect(secondPage.getByRole("heading", { name: "Shared date rail" })).toBeVisible();
      await expect(secondPage.getByLabel("Morgan Trace daily activity")).toBeVisible();
      await expect(secondPage.getByLabel("Avery Trace daily activity")).toBeVisible();
      await expect(secondPage.getByText("30-day tokens")).toBeVisible();
      await expect(secondPage.getByText("Only metrics enabled by both friends appear here.")).toBeVisible();
      const toolRouting = secondPage.getByRole("table", { name: "Coding tool routing comparison" });
      await expect(toolRouting).toBeVisible();
      await expect(toolRouting.getByRole("row")).toHaveCount(3);
      await expect(toolRouting.getByText("0%", { exact: true })).toHaveCount(2);
      await expect(toolRouting.locator("img")).toHaveCount(2);
      const codexFill = toolRouting.getByRole("row").filter({ hasText: "Codex" }).locator('em[style*="width: 100%"]');
      const claudeFill = toolRouting.getByRole("row").filter({ hasText: "Claude Code" }).locator('em[style*="width: 100%"]');
      await expect(codexFill).not.toHaveCSS(
        "background-color",
        await claudeFill.evaluate((element) => getComputedStyle(element).backgroundColor)
      );
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

test("a public shared session is readable, collapsible, and linked from the profile", async ({ page }) => {
  await page.goto("/maya-builds");
  const entry = page.getByRole("link", { name: /Track down the flaky checkout test/ });
  await expect(entry).toBeVisible();
  // Follow the profile's own link rather than clicking it: the site scrolls
  // smoothly, and a mid-scroll hit test is a property of the harness, not the
  // page. The link target is what this test actually cares about.
  const href = await entry.getAttribute("href");
  expect(href).toMatch(/^\/s\/[A-Za-z0-9]{16,32}$/);
  await page.goto(href!);

  await expect(page.getByRole("heading", { name: "Track down the flaky checkout test" })).toBeVisible();
  await expect(page.locator("header").filter({ hasText: "Track down the flaky checkout test" }).locator(":scope > div").first()).toContainText(/Claude Code\s*\/\s*Public/);
  await expect(page.getByRole("region", { name: "Session summary" })).toHaveClass(/rounded-sm.*border/);
  await expect(page.getByText("Shared by")).toBeVisible();
  // The redaction summary is the page's core claim; it must always be present.
  await expect(page.getByText(/credential values? removed/)).toBeVisible();

  // Reasoning and tool details stay compact and independently expandable.
  const reasoning = page.locator("details").filter({ hasText: "One run in four suggests" }).first();
  await expect(reasoning).not.toHaveAttribute("open", "");
  await expect(reasoning.locator("summary")).toContainText("Reasoning");
  const step = page.locator("details").filter({ hasText: "<project>/tests/checkout.spec.ts" }).first();
  await expect(step).not.toHaveAttribute("open", "");
  await step.locator("summary").click();
  await expect(step.getByText("seedCart")).toBeVisible();
  await expect(page.getByText("Tool result")).toHaveCount(0);
  await expect(page.getByText("Final answer", { exact: true })).toBeVisible();
});

test("the session library keeps cards compact and opens the transcript", async ({ page }) => {
  const owner = await pool.query("SELECT user_id FROM profiles WHERE handle = 'maya-builds'");
  const token = await createSession(owner.rows[0].user_id);
  await page.context().addCookies([{ name: "pm_session", value: token, url: "http://localhost:3000" }]);

  await page.goto("/sessions");
  await expect(page.getByRole("heading", { name: "Your shared sessions" })).toBeVisible();

  const session = page.locator("article").filter({ hasText: "Track down the flaky checkout test" });
  await expect(session.getByText("Prompt", { exact: true })).toHaveCount(0);
  await expect(session.getByText(/tool calls?$/)).toHaveCount(0);
  await expect(session.getByText("Final answer", { exact: true })).toHaveCount(0);
  const content = session.locator(":scope > div").first();
  await expect(content.getByText(/10 turns/)).toBeVisible();
  await expect(content.getByText(/293\.7K tokens/)).toBeVisible();
  await expect(content.getByText("39 min", { exact: true })).toBeVisible();
  await expect(content.getByText(/Published/)).toBeVisible();
  await expect(session.locator("footer")).toHaveCount(0);
  expect(await session.getAttribute("class")).not.toContain("border");
  await expect(session.getByText(/views?$/)).toHaveCount(0);
  await expect(session.getByRole("link", { name: "Open" })).toBeVisible();

  await session.getByRole("button", { name: "Sharing" }).click();
  await expect(page.getByText("Who can open this session?")).toBeVisible();
  await content.getByText(/Published/).click();
  await expect(page.getByText("Who can open this session?")).toBeHidden();
});

test("an unlisted session is reachable by link but never listed or indexed", async ({ page, request }) => {
  // A dedicated share, so this test never mutates the seeded public one that
  // other tests read in parallel.
  const owner = await pool.query("SELECT user_id FROM profiles WHERE handle = 'maya-builds'");
  const userId = owner.rows[0].user_id;
  const published = await publishShare(
    { userId },
    {
      schema_version: 1,
      harness_id: "codex",
      session_fingerprint: `e2e-unlisted-${Date.now()}-000000`,
      title: "An unlisted session about caching",
      visibility: "unlisted",
      redaction_level: "balanced",
      redaction: { secrets_removed: 0, paths_rewritten: 0, blocks_truncated: 0, turns_excluded: 0 },
      started_at: "2026-08-14T16:02:00Z",
      ended_at: "2026-08-14T16:12:00Z",
      model_ids: [],
      totals: { input_tokens: 10, output_tokens: 5, total_tokens: 15 },
      turns: [{ index: 0, role: "user", blocks: [{ kind: "text", text: "how does the cache expire" }] }]
    }
  );
  try {
    await page.goto("/maya-builds");
    await expect(page.getByRole("link", { name: /An unlisted session about caching/ })).toHaveCount(0);

    await page.goto(`/s/${published.slug}`);
    await expect(page.getByRole("heading", { name: "An unlisted session about caching" })).toBeVisible();
    await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);

    const api = await request.get(`/v1/shares/${published.slug}`);
    expect(api.headers()["x-robots-tag"]).toContain("noindex");
  } finally {
    await pool.query("DELETE FROM shared_sessions WHERE id = $1", [published.id]);
  }
});

test("an unknown shared session slug is not found", async ({ page }) => {
  const response = await page.goto("/s/aaaaaaaaaaaaaaaaaaaaaa");
  expect(response?.status()).toBe(404);
});
