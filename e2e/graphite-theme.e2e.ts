import { expect, test, type Locator } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// Visual redesign slice C: one graphite palette; blue only for clickable or selected, amber only
// for pending, grey dashed only for unselected. 2D view only (no WebGL needed).
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

const accent = "rgb(106, 166, 255)";
const accentStrong = "rgb(47, 111, 214)";
const pending = "rgb(242, 182, 95)";
const unselected = "rgb(125, 134, 144)";

const css = (locator: Locator, property: string) =>
  locator.evaluate((node, name) => getComputedStyle(node).getPropertyValue(name), property);

test("home, review and Studio share the graphite palette and colour meanings", async ({ page }) => {
  await openReady(page, "/");
  expect(await css(page.locator(".v3-app"), "background-color")).toBe("rgb(18, 20, 23)");

  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-glass-front.png");
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );
  // The primary action is the strong blue; a tie (pending) chip is amber and says so in text.
  const use = page.locator('.v3-candidate-set[data-category="case"] .v3-primary').first();
  expect(await css(use, "background-color")).toBe(accentStrong);
  const tieChip = page.locator('.v3-candidate-set[data-category="gpu"] .v3-state-chip');
  await expect(tieChip).toHaveText("Choose one");
  expect(await css(tieChip, "color")).toBe(pending);

  await page.getByRole("button", { name: "Build it in 3D" }).click();
  await page.getByRole("button", { name: "Confirm and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);

  // 2D grid: the selected slot is outlined in blue, a photo-only slot is amber (pending) and an
  // empty slot is grey dashed, each with its own text.
  await page.locator('.v3-slot-grid-cards button[data-slot="case"]').click();
  const caseCard = page.locator('.v3-slot-grid-cards button[data-slot="case"]');
  await expect(caseCard).toHaveClass(/active/);
  expect(await css(caseCard, "border-top-color")).toBe(accent);
  const board = page.locator('.v3-slot-grid-cards button[data-slot="motherboard"]');
  expect(await css(board, "border-top-color")).toBe(pending);
  await expect(board).toContainText("Appearance from photo");
  const cpu = page.locator('.v3-slot-grid-cards button[data-slot="cpu"]');
  expect(await css(cpu, "border-top-style")).toBe("dashed");
  expect(await css(cpu, "border-top-color")).toBe(unselected);
  await expect(cpu).toContainText("Add part");

  await openReady(page, "/my-builds");
  expect(await css(page.locator(".v3-app"), "background-color")).toBe("rgb(18, 20, 23)");
});
