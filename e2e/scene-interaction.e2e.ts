import { expect, test, type Page } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// Hover, keyboard and selection feedback, the first-visit hint, and exploded labels, in both
// render styles. Software WebGL so it runs anywhere.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

async function openSample(page: Page) {
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  return scene;
}

/** Sweeps the mouse over the middle of the canvas until it rests on a part. */
async function hoverAnyPart(page: Page) {
  const scene = page.locator(".v3-scene-canvas");
  let box = (await scene.locator("canvas").boundingBox())!;
  await expect(async () => {
    // Measured each try: a style switch remounts the canvas, which starts at its 300 x 150 default.
    box = (await scene.locator("canvas").boundingBox())!;
    expect(box.width).toBeGreaterThan(600);
    for (let y = 0.3; y <= 0.75; y += 0.05)
      for (let x = 0.35; x <= 0.65; x += 0.05) {
        await page.mouse.move(box.x + box.width * x, box.y + box.height * y);
        if (await scene.getAttribute("data-hover-slot")) return;
      }
    throw new Error("no part under the mouse yet");
  }).toPass({ timeout: 30_000 });
  return box;
}

async function labelOverlaps(page: Page) {
  const rects = await page
    .locator(".v3-scene-callout")
    .evaluateAll((elements) =>
      elements
        .filter((element) => (element as HTMLElement).offsetParent !== null)
        .map((element) => element.getBoundingClientRect().toJSON() as DOMRect),
    );
  let overlaps = 0;
  for (const [index, a] of rects.entries())
    for (const b of rects.slice(index + 1))
      if (a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom)
        overlaps += 1;
  return overlaps;
}

test("3D Studio: hover, Tab and click each show which part they mean", async ({ page }) => {
  test.setTimeout(150_000);
  const scene = await openSample(page);

  // First visit: a light hint, closed for good with ×.
  const hint = page.getByRole("status").filter({ hasText: "Click a part to inspect it" });
  await expect(hint).toBeVisible();
  await hint.getByRole("button", { name: "Dismiss hint" }).click();
  await expect(hint).toHaveCount(0);

  for (const style of ["Diorama", "Studio"]) {
    await page
      .getByRole("group", { name: "Render style" })
      .getByRole("button", { name: style })
      .click();
    await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
    // Hover: a thin outline on that part and a hand cursor; off a part, both go away.
    const box = await hoverAnyPart(page);
    expect(await scene.evaluate((element) => (element as HTMLElement).style.cursor)).toBe(
      "pointer",
    );
    await page.mouse.move(box.x + 8, box.y + box.height - 8);
    await expect(scene).not.toHaveAttribute("data-hover-slot", /.+/);
    expect(await scene.evaluate((element) => (element as HTMLElement).style.cursor)).toBe("");

    // Keyboard: focusing a part's label outlines that part the same way.
    const memory = page.locator('.v3-scene-callout[data-scene-slot="memory"] button');
    await memory.focus();
    await expect(scene).toHaveAttribute("data-hover-slot", "memory");
    await memory.blur();
    await expect(scene).not.toHaveAttribute("data-hover-slot", /.+/);

    // Click: the part is selected (bold outline, its label marked) and stays so after closing.
    await page.locator('.v3-scene-callout[data-scene-slot="gpu"] button').click();
    await expect(scene).toHaveAttribute("data-selected-slot", "gpu");
    await page.keyboard.press("Escape");
    await expect(scene).toHaveAttribute("data-selected-slot", "gpu");
    await expect(page.locator('.v3-scene-callout[data-scene-slot="gpu"]')).toHaveClass(/active/);
  }

  // The hint stays closed on the next visit.
  await page.reload();
  await expect(page.locator(".v3-scene-canvas canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByText("Click a part to inspect it")).toHaveCount(0);
});

test("3D Studio: Diorama explodes from above with labels that never overlap", async ({ page }) => {
  test.setTimeout(150_000);
  const scene = await openSample(page);
  await expect(scene).toHaveAttribute("data-render-style", "diorama");
  await page.getByRole("button", { name: "Exploded", exact: true }).click();
  for (const amount of ["0", "25", "50", "75", "100"]) {
    await page.locator('input[type="range"]').fill(amount);
    // The camera keeps looking down at the diorama angle while it refits.
    await expect
      .poll(async () => Number(await scene.getAttribute("data-camera-elevation")), {
        timeout: 20_000,
        message: `elevation at ${amount}%`,
      })
      .toBeGreaterThanOrEqual(25);
    await expect.poll(() => labelOverlaps(page), { message: `labels at ${amount}%` }).toBe(0);
  }
});
