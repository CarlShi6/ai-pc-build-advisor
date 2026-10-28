import { expect, test, type Page } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// Exploded parts are easy to point at: from the default Diorama camera and from straight above,
// the centre of each part's on-screen box hovers that part, and each part's clickable area is at
// least 40 px. Name chips act like the models. Software WebGL so it runs anywhere.
test.use({
  // The whole scene must be on screen to point at it.
  viewport: { width: 1440, height: 900 },
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

const parts = ["motherboard", "cpu", "cooler", "gpu", "memory", "storage", "psu"] as const;

/**
 * Each part's on-screen box (hit area included), once the camera has settled: the readout
 * refreshes every few frames, which is slow on software WebGL, so three equal reads in a row.
 */
async function settledRects(page: Page) {
  const scene = page.locator(".v3-scene-canvas");
  const reads: string[] = [];
  await expect
    .poll(
      async () => {
        reads.push((await scene.getAttribute("data-slot-rects")) ?? "");
        const last = reads.slice(-3);
        return last.length === 3 && last[0] !== "" && last.every((read) => read === last[0]);
      },
      { timeout: 60_000, intervals: [1500] },
    )
    .toBe(true);
  return JSON.parse(reads.at(-1)!) as Record<string, [number, number, number, number]>;
}

async function expectEveryPartPointable(page: Page, view: string) {
  const scene = page.locator(".v3-scene-canvas");
  const canvas = (await scene.locator("canvas").boundingBox())!;
  const rects = await settledRects(page);
  for (const slot of parts) {
    const [x0, y0, x1, y1] = rects[slot];
    expect(x1 - x0, `${view}: ${slot} clickable width`).toBeGreaterThanOrEqual(40);
    expect(y1 - y0, `${view}: ${slot} clickable height`).toBeGreaterThanOrEqual(40);
    await page.mouse.move(canvas.x + (x0 + x1) / 2, canvas.y + (y0 + y1) / 2);
    await expect(scene, `${view}: hovering ${slot}'s centre`).toHaveAttribute(
      "data-hover-slot",
      slot,
    );
  }
}

test("3D Studio: every exploded part can be pointed at, from the diorama view and from above", async ({
  page,
}) => {
  test.setTimeout(180_000);
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-render-style", "diorama");
  await page.getByRole("button", { name: "Exploded", exact: true }).click();
  await page.locator('input[type="range"]').fill("100");
  await page.locator(".v3-scene-panel").scrollIntoViewIfNeeded();

  await expectEveryPartPointable(page, "diorama view");

  // Straight down: drag up from an empty corner of the canvas until the camera looks from above.
  const canvas = (await scene.locator("canvas").boundingBox())!;
  await page.mouse.move(canvas.x + 40, canvas.y + 130);
  await page.mouse.down();
  await page.mouse.move(canvas.x + 40, canvas.y + canvas.height - 20, { steps: 20 });
  await page.mouse.up();
  await expect
    .poll(async () => Number(await scene.getAttribute("data-camera-elevation")), {
      timeout: 20_000,
    })
    .toBeGreaterThanOrEqual(85);
  await expectEveryPartPointable(page, "from above");

  // A name chip does what clicking the model does.
  await page.locator('.v3-scene-callout[data-scene-slot="memory"] button').click();
  await expect(scene).toHaveAttribute("data-focus-slot", "memory");
  await page.keyboard.press("Escape");
  // The case is picked by its label (its panels let pointing through while exploded).
  await page.locator('.v3-scene-callout[data-scene-slot="case"] button').click();
  await expect(scene).toHaveAttribute("data-focus-slot", "case");
});
