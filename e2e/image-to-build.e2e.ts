import { expect, test } from "@playwright/test";
import {
  clickUntil,
  compatibility,
  fixtureImage,
  openMatchDrawer,
  openReady,
  readIntoStudio,
  selectedCount,
  signInTestUser,
  slotRow,
} from "./helpers";

// PRD §19.3 #1 and #3, using the development fixture (no AI call).
test("image → Studio → match drawer → save keeps unknowns unknown", async ({ page }) => {
  await signInTestUser(page);
  await openReady(page, "/start/image");
  // Photo drafts ask for no target budget.
  await expect(page.getByLabel(/Target budget/)).toHaveCount(0);
  await readIntoStudio(page, fixtureImage);
  await expect(page.getByText("Reference-photo draft")).toBeVisible();
  // Nothing is chosen for the user: the photo only draws the look.
  await expect(selectedCount(page)).toHaveText("0 / 8");

  // Choose a GPU from the tie; the cases also tie, so the visible case stays unresolved and the
  // hidden parts unselected.
  const drawer = await openMatchDrawer(page);
  const gpuSet = drawer.locator('.v3-candidate-set[data-category="gpu"]');
  // Five GPUs tie on this photo, so they sit folded instead of ranked.
  await expect(gpuSet).toContainText("5 options equally likely");
  await gpuSet.getByText("Options (5)").click();
  await gpuSet.getByRole("button", { name: "Use this" }).first().click();
  await expect(gpuSet.locator(".v3-state-chip")).toHaveText("Your choice");
  await expect(gpuSet.getByRole("button", { name: "Using this ✓" })).toBeDisabled();

  await drawer.getByRole("button", { name: "Preview matches" }).click();
  await expect(drawer.getByText("Your Build · preview, not applied")).toBeVisible();
  await drawer.getByRole("button", { name: "Apply to this build" }).click();
  await expect(drawer).toHaveCount(0);

  await expect(selectedCount(page)).toHaveText("1 / 8");
  await expect(slotRow(page, "GPU").locator(".v3-slot-status")).toHaveText("Selected");
  await expect(slotRow(page, "Case").locator(".v3-slot-status")).toHaveText("Review");
  await expect(slotRow(page, "Power supply").locator(".v3-slot-status")).toHaveText("Add part");
  // An incomplete build never reports an overall pass.
  await expect(compatibility(page)).toHaveText("Incomplete");
  // No budget was set: no budget card, no $0 budget, no over/under-budget text.
  const plan = page.locator("section.v3-plan");
  await expect(plan).not.toContainText("BUDGET");
  await expect(plan).not.toContainText(/over budget|under budget|exceed budget/);

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
  // Still no budget after the save round trip.
  await expect(page.locator("section.v3-plan")).not.toContainText("BUDGET");
  // The saved draft keeps the full read, so its matches can still be reviewed.
  await expect(page.getByRole("button", { name: /can be matched to a model/ })).toBeVisible();
});

// Demo track week 1: the home hero is the photo entry (PRD §4.2).
test("home hero upload reads the photo into Studio the same way", async ({ page }) => {
  await signInTestUser(page);
  await openReady(page, "/");
  await expect(page.getByText("Upload a PC photo")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Other ways to start" })).toContainText(
    "Describe your dream PC",
  );
  await readIntoStudio(page, fixtureImage, "/");
  await expect(page.getByText("Reference-photo draft")).toBeVisible();
  await expect(compatibility(page)).toHaveText("Incomplete");
});
