import { expect, type Locator, type Page } from "@playwright/test";

export const fixtureImage = "public/og.png";

/**
 * Mock guests share one session and one saved-build slot, so each flow signs in as its own
 * generated test user against the local mock store (no real credentials).
 */
export async function signInTestUser(page: Page) {
  const email = `e2e-${Date.now()}-${Math.random().toString(16).slice(2)}@example.test`;
  const response = await page.request.post("/api/auth/sign-in", {
    data: { email, password: "e2e-local-only" },
  });
  expect(response.ok()).toBe(true);
}

/** Loads a page and waits until client code is interactive (the first click can be lost before hydration). */
export async function openReady(page: Page, path: string) {
  await page.goto(path);
  await page.waitForLoadState("networkidle");
  await page.waitForFunction(() => document.readyState === "complete");
}

/** Clicks until `done` holds, covering the pre-hydration lost-click case seen in R6. */
export async function clickUntil(target: Locator, done: () => Promise<void>) {
  await expect(async () => {
    await target.click();
    await done();
  }).toPass({ timeout: 15_000 });
}

export function selectedCount(page: Page) {
  return page.locator(".v3-stats > div").first().locator("strong");
}

export function compatibility(page: Page) {
  return page.locator(".v3-stats > div").nth(3).locator("strong");
}

export function slotRow(page: Page, label: string) {
  return page.locator(".v3-slot", {
    has: page.locator("strong", { hasText: new RegExp(`^${label}$`) }),
  });
}

export async function choosePartInDetail(page: Page, partName: string) {
  const field = page.locator("label.v3-field", {
    hasText: /Choose a catalog part|Compare with another part/,
  });
  await field.locator("select").selectOption({ label: partName });
  await expect(page.locator(".v3-proposal").getByText("PREVIEW · NOT APPLIED")).toBeVisible();
}

const matchButton = /can be matched to a model|Photo reading details/;

/**
 * Plays a photo's local fixture or replay into Studio (no AI call, at 2× speed) and waits until
 * the photo has been read in full.
 */
export async function readIntoStudio(page: Page, file: string, path = "/start/image") {
  await openReady(page, path);
  await page.locator("input[type=file]").setInputFiles(file);
  await page.getByLabel("2× speed").check();
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );
  await expect(page.getByRole("button", { name: matchButton })).toBeVisible({ timeout: 30_000 });
}

/** Opens the Studio drawer with the photo review (catalog matches, look, guesses). */
export async function openMatchDrawer(page: Page) {
  await page.getByRole("button", { name: matchButton }).click();
  const drawer = page.getByRole("dialog", { name: "Match parts to a model" });
  await expect(drawer.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
  return drawer;
}
