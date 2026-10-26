import { expect, test } from "@playwright/test";
import { clickUntil, openReady, selectedCount } from "./helpers";

// Visual redesign slice A: a white photo sample → "Use suggested parts" → confirm → a white Studio.
// The sample is a drawing with a keyless dev fixture (no AI call). Software WebGL for the 3D half.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

const whiteSketch = "e2e/fixtures/white-build-sketch.png";

test("photo sample → use suggested parts → confirm → white case and GPU in Studio", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles(whiteSketch);
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );

  // The change list comes first; nothing is applied yet.
  await page.getByRole("button", { name: "Use suggested parts" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  await expect(changes).toContainText("Suggested parts · preview, not applied");
  const caseRow = changes.locator('tr[data-category="case"]');
  await expect(caseRow).toContainText("(White)");
  await expect(caseRow).toContainText("Weak visual match · appearance only");
  await expect(caseRow).toContainText("White, matches the photo");
  await expect(changes.locator('tr[data-category="gpu"]')).toContainText("White");
  await expect(changes.locator('tr[data-category="motherboard"]')).toContainText(
    "Stays unresolved",
  );
  await expect(changes).toContainText("Incomplete · 3 of 8 slots selected");
  await expect(changes).toContainText("unknown price, not counted");
  await expect(page).toHaveURL(/\/$/);

  await changes
    .getByRole("button", { name: "Confirm suggested parts and open Build Studio" })
    .click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(selectedCount(page)).toHaveText("3 / 8");

  // 3D: the case and GPU are the white catalog parts; the unconfirmed board is drawn from the photo.
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.locator('.v3-scene-callout[data-scene-slot="case"]')).toHaveAttribute(
    "data-color",
    "white",
  );
  await expect(page.locator('.v3-scene-callout[data-scene-slot="gpu"]')).toHaveAttribute(
    "data-color",
    "white",
  );
  const board = page.locator('.v3-scene-callout[data-scene-slot="motherboard"]');
  await expect(board).toHaveAttribute("data-look", "photo");
  await expect(board).toContainText("Appearance from photo · model not confirmed");
  await expect(page.locator(".v3-scene-disclosure")).toContainText(
    "Motherboard: Appearance from photo · model not confirmed",
  );

  // The 2D layout says the same.
  await page.getByRole("button", { name: "2D view" }).click();
  await expect(page.locator('.v3-slot-grid-cards button[data-slot="case"]')).toHaveAttribute(
    "data-color",
    "white",
  );
  await expect(page.locator('.v3-slot-grid-cards button[data-slot="gpu"]')).toHaveAttribute(
    "data-color",
    "white",
  );
});
