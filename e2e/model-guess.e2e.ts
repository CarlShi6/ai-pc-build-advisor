import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { clickUntil, openReady, selectedCount } from "./helpers";

// Step B: the AI's model guesses and the text it read, shown as guesses. They never choose a
// part, add a price or change the 3D. The real photo replays its gpt-5.4 reading (gitignored
// local-replays/, so it skips elsewhere); the glass-front sample has a guess the catalog holds.
test.use({
  launchOptions: {
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist"],
  },
});

const photo = "local-replays/real-photo-1.jpg";
const replayPath = existsSync(photo)
  ? `local-replays/${createHash("sha256").update(readFileSync(photo)).digest("hex")}.json`
  : "";
const replay =
  replayPath && existsSync(replayPath) ? JSON.parse(readFileSync(replayPath, "utf8")) : null;
const gpuGuess = replay?.raw?.modelGuesses?.find(
  (guess: { category: string }) => guess.category === "gpu",
);

async function loadFixture(page: Page, file: string) {
  await openReady(page, "/");
  await page.locator("input[type=file]").setInputFiles(file);
  await clickUntil(
    page.getByRole("button", { name: "Load local fixture (no AI call)" }),
    async () => {
      await expect(page.getByRole("region", { name: "Catalog candidate review" })).toBeVisible();
    },
  );
}

test("real photo: a GPU guess from visible text, not in the catalog, stays a guess", async ({
  page,
}) => {
  test.skip(!gpuGuess, "No gpt-5.4 replay with model guesses for real-photo-1 on this machine.");
  test.setTimeout(90_000);
  let aiCalls = 0;
  page.on("request", (request) => {
    if (request.url().includes("/api/image-analyses")) aiCalls += 1;
  });
  await loadFixture(page, photo);
  const label = `${gpuGuess.brand} ${gpuGuess.model}`;
  const guesses = page.getByRole("region", { name: "AI model guesses" });
  const gpu = guesses.locator('li[data-guess-category="gpu"]');
  await expect(gpu.locator("strong")).toHaveText(`AI guess: ${label} · not in catalog`);
  await expect(gpu).toContainText("from visible text");
  await expect(gpu.getByRole("link")).toHaveAttribute(
    "href",
    /google\.com\/search\?q=site%3Agigabyte\.com/,
  );
  await expect(gpu.getByRole("link")).toHaveAttribute("target", "_blank");
  // The text it read is listed on its own, as a reading that may be wrong.
  await expect(guesses).toContainText("VISIBLE TEXT · AI READ, MAY BE MISREAD");
  await expect(guesses.getByRole("list", { name: "Visible text" })).toContainText("AERO");
  // Nothing chosen, and no GPU card highlighted from it.
  await expect(page.locator(".v3-candidate-card.chosen")).toHaveCount(0);
  await expect(
    page.locator('.v3-candidate-set[data-category="gpu"] .v3-candidate-card.guessed'),
  ).toHaveCount(0);

  await page.getByRole("button", { name: "Build it in 3D" }).click();
  const changes = page.getByRole("region", { name: "Suggested parts preview" });
  for (const box of await changes.getByRole("checkbox").all()) await box.uncheck();
  await changes.getByRole("button", { name: "Confirm and open Build Studio" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  const scene = page.locator(".v3-scene-canvas");
  await expect(scene.locator("canvas")).toHaveCount(1, { timeout: 30_000 });
  // The 3D is still drawn from the photo's look, and nothing was selected or priced.
  await expect(scene).toHaveAttribute("data-slot-models", /gpu:appearance/);
  await expect(selectedCount(page)).toHaveText("0 / 8");

  // The Studio's GPU slot shows the same guess and text.
  await page.getByRole("button", { name: "2D view" }).click();
  await page
    .locator(".v3-slot-list > button")
    .filter({ has: page.locator(".v3-slot-main", { hasText: /^GPU/ }) })
    .click();
  const find = page
    .locator("aside.v3-detail-panel")
    .getByRole("region", { name: "Find this part" });
  await expect(find.getByRole("region", { name: "AI model guesses" })).toContainText(
    `AI guess: ${label} · not in catalog`,
  );
  await expect(find).toContainText("AERO");
  expect(aiCalls).toBe(0);
});

test("a guess the catalog holds is highlighted, never chosen", async ({ page }) => {
  await loadFixture(page, "e2e/fixtures/white-build-glass-front.png");
  const guess = page
    .getByRole("region", { name: "AI model guesses" })
    .locator('li[data-guess-category="case"]');
  await expect(guess.locator("strong")).toHaveText(
    "AI guess: Lian Li O11 Dynamic EVO · in catalog",
  );
  await expect(guess).toContainText("It is not chosen until you pick it.");
  await expect(guess.getByRole("link")).toHaveCount(0);
  const cases = page.locator('.v3-candidate-set[data-category="case"]');
  const highlighted = cases.locator(".v3-candidate-card.guessed");
  await expect(highlighted.first()).toContainText("Lian Li O11 Dynamic EVO");
  await expect(highlighted.first()).toContainText("Matches AI guess");
  await expect(cases.locator(".v3-candidate-card.chosen")).toHaveCount(0);
  await expect(highlighted.first().getByRole("button", { name: "Use this" })).toBeEnabled();
});
