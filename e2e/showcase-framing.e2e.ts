import { expect, test } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";
import { expectFramed } from "./scene-framing";

// E2: clicking any part presents it the same way in Standard and Exploded: out of the case, best
// face forward, framed beside the replace card. Software WebGL so it runs anywhere.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

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
