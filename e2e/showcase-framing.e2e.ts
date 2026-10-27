import { expect, test, type Page } from "@playwright/test";
import { FRAME_BOTTOM, FRAME_TOP } from "../src/lib/v3/scene-focus";
import { clickUntil, openReady } from "./helpers";

// E2: clicking any part presents it the same way in Standard and Exploded: out of the case, best
// face forward, framed beside the replace card. Software WebGL so it runs anywhere.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

/** The shown part's on-screen rectangle against the canvas and the free area beside the card. */
async function framing(page: Page) {
  const scene = page.locator(".v3-scene-canvas");
  const rect = await scene.getAttribute("data-focus-rect");
  const canvas = await scene.boundingBox();
  const card = await page.locator(".v3-focus-card").boundingBox();
  if (!rect || !canvas || !card) return null;
  const [x0, y0, x1, y1] = rect.split(" ").map(Number);
  const cardLeft = card.x - canvas.x;
  const freeWidth = cardLeft - 32;
  const freeHeight = canvas.height - FRAME_TOP - FRAME_BOTTOM;
  return {
    fill: Math.max((x1 - x0) / freeWidth, (y1 - y0) / freeHeight),
    ofCanvas: Math.max((x1 - x0) / canvas.width, (y1 - y0) / canvas.height),
    onCanvas: x0 >= 0 && y0 >= 0 && x1 <= canvas.width && y1 <= canvas.height,
    clearOfCard: x1 <= cardLeft,
  };
}

async function expectFramed(page: Page, slot: string) {
  await expect(page.locator(".v3-scene-canvas")).toHaveAttribute("data-focus-slot", slot);
  // The camera eases in (and the case's panels close when it comes from Exploded); wait until the
  // part settles at about two thirds of the free area.
  await expect(async () => {
    const fill = (await framing(page))?.fill ?? 0;
    expect(fill, slot).toBeGreaterThan(0.5);
    expect(fill, slot).toBeLessThan(0.8);
  }).toPass({ timeout: 20_000 });
  const result = (await framing(page))!;
  expect(result.ofCanvas, `${slot} is big enough to see`).toBeGreaterThan(0.3);
  expect(result.onCanvas, `${slot} stays on the canvas`).toBe(true);
  expect(result.clearOfCard, `${slot} is not covered by the card`).toBe(true);
}

test("3D Studio: every clicked part is framed the same way in Standard and Exploded", async ({
  page,
}) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });

  for (const mode of ["Standard", "Exploded"]) {
    await page.getByRole("button", { name: mode, exact: true }).click();
    for (const slot of ["motherboard", "gpu", "memory", "cooler"]) {
      await page.locator(`.v3-scene-callout[data-scene-slot="${slot}"] button`).click();
      await expectFramed(page, slot);
      await expect(page.locator(".v3-focus-card .v3-replace-card")).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(scene).not.toHaveAttribute("data-focus-slot", /.+/);
      await expect(scene).not.toHaveAttribute("data-focus-rect", /.+/);
    }
  }

  // The case is shown whole, with its panels closed; "Show full build" ends it too.
  await page.locator('.v3-scene-callout[data-scene-slot="case"] button').click();
  await expectFramed(page, "case");
  await page.getByRole("button", { name: /Show full build/ }).click();
  await expect(scene).not.toHaveAttribute("data-focus-slot", /.+/);
  expect(errors).toEqual([]);
});
