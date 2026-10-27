import { expect, test } from "@playwright/test";
import { openReady } from "./helpers";

// The old workspace is hidden from the main navigation, but its route still loads.
test("main navigation hides the old workspace; /legacy-workspace still opens", async ({ page }) => {
  for (const path of ["/", "/my-builds", "/studio"]) {
    await openReady(page, path);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link")).toHaveText(["Explore", "My Builds", "Build Studio"]);
    await expect(nav).not.toContainText("Current Workspace");
    await expect(nav.locator('a[href="/legacy-workspace"]')).toHaveCount(0);
  }

  const response = await page.goto("/legacy-workspace");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("AI PC Build Advisor - Decision Workspace");
});
