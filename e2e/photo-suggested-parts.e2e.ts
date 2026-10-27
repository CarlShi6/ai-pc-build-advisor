import { expect, test, type Page } from "@playwright/test";
import { clickUntil, openReady, selectedCount } from "./helpers";

// Visual redesign slices A and A2: a white photo sample → "Use suggested parts" → confirm → a
// white Studio. The samples are drawings with keyless dev fixtures (no AI call). Software WebGL.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

async function loadSample(page: Page, file: string) {
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles(`e2e/fixtures/${file}`);
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );
  return page.getByRole("region", { name: "Catalog candidate review" });
}

test("glass-front sample ranks the O11 first; suggested parts keep the photo fans", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const review = await loadSample(page, "white-build-glass-front.png");
  const cases = review.locator('.v3-candidate-set[data-category="case"]');
  await expect(cases.locator(".v3-candidate-card").first()).toContainText(
    "Lian Li O11 Dynamic EVO (White)",
  );
  await expect(cases).toContainText("Front panel: glass (manufacturer page, verified 2026-10-26)");
  await expect(cases.locator(".v3-equally-likely")).toHaveCount(0);

  // The two white GPUs look the same in the photo: the user picks one.
  const gpus = review.locator('.v3-candidate-set[data-category="gpu"]');
  await expect(gpus.locator(".v3-equally-likely")).toContainText("2 options equally likely");
  await gpus
    .locator(".v3-candidate-card", { hasText: "MSI" })
    .getByRole("button", { name: "Confirm planned option" })
    .click();
  await expect(gpus.locator(".v3-equally-likely")).toHaveCount(0);

  // The change list comes first; nothing is applied yet.
  await page.getByRole("button", { name: "Use suggested parts" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  await expect(changes).toContainText("Suggested parts · preview, not applied");
  const caseRow = changes.locator('tr[data-category="case"]');
  await expect(caseRow).toContainText("Lian Li O11 Dynamic EVO (White)");
  await expect(caseRow).toContainText("White, matches the photo");
  await expect(changes.locator('tr[data-category="gpu"]')).toContainText("MSI");
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

  // 3D: white catalog case and GPU; the confirmed case still shows the photo's five fans.
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  const caseCallout = page.locator('.v3-scene-callout[data-scene-slot="case"]');
  await expect(caseCallout).toHaveAttribute("data-color", "white");
  await expect(caseCallout.locator("[data-photo-fans]")).toHaveText(
    "5 fans · Appearance from photo",
  );
  await expect(page.locator('.v3-scene-callout[data-scene-slot="gpu"]')).toHaveAttribute(
    "data-color",
    "white",
  );
  const board = page.locator('.v3-scene-callout[data-scene-slot="motherboard"]');
  await expect(board).toHaveAttribute("data-look", "photo");
  await expect(board).toContainText("Appearance from photo · model not confirmed");
  const disclosure = page.locator(".v3-scene-disclosure");
  await expect(disclosure).toContainText(
    "Motherboard: Appearance from photo · model not confirmed",
  );
  await expect(disclosure).toContainText("Fans (5): Appearance from photo");

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

test("a sample that cannot separate the cases shows them as equally likely", async ({ page }) => {
  const review = await loadSample(page, "white-build-sketch.png");
  const cases = review.locator('.v3-candidate-set[data-category="case"]');
  await expect(cases.locator(".v3-equally-likely")).toContainText("3 options equally likely");
  await expect(cases.locator(".v3-candidate-card.chosen")).toHaveCount(0);

  await page.getByRole("button", { name: "Use suggested parts" }).click();
  const caseRow = page
    .getByRole("region", { name: "Suggested parts preview" })
    .locator('tr[data-category="case"]');
  await expect(caseRow).toContainText("3 options equally likely");
  await expect(caseRow).toContainText("nothing is picked by name");
  await expect(caseRow).toContainText("Choose one in the review");
});
