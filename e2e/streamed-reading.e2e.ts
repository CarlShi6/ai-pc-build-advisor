import { expect, test, type Page } from "@playwright/test";
import { choosePartInDetail, openReady, selectedCount, slotRow } from "./helpers";

// Streamed photo reading: Analyze opens Studio at once, every visible slot waits as "Reading…",
// parts are drawn as they arrive, and what the user does meanwhile is kept. No AI call: the
// local fixture plays as a stream, and live reads are answered by a routed NDJSON stream.
// The 2D view, so no WebGL is needed.
test.use({ launchOptions: { args: ["--disable-webgl", "--disable-webgl2", "--disable-3d-apis"] } });

const visible = ["case", "gpu", "cooler", "memory", "motherboard"];
const hidden = ["cpu", "storage", "psu"];
const card = (page: Page, slot: string) =>
  page.locator(`.v3-slot-grid-cards button[data-slot="${slot}"]`);

const look = {
  case: { type: "dual-chamber", color: "white", glass: "both", orientation: "upright" },
  gpu: { fanCount: "3", length: "long", color: "white", mount: "horizontal", light: "blue" },
  cooler: {
    type: "aio",
    radiatorSize: "360",
    radiatorPosition: "top",
    pumpStyle: "round",
    color: "white",
  },
  fans: { front: "unknown", top: "0", side: "3", bottom: "2", rear: "unknown", ringColor: "blue" },
  memory: { sticks: "2", lightBar: "yes", color: "white" },
  motherboard: { color: "white" },
};

/** Installs the page clock and stops it, so timers only move with runFor. */
async function holdClock(page: Page) {
  const now = Date.now();
  await page.clock.install({ time: now });
  await page.clock.pauseAt(now + 1);
}

/** A finished result as the server sends it in the "done" event. */
const result = {
  analysisId: "e2e-analysis",
  imageId: "e2e-image",
  status: "ready",
  createdAt: "2026-11-04T00:00:00.000Z",
  provider: "openai",
  image: { mime: "image/jpeg", width: 1200, height: 1600 },
  summary: "A white dual-chamber build.",
  quality: "clear",
  qualityIssues: [],
  observations: [],
  unknownPartIdentities: [
    "case",
    "motherboard",
    "cpu",
    "cooler",
    "gpu",
    "memory",
    "storage",
    "psu",
  ],
  absentParts: [],
  appearance: look,
  modelGuesses: [],
  visibleText: [],
};

/** Answers Analyze with these NDJSON events, after every check (as the server would). */
async function streamAnalysis(page: Page, events: object[]) {
  await page.route("**/api/image-analyses", (route) =>
    route.fulfill({
      status: 200,
      contentType: "application/x-ndjson",
      body: events.map((event) => `${JSON.stringify(event)}\n`).join(""),
    }),
  );
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-sketch.png");
  await page.getByRole("button", { name: "Analyze image" }).click();
  await expect(page).toHaveURL(/\/studio$/);
}

test("Studio opens at once; visible slots read in, and a part the user picks stays", async ({
  page,
}) => {
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-glass-front.png");
  // The page's clock is held, so the read waits at its start until the test moves it on.
  await holdClock(page);
  await page.getByRole("button", { name: "Load local fixture (no AI call)" }).click();
  await expect(page).toHaveURL(/\/studio$/);

  await expect(page.getByRole("status", { name: "Reading the photo" })).toBeVisible();
  for (const slot of visible) {
    await expect(card(page, slot)).toHaveAttribute("data-reading", "true");
    await expect(card(page, slot)).toContainText("Reading…");
  }
  // Hidden parts are left open as usual.
  for (const slot of hidden) {
    await expect(card(page, slot)).not.toHaveAttribute("data-reading", /.*/);
    await expect(card(page, slot)).toContainText("Add part");
  }
  await expect(page.getByRole("button", { name: "Save build" })).toBeDisabled();
  await expect(page.getByText("Save once the photo is read")).toBeVisible();

  // The user picks a GPU while the photo is still being read.
  await slotRow(page, "GPU").click();
  const gpu = (await page
    .locator("label.v3-field", { hasText: "Choose a catalog part" })
    .locator("option")
    .nth(1)
    .textContent())!.trim();
  await choosePartInDetail(page, gpu);
  await page.getByRole("button", { name: "Confirm selection" }).click();
  await expect(selectedCount(page)).toHaveText("1 / 8");

  // Parts arrive one by one, each with a short notice.
  await page.clock.runFor(900);
  await expect(page.getByText("Case found")).toBeVisible();
  await expect(card(page, "case")).not.toHaveAttribute("data-reading", /.*/);
  await page.clock.runFor(3_000);
  await expect(page.getByRole("button", { name: /can be matched to a model/ })).toBeVisible();
  // The later reading never replaced the user's GPU.
  await expect(selectedCount(page)).toHaveText("1 / 8");
  await expect(card(page, "gpu")).toContainText(gpu);
  for (const slot of visible)
    await expect(card(page, slot)).not.toHaveAttribute("data-reading", /.*/);
  await expect(page.getByRole("button", { name: "Save build" })).toBeEnabled();
  // Notices go away on their own.
  await page.clock.runFor(5_000);
  await expect(page.getByText("Case found")).toHaveCount(0);
});

