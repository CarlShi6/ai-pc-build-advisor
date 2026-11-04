import { expect, test } from "@playwright/test";
import {
  choosePartInDetail,
  clickUntil,
  fixtureImage,
  openReady,
  selectedCount,
  signInTestUser,
  slotRow,
} from "./helpers";

// PRD §19.3 #7: AI unavailable → clear error → manual fallback.
test("image analysis unavailable falls back to a manual draft", async ({ page }) => {
  await signInTestUser(page);
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles(fixtureImage);
  await clickUntil(page.getByRole("button", { name: "Analyze image" }), async () => {
    await expect(page.getByText(/Image analysis is not configured here/)).toBeVisible();
  });
  // Said once, Retry hidden (it cannot help), and Describe offered as the main way on.
  const unavailable = page.getByRole("status", { name: "Photo reading unavailable" });
  await expect(unavailable.locator("p").first()).toHaveText(
    "Image analysis is not configured here. You can continue manually.",
  );
  await expect(page.getByRole("button", { name: /Retry analysis|Analyze image/ })).toHaveCount(0);
  await expect(unavailable.getByRole("link", { name: "Describe your dream PC" })).toHaveClass(
    /v3-primary/,
  );
  await page.getByRole("button", { name: "Continue manually" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(selectedCount(page)).toHaveText("0 / 8");
});

// PRD §19.3 #5 and #6: cancel changes nothing; the 2D view is fully usable for edits.
test("cancel leaves the build unchanged; confirm in 2D view updates the build", async ({
  page,
}) => {
  await signInTestUser(page);
  await openReady(page, "/start/blank");
  await clickUntil(page.getByRole("button", { name: /Create draft/ }), async () => {
    await expect(page).toHaveURL(/\/studio$/);
  });
  await page.getByRole("button", { name: "2D view" }).click();

  await slotRow(page, "CPU").click();
  const cpu = await page
    .locator("label.v3-field", { hasText: "Choose a catalog part" })
    .locator("option")
    .nth(1)
    .textContent();
  await choosePartInDetail(page, cpu!.trim());
  await page.getByRole("button", { name: "Cancel preview" }).click();
  await expect(selectedCount(page)).toHaveText("0 / 8");
  await expect(page.getByRole("status").filter({ hasText: "Not saved yet" })).toBeVisible();

  await choosePartInDetail(page, cpu!.trim());
  await page.getByRole("button", { name: "Confirm selection" }).click();
  await expect(selectedCount(page)).toHaveText("1 / 8");
  await expect(slotRow(page, "CPU").locator("small")).toHaveText(cpu!.trim());
});

// PRD §19.3 #8: a stale tab can't silently overwrite a newer save.
test("a stale tab gets a save conflict instead of overwriting", async ({ page, context }) => {
  await signInTestUser(page);
  await openReady(page, "/start/blank");
  await clickUntil(page.getByRole("button", { name: /Create draft/ }), async () => {
    await expect(page).toHaveURL(/\/studio$/);
  });
  await page.getByRole("button", { name: "Save build" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to My Builds" })).toBeVisible();

  // A second tab opens the same save, changes it and saves first.
  const other = await context.newPage();
  await openReady(other, "/my-builds");
  await clickUntil(other.getByRole("button", { name: /Open in Studio/ }).first(), async () => {
    await expect(other).toHaveURL(/\/studio$/);
  });
  await choosePartInDetail(other, "NZXT H5 Flow");
  await other.getByRole("button", { name: "Confirm selection" }).click();
  await other.getByRole("button", { name: "Save changes" }).click();
  await expect(other.getByRole("status").filter({ hasText: "Saved to My Builds" })).toBeVisible();

  // The first tab is now stale.
  await choosePartInDetail(page, "Corsair 4000D Airflow");
  await page.getByRole("button", { name: "Confirm selection" }).click();
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByRole("group", { name: "Resolve save conflict" })).toBeVisible();
  await page.getByRole("button", { name: "Open saved version" }).click();
  await expect(slotRow(page, "Case").locator("small")).toHaveText("NZXT H5 Flow");
  await expect(page.getByRole("status").filter({ hasText: "Saved to My Builds" })).toBeVisible();
});

// A careful read takes about 35 s: the wait names the step being read and the elapsed time.
test("the analysis wait shows what is being read, not a blank spinner", async ({ page }) => {
  test.setTimeout(45_000);
  await page.route("**/api/image-analyses", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 8_000));
    await route.abort();
  });
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles(fixtureImage);
  await page.getByRole("button", { name: "Analyze image" }).click();
  const wait = page.locator(".v3-analysis-wait");
  await expect(wait.locator(".v3-analysis-status")).toContainText("Reading the case…");
  await expect(wait.getByRole("listitem")).toHaveCount(6);
  await expect(wait).toContainText("not live progress");
  await expect(wait.locator(".v3-analysis-status")).toContainText("Reading the graphics card…", {
    timeout: 8_000,
  });
  await expect(wait.locator('li[aria-current="step"]')).toHaveText("Reading the graphics card");
});
