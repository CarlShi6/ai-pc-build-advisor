import { expect, test } from "@playwright/test";
import { openReady } from "../e2e/helpers";

// Streamed photo reading through the production build on local workerd (nitro → h3 → the API
// router), with the local fake provider (fake-provider.mjs, port 8790) behind the worker on 8789.
// It shows the worker passes events on as they come, not all at the end.
const STREAM = "http://127.0.0.1:8789";
const FAKE_PROVIDER = "http://127.0.0.1:8790";

test.beforeAll(async ({ browser }) => {
  test.setTimeout(120_000);
  const page = await browser.newPage();
  for (const path of ["/", "/studio"])
    await page.goto(`${STREAM}${path}`, { waitUntil: "load", timeout: 90_000 });
  await page.close();
});

test("the worker streams each part as it is read, then the result", async ({ page, request }) => {
  await openReady(page, `${STREAM}/start/image`);
  await request.get(`${FAKE_PROVIDER}/calls`);
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
  // The fast read draws the parts while the full read is still in its reasoning pause (1.2 s),
  // and the result comes later still: nothing was held back until the end.
  expect(at("motherboard") - at("started")).toBeLessThan(1_000);
  expect(at("done") - at("motherboard")).toBeGreaterThan(800);
  // Moderation and the kind check (run together) both finished before the two reads began.
  const calls: string[] = await (await request.get(`${FAKE_PROVIDER}/calls`)).json();
  expect(calls.slice(0, 2).sort()).toEqual(["moderation", "pc-check"]);
  expect(calls.slice(2).sort()).toEqual(["fast", "read"]);
});

test("Analyze opens Studio, which fills in part by part", async ({ page }) => {
  await openReady(page, `${STREAM}/start/image`);
  await page.locator("input[type=file]").setInputFiles("e2e/fixtures/white-build-sketch.png");
  await page.getByRole("button", { name: "Analyze image" }).click();
  await expect(page).toHaveURL(/\/studio$/);
  await expect(page.getByRole("status", { name: "Reading the photo" })).toBeVisible();
  // The fast read brings all six parts within a moment; the last four notices show.
  await expect(page.getByText("Motherboard found")).toBeVisible();
  // The fast read saw a white GPU light, the full read blue: the full read wins, with a notice.
  await expect(page.getByText("Adjusted after full read")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /can be matched to a model/ })).toBeVisible({
    timeout: 20_000,
  });
});
