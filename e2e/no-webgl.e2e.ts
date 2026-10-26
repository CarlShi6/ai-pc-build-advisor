import { expect, test } from "@playwright/test";
import { clickUntil, compatibility, openReady, selectedCount } from "./helpers";

// Demo track week 4: with WebGL off, the Studio is fully usable in 2D and never loads 3D code.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

test("without WebGL the 2D layout shows every part and swaps through the replace card", async ({
  page,
}) => {
  const sceneRequests: string[] = [];
  page.on("request", (request) => {
    if (/BuildScene|@react-three|postprocessing/.test(request.url()))
      sceneRequests.push(request.url());
  });
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );

  await expect(page.getByText("3D needs WebGL, which is off in this browser.")).toBeVisible();
  await expect(page.getByRole("button", { name: "3D view" })).toBeDisabled();
  await expect(page.locator("canvas")).toHaveCount(0);
  const cards = page.locator(".v3-slot-grid-cards button");
  await expect(cards).toHaveCount(8);
  const gpu = page.locator('.v3-slot-grid-cards button[data-slot="gpu"]');
  await expect(gpu).toContainText("MSI GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE");
  await expect(page.locator('.v3-slot-grid-cards button[data-slot="case"]')).toContainText(
    "Price unknown · Reference reconstruction",
  );

  await gpu.click();
  const card = page.locator(".v3-slot-grid-card .v3-replace-card");
  await expect(card).toContainText("Reference reconstruction · dimensions from manufacturer specs");
  await card.getByRole("button", { name: /ASUS PRIME GeForce RTX 5070 White/ }).click();
  await card
    .getByRole("button", { name: /Confirm/ })
    .first()
    .click();

  await expect(gpu).toContainText("ASUS PRIME GeForce RTX 5070 White OC Edition");
  await expect(selectedCount(page)).toHaveText("8 / 8");
  await expect(compatibility(page)).toHaveText(/^pass$/i);
  await expect(page.getByText(/\$3,044\.96/).first()).toBeVisible();
  expect(sceneRequests).toEqual([]);
});

test("the 2D Studio fits a phone screen without sideways scrolling", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );
  await expect(page.locator(".v3-slot-grid-cards button")).toHaveCount(8);
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
});
