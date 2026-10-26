import { expect, test } from "@playwright/test";
import { clickUntil, compatibility, openReady, selectedCount } from "./helpers";

// Demo track week 3: one click from the home page to the complete white showcase Build.
test("home opens the white showcase sample as a full draft with honest labels", async ({
  page,
}) => {
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );
  await expect(page.getByRole("heading", { name: "White showcase sample" })).toBeVisible();
  await expect(page.getByText(/motherboard, CPU and SSD are seed parts/)).toBeVisible();
  await expect(selectedCount(page)).toHaveText("8 / 8");
  await expect(compatibility(page)).toHaveText(/^pass$/i);
  // The O11 has no manufacturer price: shown as unknown, never counted as $0.
  await expect(page.getByText(/1 unknown price, not counted/)).toBeVisible();
  await expect(page.locator(".v3-scene-disclosure")).toContainText(
    "Case and GPU: Reference reconstruction · dimensions from manufacturer specs.",
  );
});
