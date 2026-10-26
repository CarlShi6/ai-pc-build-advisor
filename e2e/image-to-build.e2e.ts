import { expect, test } from "@playwright/test";
import {
  clickUntil,
  compatibility,
  fixtureImage,
  openReady,
  selectedCount,
  signInTestUser,
  slotRow,
} from "./helpers";

// PRD §19.3 #1 and #3, using the development fixture (no AI call; the live provider is deferred).
test("image → observations → review → draft → Studio → save keeps unknowns unknown", async ({
  page,
}) => {
  await signInTestUser(page);
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles(fixtureImage);
  const loadFixture = page.getByRole("button", { name: "Load local fixture (no AI call)" });
  await clickUntil(loadFixture, async () => {
    await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
  });

  // Choose a GPU candidate only; the visible case stays unresolved, hidden parts unselected.
  const gpuSet = page.locator(".v3-candidate-set", {
    has: page.getByRole("heading", { name: "GPU" }),
  });
  await gpuSet.getByRole("button", { name: "Confirm planned option" }).first().click();
  await expect(
    gpuSet.getByText(/Planned option: .*Original photo identity remains unverified/),
  ).toBeVisible();

  await page.getByRole("button", { name: "Preview Build draft" }).click();
  await expect(page.getByText("Full draft preview · not applied")).toBeVisible();
  await page.getByRole("button", { name: "Confirm and open Build Studio" }).click();

  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByText("Reference-photo draft")).toBeVisible();
  await expect(selectedCount(page)).toHaveText("1 / 8");
  await expect(slotRow(page, "GPU").locator(".v3-slot-status")).toHaveText("Selected");
  await expect(slotRow(page, "Case").locator(".v3-slot-status")).toHaveText("Review");
  await expect(slotRow(page, "Power supply").locator(".v3-slot-status")).toHaveText("Add part");
  // An incomplete build never reports an overall pass.
  await expect(compatibility(page)).toHaveText("Incomplete");

  await page.getByRole("button", { name: "Save build" }).click();
  await expect(page.getByRole("status").filter({ hasText: "Saved to My Builds" })).toBeVisible();

  // Reopen from My Builds: unknowns and selection are restored as saved.
  await openReady(page, "/my-builds");
  await clickUntil(page.getByRole("button", { name: /Open in Studio/ }).first(), async () => {
    await expect(page).toHaveURL(/\/studio$/);
  });
  await expect(selectedCount(page)).toHaveText("1 / 8");
  await expect(slotRow(page, "Case").locator(".v3-slot-status")).toHaveText("Review");
  await expect(compatibility(page)).toHaveText("Incomplete");
});

// Demo track week 1: the home hero is the photo entry (PRD §4.2).
test("home hero upload runs the same image → Build flow", async ({ page }) => {
  await signInTestUser(page);
  await openReady(page, "/");
  await expect(page.getByText("Upload a PC photo")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Other ways to start" })).toContainText(
    "Describe your dream PC",
  );
  await page.locator("input[type=file]").setInputFiles(fixtureImage);
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );
  await page.getByRole("button", { name: "Preview Build draft" }).click();
  await page.getByRole("button", { name: "Confirm and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByText("Reference-photo draft")).toBeVisible();
  await expect(compatibility(page)).toHaveText("Incomplete");
});
