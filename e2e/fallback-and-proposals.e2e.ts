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

// The OpenAI account out of credit: the same pause as the daily cap, never a generic error.
test("an AI account out of credit shows the pause and leads to Describe", async ({ page }) => {
  await page.route("**/api/image-analyses", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "PROVIDER_QUOTA_EXHAUSTED",
          message:
            "Photo reading is paused for now. It will be back soon; meanwhile you can describe your PC or build it by hand.",
        },
      }),
    }),
  );
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles(fixtureImage);
  await page.getByRole("button", { name: "Analyze image" }).click();
  const unavailable = page.getByRole("status", { name: "Photo reading unavailable" });
  await expect(unavailable).toContainText("Photo reading is paused for now.");
  await expect(page.getByRole("alert")).toHaveCount(0);
  // A retry cannot help, so it is hidden; Describe is the main way on.
  await expect(page.getByRole("button", { name: /Retry analysis|Analyze image/ })).toHaveCount(0);
  await expect(unavailable.getByRole("link", { name: "Describe your dream PC" })).toHaveClass(
    /v3-primary/,
  );
  await unavailable.getByRole("link", { name: "Describe your dream PC" }).click();
  await expect(page).toHaveURL(/\/start\/describe$/);
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

// Before reading starts, the upload page says what is happening; it never waits there for the
// whole read (that happens in Studio).
test("Analyze says it is starting the read, then answers errors on the upload page", async ({
  page,
}) => {
  await page.route("**/api/image-analyses", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_500));
    await route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: {
          code: "SESSION_RATE_LIMITED",
          message: "Too many photo reads. Try again shortly.",
        },
      }),
    });
  });
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles(fixtureImage);
  await page.getByRole("button", { name: "Analyze image" }).click();
  await expect(page.getByRole("status").filter({ hasText: "starting the read" })).toBeVisible();
  const unavailable = page.getByRole("status", { name: "Photo reading unavailable" });
  await expect(unavailable).toContainText("Too many photo reads.");
  await expect(page).toHaveURL(/\/start\/image$/);
  // Rate limited: Retry stays, as a secondary button.
  await expect(page.getByRole("button", { name: "Retry analysis" })).toHaveClass(/v3-secondary/);
});
