import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { clickUntil, openReady } from "./helpers";

// The review page's "Appearance from photo" block: the user corrects what the AI read, and the
// Studio draws the corrected look. Uses the real-photo-1 replay (gitignored), so it skips
// on machines without it.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

const photo = "local-replays/real-photo-1.jpg";
const recorded =
  existsSync(photo) &&
  existsSync(
    `local-replays/${createHash("sha256").update(readFileSync(photo)).digest("hex")}.json`,
  );

test("correcting the case to a dual-chamber showcase redraws it in the Studio", async ({
  page,
}) => {
  test.skip(!recorded, "No real-photo-1 replay on this machine.");
  test.setTimeout(90_000);
  let aiCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/image-analyses")) aiCalls += 1;
  });
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles(photo);
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Appearance from photo" })).toBeVisible();
    },
  );
  const look = page.getByRole("region", { name: "Appearance from photo" });
  const caseType = look.locator('label[data-path="case.type"]');
  const glass = look.locator('label[data-path="case.glass"]');
  await expect(caseType.locator("small")).toHaveText(/^AI read/);

  await caseType.locator("select").selectOption("dual-chamber");
  await glass.locator("select").selectOption("both");
  await expect(caseType.locator("small")).toHaveText("You set");
  await expect(glass.locator("small")).toHaveText("You set");
  // Fields left alone keep the AI's value.
  await expect(look.locator('label[data-path="gpu.color"] small')).toHaveText(/^AI read/);

  await page.getByRole("button", { name: "Build it in 3D" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  for (const box of await changes.getByRole("checkbox").all()) await box.uncheck();
  await changes.getByRole("button", { name: "Confirm and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  await expect(scene).toHaveAttribute("data-slot-models", /case:appearance/);
  // A dual-chamber shell: the divider, front glass and side glass are all drawn.
  const structure = (await scene.getAttribute("data-case-structure")) ?? "";
  expect(structure.split(" ").sort()).toEqual(["front-glass", "glass-side-panel", "tray-divider"]);

  // Saved with the draft: the edit and who made it survive a reload.
  const saved = await page.evaluate(() => sessionStorage.getItem("aipc-v3-active-draft"));
  expect(saved).toContain('"dual-chamber"');
  expect(saved).toMatch(/"appearanceUserSet":\[[^\]]*"case\.type"/);
  await page.reload();
  await expect(page.locator(".v3-scene-canvas")).toHaveAttribute(
    "data-case-structure",
    /tray-divider/,
    { timeout: 30_000 },
  );
  expect(aiCalls).toBe(0);
});
