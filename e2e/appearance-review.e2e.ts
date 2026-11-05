import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { openMatchDrawer, readIntoStudio } from "./helpers";

// The match drawer's "Appearance from photo" block: the user corrects what the AI read, and the
// Studio draws the corrected look at once. Uses the real-photo-1 replay (gitignored), so it skips
// on machines without it.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

// The gpt-4.1-mini reading of real-photo-1 (a copy one byte longer, so it has its own replay): it
// misread the case, which is what the user corrects here.
const photo = "local-replays/real-photo-1-mini.jpg";
const recorded =
  existsSync(photo) &&
  existsSync(
    `local-replays/${createHash("sha256").update(readFileSync(photo)).digest("hex")}.json`,
  );

test("correcting the case to a dual-chamber showcase redraws it in the Studio", async ({
  page,
}) => {
  test.skip(!recorded, "No real-photo-1 mini replay on this machine.");
  test.setTimeout(90_000);
  let aiCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/image-analyses")) aiCalls += 1;
  });
  await readIntoStudio(page, photo, "/");
  const drawer = await openMatchDrawer(page);
  const look = drawer.getByRole("region", { name: "Appearance from photo" });
  const caseType = look.locator('label[data-path="case.type"]');
  const glass = look.locator('label[data-path="case.glass"]');
  await expect(caseType.locator("small")).toHaveText(/^AI read/);

  await caseType.locator("select").selectOption("dual-chamber");
  await glass.locator("select").selectOption("both");
  await expect(caseType.locator("small")).toHaveText("You set");
  await expect(glass.locator("small")).toHaveText("You set");
  // Fields left alone keep the AI's value.
  await expect(look.locator('label[data-path="gpu.color"] small')).toHaveText(/^AI read/);

  await drawer.getByRole("button", { name: "Close" }).click();
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