test("when reading stops, found parts stay, the rest open up and Describe leads", async ({
  page,
}) => {
  await streamAnalysis(page, [
    { type: "started" },
    { type: "part", category: "case", value: look.case },
    { type: "error", code: "ANALYSIS_TIMEOUT", message: "Image analysis timed out. Please retry." },
  ]);
  const stopped = page.getByRole("alert", { name: "Photo reading stopped" });
  await expect(stopped).toContainText("Image analysis timed out.");
  await expect(stopped).toContainText("The parts found so far stay.");
  await expect(stopped.getByRole("link", { name: "Describe your dream PC" })).toHaveClass(
    /v3-primary/,
  );
  // The case was drawn; the other slots are no longer waiting and can be chosen by hand.
  await expect(card(page, "case")).toContainText("Identity unresolved");
  for (const slot of ["gpu", "cooler", "memory", "motherboard"]) {
    await expect(card(page, slot)).not.toHaveAttribute("data-reading", /.*/);
    await expect(card(page, slot)).toContainText("Add part");
  }
  await expect(page.getByRole("button", { name: "Save build" })).toBeEnabled();
});

test("a part the full read changes is updated, with a notice", async ({ page }) => {
  await streamAnalysis(page, [
    { type: "started" },
    { type: "part", category: "case", value: look.case },
    { type: "part", category: "gpu", value: { ...look.gpu, color: "black" } },
    { type: "done", result },
  ]);
  await expect(page.getByText("Adjusted after full read")).toBeVisible();
  const draft = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("aipc-v3-active-draft") ?? "null"),
  );
  expect(draft.imageContext.appearance.gpu.color).toBe("white");
  expect(draft.imageContext.summary).toBe("A white dual-chamber build.");
});

/** Plays the glass-front sample's fixture with the page clock held, and reads the case only. */
async function readCaseThenReload(page: Page) {
  await openReady(page, "/start/image");
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-glass-front.png");
  await holdClock(page);
  await page.getByRole("button", { name: "Load local fixture (no AI call)" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  // The case arrives at 700 ms, the graphics card at 860 ms.
  await page.clock.runFor(750);
  await expect(card(page, "case")).not.toHaveAttribute("data-reading", /.*/);
  await page.reload();
}

test("a reload mid-read says reading was interrupted, and the photo can be read again", async ({
  page,
}) => {
  await readCaseThenReload(page);
  const interrupted = page.getByRole("alert", { name: "Reading was interrupted" });
  await expect(interrupted).toBeVisible();
  await expect(interrupted.getByRole("link", { name: "Describe your dream PC" })).toHaveClass(
    /v3-primary/,
  );
  // The case read before the reload stays; the slots not yet read are ordinary manual slots.
  await expect(card(page, "case")).toContainText("Identity unresolved");
  for (const slot of ["gpu", "cooler", "memory", "motherboard"]) {
    await expect(card(page, slot)).not.toHaveAttribute("data-reading", /.*/);
    await expect(card(page, slot)).toContainText("Add part");
  }
  await expect(page.getByRole("button", { name: "Save build" })).toBeEnabled();

  // Reading again fills the same draft in.
  const buildId = await page.evaluate(
    () => JSON.parse(sessionStorage.getItem("aipc-v3-active-draft")!).build.id,
  );
  await interrupted.getByRole("button", { name: "Read the photo again" }).click();
  await expect(page.getByRole("status", { name: "Reading the photo" })).toBeVisible();
  await expect(interrupted).toHaveCount(0);
  await page.clock.runFor(5_000);
  await expect(page.getByRole("button", { name: /can be matched to a model/ })).toBeVisible();
  const draft = await page.evaluate(() =>
    JSON.parse(sessionStorage.getItem("aipc-v3-active-draft")!),
  );
  expect(draft.build.id).toBe(buildId);
  expect(draft.imageContext.reading).toBeUndefined();
  expect(await page.evaluate(() => sessionStorage.getItem("aipc-v3-reading-retry"))).toBeNull();
  // Reloading a finished read shows nothing more.
  await page.reload();
  await expect(page.getByRole("alert", { name: "Reading was interrupted" })).toHaveCount(0);
});

test("reading a photo again goes through the same limits as Analyze", async ({ page }) => {
  await readCaseThenReload(page);
  // Stand in the resized copy a live read would have kept.
  await page.evaluate(() => {
    const id = JSON.parse(sessionStorage.getItem("aipc-v3-active-draft")!).imageContext.analysisId;
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
    sessionStorage.setItem(
      "aipc-v3-reading-retry",
      JSON.stringify({ readingId: id, retry: { kind: "photo", dataUrl } }),
    );
  });
  await page.reload();
  const requests: string[] = [];
  await page.route("**/api/image-analyses", (route) => {
    requests.push(route.request().headers()["accept"] ?? "");
    return route.fulfill({
      status: 429,
      contentType: "application/json",
      body: JSON.stringify({
        error: { code: "DAILY_CAP_REACHED", message: "Photo reading has reached today's limit." },
      }),
    });
  });
  const interrupted = page.getByRole("alert", { name: "Reading was interrupted" });
  await interrupted.getByRole("button", { name: "Read the photo again" }).click();
  await expect(interrupted).toContainText("Photo reading has reached today's limit.");
  expect(requests).toEqual(["application/x-ndjson"]);
  // A retry cannot help today, so the button goes; Describe stays first.
  await expect(interrupted.getByRole("button", { name: "Read the photo again" })).toHaveCount(0);
  await interrupted.getByRole("button", { name: "Dismiss" }).click();
  await expect(interrupted).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("alert", { name: "Reading was interrupted" })).toHaveCount(0);
});
