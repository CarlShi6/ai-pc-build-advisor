import { expect, test } from "@playwright/test";
import { clickUntil, openReady, selectedCount, signInTestUser } from "./helpers";

// EP-06: Describe wizard → recommendation preview with honest notes → explicit confirm.
test("Describe recommends eight parts and says what it couldn't honor", async ({ page }) => {
  await signInTestUser(page);
  await openReady(page, "/start/describe");
  await page.getByLabel("Local AI").check();
  await page.getByLabel("Look").selectOption("white");
  await clickUntil(page.getByRole("button", { name: "Preview recommended parts" }), async () => {
    await expect(page.getByText("Recommended parts · not applied")).toBeVisible();
  });
  const preview = page.locator(".v3-image-build-preview");
  await expect(preview.locator("li").filter({ hasText: /^(Case|GPU|Power supply):/ })).toHaveCount(
    3,
  );
  await expect(preview.getByText(/White look not applied/)).toBeVisible();
  await expect(preview.getByText(/seed prices, not live offers/)).toBeVisible();

  await page.getByRole("button", { name: "Use these parts and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("heading", { name: "Description draft" })).toBeVisible();
  await expect(selectedCount(page)).toHaveText("8 / 8");
});

// Privacy control: a saved build can be deleted from v3 My Builds.
test("My Builds deletes a saved build after confirmation", async ({ page }) => {
  await signInTestUser(page);
  await openReady(page, "/start/blank");
  await clickUntil(page.getByRole("button", { name: /Create draft/ }), async () => {
    await expect(page).toHaveURL(/\/studio$/);
  });
  await page.getByRole("button", { name: "Save build" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to My Builds" })).toBeVisible();

  await openReady(page, "/my-builds");
  await clickUntil(page.getByRole("button", { name: "Delete Untitled build" }), async () => {
    await expect(page.getByRole("group", { name: "Confirm delete" })).toBeVisible();
  });
  await page.getByRole("button", { name: "Delete permanently" }).click();
  await expect(page.getByText("Deleted “Untitled build”.")).toBeVisible();
  await expect(page.getByText("No saved builds yet.")).toBeVisible();
});
