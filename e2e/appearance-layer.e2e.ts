import { expect, test, type Page } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// Step A: with no catalog model confirmed, the 3D still looks like the photo. Each part is drawn
// from the photo's appearance parameters, labelled as estimated proportions, never as a model.
// Local samples, no AI call; software WebGL.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

/** Loads a sample and opens the Studio with every suggested part left unconfirmed. */
async function openUnconfirmed(page: Page, file: string) {
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles(`e2e/fixtures/${file}`);
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );
  await page.getByRole("button", { name: "Build it in 3D" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  for (const box of await changes.getByRole("checkbox").all()) await box.uncheck();
  await changes.getByRole("button", { name: "Confirm and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  return scene;
}

test("a black mesh tower with an air cooler is drawn from the photo, not from a model", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  const scene = await openUnconfirmed(page, "black-mesh-tower.png");
  await expect(scene).toHaveAttribute(
    "data-slot-models",
    "case:appearance motherboard:appearance cooler:appearance gpu:appearance memory:appearance",
  );
  await expect(scene).toHaveAttribute("data-reference-models", "");
  for (const slot of ["case", "gpu", "cooler", "memory"]) {
    const label = page.locator(`.v3-scene-callout[data-scene-slot="${slot}"]`);
    await expect(label).toContainText("Appearance from photo · proportions estimated");
  }
  await expect(page.locator('.v3-scene-disclosure [data-kind="photo"]')).toHaveText(
    "Appearance from photo: Case, Motherboard, Cooler, GPU, Memory",
  );
  expect(errors).toEqual([]);
});

test("the white showcase photo draws its top 360 AIO and three-fan card from the photo", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const scene = await openUnconfirmed(page, "white-build-glass-front.png");
  await expect(scene).toHaveAttribute(
    "data-slot-models",
    "case:appearance motherboard:appearance cooler:appearance gpu:appearance",
  );
  // Confirming a catalog model swaps in its reference reconstruction.
  await page.getByRole("button", { name: "2D view" }).click();
  await page
    .locator(".v3-slot-list > button")
    .filter({ has: page.locator(".v3-slot-main", { hasText: /^Case/ }) })
    .click();
  const find = page
    .locator("aside.v3-detail-panel")
    .getByRole("region", { name: "Find this part" });
  await find
    .locator("li", { hasText: "O11 Dynamic EVO (White)" })
    .getByRole("button", { name: "Use this" })
    .click();
  await page
    .locator("aside.v3-detail-panel")
    .getByRole("button", { name: /^Confirm/ })
    .first()
    .click();
  await page.getByRole("button", { name: "3D view" }).click();
  await expect(page.locator(".v3-scene-canvas")).toHaveAttribute(
    "data-slot-models",
    /case:reference/,
  );
});
