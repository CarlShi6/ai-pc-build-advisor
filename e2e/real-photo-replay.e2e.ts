import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// Real photos, replayed: each photo in local-replays/ with a recorded analysis
// (<sha256>.json, saved by the dev server with IMAGE_REPLAY_DIR) runs the photo flow without
// calling the AI. local-replays/ is gitignored, so on other machines this test skips.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

const dir = "local-replays";
const photos = existsSync(dir)
  ? readdirSync(dir)
      .filter((name) => /\.(jpe?g|png|webp)$/i.test(name))
      .filter((name) => {
        const key = createHash("sha256")
          .update(readFileSync(join(dir, name)))
          .digest("hex");
        return existsSync(join(dir, `${key}.json`));
      })
  : [];

test("real photos replay through the Studio without an AI call", async ({ page }) => {
  test.skip(photos.length === 0, "No recorded real-photo replays on this machine.");
  test.setTimeout(60_000 * Math.max(1, photos.length));
  let aiCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/image-analyses")) aiCalls += 1;
  });
  for (const photo of photos) {
    await openReady(page, "/");
    await page.locator("input[type=file]").setInputFiles(join(dir, photo));
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
    await expect(page.locator(".v3-scene-canvas canvas")).toHaveCount(1, { timeout: 30_000 });
  }
  expect(aiCalls).toBe(0);
});
