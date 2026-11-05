import { expect, test, type Page } from "@playwright/test";
import { openMatchDrawer, readIntoStudio, selectedCount } from "./helpers";

// Visual redesign slices A and A2: a white photo sample → Studio → match drawer → confirm → a
// white Studio. The samples are drawings with keyless dev fixtures (no AI call). Software WebGL.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

/** Reads a sample into Studio and opens the match drawer; returns its candidate review. */
async function loadSample(page: Page, file: string) {
  await readIntoStudio(page, `e2e/fixtures/${file}`, "/");
  const drawer = await openMatchDrawer(page);
  return drawer.getByRole("region", { name: "Catalog candidate review" });
}

test("glass-front sample ranks the O11 first; suggested parts keep the photo fans", async ({
  page,
}) => {
  test.setTimeout(90_000);
  const review = await loadSample(page, "white-build-glass-front.png");
  // One disclaimer and tag lines.
  await expect(review.getByRole("note").filter({ hasText: "Visual similarity only" })).toHaveCount(
    1,
  );
  const cases = review.locator('.v3-candidate-set[data-category="case"]');
  await expect(cases.locator(".v3-tag-line")).toHaveText("Tempered glass · White");
  await expect(cases.locator(".v3-state-chip")).toHaveText("Top match");
  await expect(cases.locator(".v3-candidate-card").first()).toContainText(
    "Lian Li O11 Dynamic EVO (White)",
  );
  await cases.getByText("Why this match").first().click();
  await expect(cases).toContainText("Front panel: glass (manufacturer page, verified 2026-10-26)");
  await expect(cases.getByText("Other options (4)")).toBeVisible();
  await expect(cases.locator(".v3-equally-likely")).toHaveCount(0);

  // The white GPUs look the same in the photo: the user picks one.
  const gpus = review.locator('.v3-candidate-set[data-category="gpu"]');
  await expect(gpus.locator(".v3-equally-likely")).toContainText("5 options equally likely");
  await gpus.getByText("Options (5)").click();
  await gpus
    .locator(".v3-candidate-card", { hasText: "MSI" })
    .getByRole("button", { name: "Use this" })
    .click();
  await expect(gpus.locator(".v3-equally-likely")).toHaveCount(0);

  // The change list comes first; nothing is applied yet.
  await page.getByRole("button", { name: "Preview matches" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  await expect(changes).toContainText("Your Build · preview, not applied");
  const caseRow = changes.locator('tr[data-category="case"]');
  await expect(caseRow).toContainText("Lian Li O11 Dynamic EVO (White)");
  await expect(caseRow).toContainText("Top match, filled in");
  await expect(caseRow).toContainText("White, matches the photo");
  await expect(changes.locator('tr[data-category="gpu"]')).toContainText("MSI");
  await expect(changes.locator('tr[data-category="gpu"]')).toContainText("Your choice");
  // The white boards tie (Step C catalog): nothing is picked by name.
  await expect(changes.locator('tr[data-category="motherboard"]')).toContainText(
    "2 options equally likely",
  );
  // The photo's round pump cap rules out the white AIOs with a pump screen, so TITAN leads.
  const coolerRow = changes.locator('tr[data-category="cooler"]');
  await expect(coolerRow).toContainText("Corsair iCUE LINK TITAN 360 RX RGB AIO (White)");
  await expect(coolerRow).toContainText("Top match, filled in");
  await expect(changes).toContainText("Incomplete · 3 of 8 slots selected");
  await expect(changes).toContainText("unknown price, not counted");

  // Filled-in rows can be unticked; the user's own choice has no checkbox.
  await expect(changes.locator('tr[data-category="gpu"] input[type=checkbox]')).toHaveCount(0);
  await expect(caseRow.getByRole("checkbox")).toBeChecked();
  // Untick the cooler: it stays unconfirmed and is drawn from the photo.
  await coolerRow.getByRole("checkbox").uncheck();

  await changes.getByRole("button", { name: "Apply to this build" }).click();
  await expect(page.getByRole("dialog", { name: "Match parts to a model" })).toHaveCount(0);
  await expect(selectedCount(page)).toHaveText("2 / 8");

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
  // The unticked cooler stays unconfirmed and is drawn from the photo.
  await expect(page.locator('.v3-scene-callout[data-scene-slot="cooler"]')).toHaveAttribute(
    "data-look",
    "photo",
  );
  const board = page.locator('.v3-scene-callout[data-scene-slot="motherboard"]');
  await expect(board).toHaveAttribute("data-look", "photo");
  await expect(board).toContainText("Appearance from photo · proportions estimated");
  // Unconfirmed parts are detailed look-alikes in the photo's colour, not models.
  await expect(scene).toHaveAttribute(
    "data-slot-models",
    "case:reference motherboard:appearance cooler:appearance gpu:reference",
  );
  // One short line per kind of geometry, inside the panel.
  const disclosure = page.locator(".v3-scene-disclosure");
  await expect(disclosure.locator('[data-kind="reference"]')).toHaveText(
    "Reference reconstruction: Case, GPU",
  );
  await expect(disclosure.locator('[data-kind="photo"]')).toHaveText(
    "Appearance from photo: Motherboard, Cooler, 5 fans",
  );
  await expect(disclosure.locator('[data-kind="illustrative"]')).toHaveText(
    "Illustrative: CPU, Memory, Storage, Power supply",
  );
  await expect(disclosure).not.toContainText(/generic illustrative geometry/);
  const panel = (await page.locator(".v3-scene-panel").boundingBox())!;
  const line = (await disclosure.boundingBox())!;
  expect(line.y + line.height).toBeLessThanOrEqual(panel.y + panel.height);
  expect(await disclosure.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(
    true,
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

test("a sample that cannot separate the cases shows them as equally likely", async ({ page }) => {
  const review = await loadSample(page, "white-build-sketch.png");
  const cases = review.locator('.v3-candidate-set[data-category="case"]');
  await expect(cases.locator(".v3-equally-likely")).toContainText("5 options equally likely");
  await expect(cases.locator(".v3-candidate-card.chosen")).toHaveCount(0);
  await expect(cases.locator(".v3-state-chip")).toHaveText("Choose one");

  await page.getByRole("button", { name: "Preview matches" }).click();
  const caseRow = page
    .getByRole("region", { name: "Suggested parts preview" })
    .locator('tr[data-category="case"]');
  await expect(caseRow).toContainText("5 options equally likely");
  await expect(caseRow).toContainText("nothing is picked by name");
  await expect(caseRow).toContainText("Choose one in the review");
});

test("a filled-in row can be unticked and stays unconfirmed", async ({ page }) => {
  // Black sample: the all-black DeepCool AK620 ZERO DARK leads the coolers on its own.
  await loadSample(page, "black-mesh-tower.png");
  await page.getByRole("button", { name: "Preview matches" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  const coolerRow = changes.locator('tr[data-category="cooler"]');
  await expect(coolerRow).toContainText("DeepCool AK620 ZERO DARK");
  const coolerBox = coolerRow.getByRole("checkbox");
  await expect(coolerBox).toBeChecked();
  await expect(changes).toContainText("Incomplete · 1 of 8 slots selected");
  await coolerBox.uncheck();
  await expect(coolerRow).toContainText("Top match, not filled in");
  await expect(coolerRow).toContainText("Not filled in; stays unconfirmed");
  await expect(changes).toContainText("Incomplete · 0 of 8 slots selected");
});
