import { expect, test } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";
import { expectFramed } from "./scene-framing";

// The "Diorama" render style: same Build, parts and interactions, a different look. Software WebGL.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

test("3D Studio: Diorama, the default style, is a cutaway on a plinth with the same parts and interactions", async ({
  page,
}) => {
  test.setTimeout(150_000);
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
  const styles = page.getByRole("group", { name: "Render style" });
  await expect(scene).toHaveAttribute("data-render-style", "diorama");
  // Studio first (Diorama is the default), to compare the same build in both looks.
  await styles.getByRole("button", { name: "Studio" }).click();
  await expect(scene).toHaveAttribute("data-render-style", "studio");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  const before = {
    models: await scene.getAttribute("data-reference-models"),
    slots: await scene.getAttribute("data-slot-models"),
    disclosure: (await page.locator(".v3-scene-disclosure").textContent()) ?? "",
  };

  await styles.getByRole("button", { name: "Diorama" }).click();
  await expect(styles.getByRole("button", { name: "Diorama" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(scene).toHaveAttribute("data-render-style", "diorama");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  // Same parts, models and disclosure: only the look changed.
  await expect(scene).toHaveAttribute("data-reference-models", before.models!);
  await expect(scene).toHaveAttribute("data-slot-models", before.slots!);
  await expect(page.locator(".v3-scene-disclosure")).toHaveText(before.disclosure);
  await expect(scene).toHaveAttribute("data-cables", "atx-24-pin gpu-16-pin");

  // Cutaway by default; the side panel goes back on with a switch.
  await expect(scene).toHaveAttribute("data-side-panel", "removed");
  const panel = page.getByRole("checkbox", { name: "Show side panel" });
  await panel.check();
  await expect(scene).toHaveAttribute("data-side-panel", "shown");
  await panel.uncheck();
  await expect(scene).toHaveAttribute("data-side-panel", "removed");

  // Focus and swap work as in the studio; labels and the card stay usable.
  await page.locator('.v3-scene-callout[data-scene-slot="gpu"] button').click();
  await expectFramed(page, "gpu");
  await expect(page.locator(".v3-focus-card .v3-replace-card")).toBeVisible();
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Exploded", exact: true }).click();
  await page.locator('.v3-scene-callout[data-scene-slot="memory"] button').click();
  await expectFramed(page, "memory");
  await page.keyboard.press("Escape");
  await expect(scene).not.toHaveAttribute("data-focus-slot", /.+/);

  // The choice is remembered in this browser, Studio included.
  await page
    .getByRole("group", { name: "Render style" })
    .getByRole("button", { name: "Studio" })
    .click();
  await expect(page.locator(".v3-scene-canvas")).toHaveAttribute("data-render-style", "studio");
  await expect(page.getByRole("checkbox", { name: "Remove side panel" })).toBeVisible();
  await page.reload();
  await expect(page.locator(".v3-scene-canvas")).toHaveAttribute("data-render-style", "studio", {
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});
