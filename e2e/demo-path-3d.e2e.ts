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
  test.setTimeout(90_000);
  await openReady(page, "/");
  await clickUntil(
    page.getByRole("button", { name: "Try the white showcase sample" }),
    async () => {
      await expect(page).toHaveURL(/\/studio$/);
    },
  );

  // The scene loads, starts in a quality tier, and labels the reconstructed parts.
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-scene-quality", /^(high|low)$/);
  await expect(page.locator(".v3-scene-disclosure")).toContainText(
    "Case, Motherboard, Cooler, GPU and Memory: Reference reconstruction",
  );

  // Click the GPU's 3D label: the part is isolated and the focus card opens beside it.
  await page.locator('.v3-scene-callout[data-scene-slot="gpu"] button').click();
  await expect(page.getByRole("button", { name: /Show full build/ })).toBeVisible();
  const card = page.locator(".v3-focus-card .v3-replace-card");
  await expect(card).toContainText("MSI GeForce RTX 5070 Ti 16G GAMING TRIO OC WHITE");
  await card.getByRole("button", { name: /ASUS PRIME GeForce RTX 5070 White/ }).click();
  await card
    .getByRole("button", { name: /Confirm/ })
    .first()
    .click();

  await expect(
    page.locator('.v3-scene-callout[data-scene-slot="gpu"]').getByText(/PRIME GeForce RTX 5070/),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("button", { name: /Show full build/ })).toHaveCount(0);

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
  await expect(page.locator(".v3-scene-disclosure")).toContainText(
    "Case, Motherboard, Cooler and GPU: Reference reconstruction",
  );
  expect(errors).toEqual([]);
});
