import { expect, test } from "@playwright/test";
import { openReady } from "./helpers";

// The old workspace has no entry anywhere in the v3 app, but its route still loads.
test("no page links to the old workspace; /legacy-workspace still opens", async ({ page }) => {
  for (const path of ["/", "/my-builds", "/studio", "/start/blank"]) {
    await openReady(page, path);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link")).toHaveText(["Explore", "My Builds", "Build Studio"]);
    // Nowhere on the page: not in the nav, not in the page body.
    await expect(page.locator('a[href="/legacy-workspace"]'), path).toHaveCount(0);
    await expect(page.locator("body"), path).not.toContainText(/current workspace/i);
  }

  const response = await page.goto("/legacy-workspace");
  expect(response?.status()).toBe(200);
  await expect(page).toHaveTitle("AI PC Build Advisor - Decision Workspace");
});
