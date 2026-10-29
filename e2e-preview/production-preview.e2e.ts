import { expect, test } from "@playwright/test";
import { clickUntil, openReady } from "../e2e/helpers";

// The production build on local workerd (playwright.preview.config.ts): only the v3 app, builds
// saved in the browser, the privacy page, and the daily cap backed by local D1.

// workerd loads the large server chunks on first use (up to about 30 s locally); warm them once.
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage();
  for (const path of ["/", "/studio", "/my-builds", "/privacy"])
    await page.goto(path, { waitUntil: "load", timeout: 90_000 });
  await page.close();
});

test("pre-v3 pages and APIs answer 404", async ({ page, request }) => {
  for (const path of ["/compare", "/consult", "/dashboard", "/cart", "/checkout/success"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
  }
  for (const path of ["/api/builds/saved", "/api/stripe/webhook", "/api/auth/session"]) {
    const response = await request.get(path);
    expect(response.status(), path).toBe(404);
    expect(await response.json()).toMatchObject({ error: { code: "NOT_FOUND" } });
  }
  await page.goto("/legacy-workspace");
  await expect(page.getByText("Page not found")).toBeVisible();
});

test("the privacy page is linked and says the photo is never stored", async ({ page }) => {
  await openReady(page, "/");
  await page.locator(".v3-footer").getByRole("link", { name: "Privacy" }).click();
  await expect(page).toHaveURL(/\/privacy$/);
  await expect(page.getByRole("heading", { name: "The photo is never stored" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Where your builds are kept" })).toBeVisible();
});

test("over the daily cap, Analyze shows the paused notice and the other starts", async ({
  page,
}) => {
  let reachedProvider = false;
  page.on("response", async (response) => {
    if (response.url().includes("/api/image-analyses"))
      reachedProvider = !(await response.text()).includes("DAILY_CAP_REACHED");
  });
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-sketch.png");
  await page.getByRole("button", { name: "Analyze image" }).click();
  const paused = page.getByRole("status", { name: "Photo reading paused" });
  await expect(paused).toContainText("Photo reading is paused for today");
  await expect(paused.getByRole("link", { name: "Describe your dream PC" })).toHaveAttribute(
    "href",
    "/start/describe",
  );
  await expect(paused.getByRole("link", { name: "Start from scratch (manual)" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Retry analysis" })).toBeDisabled();
  expect(reachedProvider).toBe(false);
});

test("a build is saved in this browser and survives a reload", async ({ page }) => {
  await openReady(page, "/start/blank");
  await clickUntil(page.getByRole("button", { name: /Create draft/ }), async () => {
    await expect(page).toHaveURL(/\/studio$/);
  });
  await page.getByRole("button", { name: "Save build" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to My Builds" })).toBeVisible();
  const stored = await page.evaluate(() => window.localStorage.getItem("aipc-v3-saved-builds"));
  expect(JSON.parse(stored!)).toHaveLength(1);

  await openReady(page, "/my-builds");
  await page.reload();
  await expect(page.getByLabel("Where builds are saved")).toContainText("this browser only");
  await expect(page.getByRole("button", { name: "Delete Untitled build" })).toBeVisible();
  await page.getByRole("button", { name: "Delete Untitled build" }).click();
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("No saved builds yet.")).toBeVisible();
});
