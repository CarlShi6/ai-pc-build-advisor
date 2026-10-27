import { expect, test } from "@playwright/test";
import { openReady } from "./helpers";

// Old pages (the workspace and the light guided advisor) have no entry anywhere in the v3 app,
// but their routes still load.
const oldPages = [
  { href: "/legacy-workspace", title: "AI PC Build Advisor - Decision Workspace" },
  { href: "/consult", title: "Build Advisor | AI PC Build Advisor" },
];

test("no v3 page links to the old pages; their routes still open", async ({ page }) => {
  for (const path of ["/", "/my-builds", "/studio", "/start/blank"]) {
    await openReady(page, path);
    const nav = page.getByRole("navigation", { name: "Main navigation" });
    await expect(nav.getByRole("link")).toHaveText(["Explore", "My Builds", "Build Studio"]);
    // Nowhere on the page: not in the nav, not in the page body.
    for (const { href } of oldPages)
      await expect(page.locator(`a[href="${href}"]`), `${path} → ${href}`).toHaveCount(0);
    await expect(page.locator("body"), path).not.toContainText(/current workspace|guided advisor/i);
  }

  for (const { href, title } of oldPages) {
    const response = await page.goto(href);
    expect(response?.status(), href).toBe(200);
    await expect(page).toHaveTitle(title);
  }
});
