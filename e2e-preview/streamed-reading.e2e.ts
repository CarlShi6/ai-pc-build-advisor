import { expect, test } from "@playwright/test";
import { openReady } from "../e2e/helpers";

// Streamed photo reading through the production build on local workerd (nitro → h3 → the API
// router), with the local fake provider (fake-provider.mjs, port 8790) behind the worker on 8789.
// It shows the worker passes events on as they come, not all at the end.
const STREAM = "http://127.0.0.1:8789";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage();
  for (const path of ["/", "/studio"])
    await page.goto(`${STREAM}${path}`, { waitUntil: "load", timeout: 90_000 });
  await page.close();
});

test("the worker streams each part as it is read, then the result", async ({ page }) => {
  await openReady(page, `${STREAM}/start/image`);
  // Read the stream in the page, noting when each event arrives.
  const arrivals = await page.evaluate(async () => {
    const png = await fetch("/og.png").then((response) => response.blob());
    const started = performance.now();
    const response = await fetch("/api/image-analyses", {
      method: "POST",
      headers: { "content-type": "image/png", accept: "application/x-ndjson" },
      body: png,
    });
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    const events: { type: string; category?: string; ms: number }[] = [];
    let buffer = "";
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let at: number;
      while ((at = buffer.indexOf("\n")) >= 0) {
        const event = JSON.parse(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        events.push({
          type: event.type,
          category: event.category,
          ms: performance.now() - started,
        });
      }
    }
    return { status: response.status, type: response.headers.get("content-type"), events };
  });
  expect(arrivals.status).toBe(200);
  expect(arrivals.type).toContain("application/x-ndjson");
  expect(arrivals.events.map((event) => event.category ?? event.type)).toEqual([
    "started",
    "case",
    "gpu",
    "cooler",
    "fans",
    "memory",
    "motherboard",
    "done",
  ]);
  const at = (name: string) =>
    arrivals.events.find((event) => (event.category ?? event.type) === name)!.ms;
  // "started" comes before the provider's reasoning pause, the case right after it, and the
  // result later still: nothing was held back until the end.
  expect(at("case") - at("started")).toBeGreaterThan(800);
  expect(at("done") - at("case")).toBeGreaterThan(400);
});

test("Analyze opens Studio, which fills in part by part", async ({ page }) => {
  await openReady(page, `${STREAM}/start/image`);
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-sketch.png");
  await page.getByRole("button", { name: "Analyze image" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("status", { name: "Reading the photo" })).toBeVisible();
  await expect(page.getByText("Graphics card found")).toBeVisible();
  await expect(page.getByRole("button", { name: /can be matched to a model/ })).toBeVisible({
    timeout: 20_000,
  });
});
