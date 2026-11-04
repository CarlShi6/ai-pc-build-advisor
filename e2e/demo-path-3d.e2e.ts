import { expect, test } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// Demo track week 4: the 3D half of the demo path, with software WebGL so it runs anywhere.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

test("3D Studio: click a part, swap it in the focus card, and see it in the shopping plan", async ({
  page,
}) => {
  // Software WebGL is slow when the whole suite runs; this flow once timed out there.
  test.setTimeout(150_000);
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );

  // The scene loads, starts in a quality tier, and labels the reconstructed parts.
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 60_000 });
  await expect(scene).toHaveAttribute("data-scene-quality", /^(high|low)$/);
  await expect(page.locator('.v3-scene-disclosure [data-kind="reference"]')).toHaveText(
    "Reference reconstruction: Case, Motherboard, Cooler, GPU, Memory",
  );

  // Click the GPU's 3D label: the part is shown on its own and the focus card opens beside it.
  // The label follows the camera, so a click during a slow first frame is retried.
  await clickUntil(page.locator('.v3-scene-callout[data-scene-slot="gpu"] button'), async () => {
    await expect(page.getByRole("button", { name: /Show full build/ })).toBeVisible({
      timeout: 3_000,
    });
  });
  const card = page.locator(".v3-focus-card .v3-replace-card");
  await expect(card).toContainText("MSI GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE");
  await clickUntil(
    card.getByRole("button", { name: /ASUS PRIME GeForce RTX 5070 White/ }),
    async () => {
      await expect(card.getByRole("button", { name: /Confirm/ }).first()).toBeVisible({
        timeout: 3_000,
      });
    },
  );
  await card
    .getByRole("button", { name: /Confirm/ })
    .first()
    .click();

  // Labels step aside while a part is shown; after closing, the GPU label names the swap.
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Show full build/ })).toHaveCount(0);
  await expect(
    page.locator('.v3-scene-callout[data-scene-slot="gpu"]').getByText(/PRIME GeForce RTX 5070/),
  ).toBeVisible();

  const gpuRow = page.locator(".v3-plan-row").filter({ hasText: "GPU" }).first();
  await gpuRow.scrollIntoViewIfNeeded();
  await expect(gpuRow).toContainText("ASUS PRIME GeForce RTX 5070 White OC Edition");
  await expect(gpuRow).toContainText("$919.99");
});

test("3D Studio: the white showcase AIO, memory and board render as labeled reference models", async ({
  page,
}) => {
  test.setTimeout(90_000);
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
  await expect(scene).toHaveAttribute(
    "data-reference-models",
    "case motherboard cooler gpu memory",
  );

  // Diorama (the default) is a cutaway; in Studio the camera looks in past the glass and a
  // toggle removes the side panel.
  await expect(scene).toHaveAttribute("data-render-style", "diorama");
  await expect(scene).toHaveAttribute("data-side-panel", "removed");
  await page
    .getByRole("group", { name: "Render style" })
    .getByRole("button", { name: "Studio" })
    .click();
  await expect(scene).toHaveAttribute("data-side-panel", "shown");
  const panelToggle = page.getByRole("checkbox", { name: "Remove side panel" });
  await panelToggle.check();
  await expect(scene).toHaveAttribute("data-side-panel", "removed");
  await panelToggle.uncheck();
  await expect(scene).toHaveAttribute("data-side-panel", "shown");

  // Each focused model says what it is: a reference reconstruction, never a real model.
  for (const slot of ["cooler", "memory", "motherboard"]) {
    await page.locator(`.v3-scene-callout[data-scene-slot="${slot}"] button`).click();
    const card = page.locator(".v3-focus-card .v3-replace-card");
    await expect(card.locator(".v3-replace-model")).toHaveText(
      "Reference reconstruction · dimensions from manufacturer specs",
    );
    await expect(card).not.toContainText(/real model/i);
    await page.keyboard.press("Escape");
  }

  // Swapping to memory without published dimensions falls back to generic geometry, labeled so.
  await page.locator('.v3-scene-callout[data-scene-slot="memory"] button').click();
  const card = page.locator(".v3-focus-card .v3-replace-card");
  await card.getByRole("button", { name: /Kingston FURY Beast/ }).click();
  await card
    .getByRole("button", { name: /Confirm/ })
    .first()
    .click();
  await expect(card.locator(".v3-replace-model")).toHaveText("Illustrative geometry");
  await expect(scene).toHaveAttribute("data-reference-models", "case motherboard cooler gpu");
  await expect(page.locator('.v3-scene-disclosure [data-kind="reference"]')).toHaveText(
    "Reference reconstruction: Case, Motherboard, Cooler, GPU",
  );
  await expect(page.locator('.v3-scene-disclosure [data-kind="illustrative"]')).toContainText(
    "Memory",
  );
  expect(errors).toEqual([]);
});
