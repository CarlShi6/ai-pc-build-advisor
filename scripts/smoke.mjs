// Smoke test for a running AIPC deployment (docs/DEPLOY.md, step 8): the v3 pages, the 404s, the
// security headers, and the APIs, without any AI cost by default.
//
//   node scripts/smoke.mjs https://your-app.example        # no photo is analyzed
//   node scripts/smoke.mjs http://127.0.0.1:8788
//   node scripts/smoke.mjs <url> --analyze e2e/fixtures/white-build-glass-front.png
//
// --analyze sends one photo through the real Analyze path (prechecks, then the streamed read):
// one paid AI call on a configured deployment, counted against its daily cap. With Turnstile on,
// the server refuses it without a token, and the script reports that as expected.
// Exit code 1 when any check fails.
import { readFileSync } from "node:fs";
import { extname } from "node:path";

const [, , baseArg, ...rest] = process.argv;
if (!baseArg) {
  console.error("Usage: node scripts/smoke.mjs <base-url> [--analyze <photo>]");
  process.exit(2);
}
const base = baseArg.replace(/\/+$/, "");
const analyzeAt = rest.indexOf("--analyze");
const photoPath = analyzeAt >= 0 ? rest[analyzeAt + 1] : null;

const results = [];
async function check(name, run) {
  const started = Date.now();
  try {
    const note = await run();
    results.push({ ok: true, name, note: note ?? "", ms: Date.now() - started });
  } catch (error) {
    results.push({ ok: false, name, note: error.message, ms: Date.now() - started });
  }
}
function expect(condition, message) {
  if (!condition) throw new Error(message);
}
const get = (path, init) => fetch(`${base}${path}`, { redirect: "manual", ...init });

const requiredHeaders = {
  "content-security-policy": "frame-ancestors 'none'",
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "referrer-policy": "strict-origin-when-cross-origin",
  "permissions-policy": "camera=()",
};
function expectSecurityHeaders(response, path) {
  for (const [name, part] of Object.entries(requiredHeaders))
    expect(response.headers.get(name)?.includes(part), `${path}: missing or wrong ${name}`);
  if (base.startsWith("https:"))
    expect(response.headers.get("strict-transport-security"), `${path}: missing HSTS`);
}

for (const path of [
  "/",
  "/start/image",
  "/start/describe",
  "/studio",
  "/my-builds",
  "/privacy",
  "/terms",
])
  await check(`GET ${path} serves the page with security headers`, async () => {
    const response = await get(path);
    expect(response.status === 200, `status ${response.status}`);
    expect(response.headers.get("content-type")?.includes("text/html"), "not HTML");
    expectSecurityHeaders(response, path);
    await response.arrayBuffer();
  });

await check("GET /og.png (static file) has the security headers", async () => {
  const response = await get("/og.png");
  expect(response.status === 200, `status ${response.status}`);
  expectSecurityHeaders(response, "/og.png");
  await response.arrayBuffer();
});

for (const path of [
  "/compare",
  "/consult",
  "/legacy-workspace",
  "/api/auth/session",
  "/api/builds/saved",
])
  await check(`GET ${path} answers 404 (not part of v3)`, async () => {
    const response = await get(path);
    expect(response.status === 404, `status ${response.status}`);
    await response.arrayBuffer();
  });

await check("GET /api/image-analyses answers 405", async () => {
  const response = await get("/api/image-analyses");
  expect(response.status === 405, `status ${response.status}`);
  await response.arrayBuffer();
});

await check("POST /api/image-analyses refuses a non-image before any AI call", async () => {
  const response = await get("/api/image-analyses", {
    method: "POST",
    headers: { "content-type": "text/plain" },
    body: "not an image",
  });
  const body = await response.json().catch(() => null);
  if (body?.error?.code === "IMAGE_ANALYSIS_PAUSED") return "kill switch is ON (analysis paused)";
  expect(response.status >= 400 && response.status < 500, `status ${response.status}`);
  expect(typeof body?.error?.code === "string", "no error code");
  return body.error.code;
});

await check("POST /api/build/recommend returns a build (Describe)", async () => {
  const response = await get("/api/build/recommend", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ budget: 1500 }),
  });
  expect(response.status === 200, `status ${response.status}`);
  const body = await response.json();
  expect(body && typeof body === "object", "no JSON body");
});

await check("POST /api/analytics/events accepts an event", async () => {
  const response = await get("/api/analytics/events", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      event: "v3_image_submitted",
      path: "/",
      properties: { fixture: false },
    }),
  });
  expect(response.status < 300, `status ${response.status}`);
  await response.arrayBuffer();
});

if (photoPath)
  await check(`POST /api/image-analyses reads ${photoPath} (one AI call)`, async () => {
    const types = {
      ".png": "image/png",
      ".jpg": "image/jpeg",
      ".jpeg": "image/jpeg",
      ".webp": "image/webp",
    };
    const started = Date.now();
    const response = await get("/api/image-analyses", {
      method: "POST",
      headers: {
        "content-type": types[extname(photoPath).toLowerCase()] ?? "image/jpeg",
        accept: "application/x-ndjson",
      },
      body: readFileSync(photoPath),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const code = body?.error?.code ?? `status ${response.status}`;
      // Expected refusals on a protected deployment; anything else is a failure.
      const expected = [
        "TURNSTILE_REQUIRED",
        "TURNSTILE_FAILED",
        "IMAGE_ANALYSIS_PAUSED",
        "DAILY_CAP_REACHED",
        "IP_DAILY_CAP_REACHED",
        "SESSION_RATE_LIMITED",
        "NOT_A_PC",
      ];
      expect(expected.includes(code), `refused: ${code} ${body?.error?.message ?? ""}`);
      return `refused before streaming as expected: ${code}`;
    }
    expect(response.headers.get("content-type")?.includes("application/x-ndjson"), "not a stream");
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    const timeline = [];
    let buffer = "";
    let last;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let at;
      while ((at = buffer.indexOf("\n")) >= 0) {
        last = JSON.parse(buffer.slice(0, at));
        buffer = buffer.slice(at + 1);
        timeline.push(
          `${last.category ?? last.type}@${((Date.now() - started) / 1000).toFixed(1)}s`,
        );
      }
    }
    expect(last?.type === "done", `stream ended with ${last?.type}: ${last?.message ?? ""}`);
    return timeline.join(" ");
  });

const failed = results.filter((result) => !result.ok);
for (const result of results)
  console.log(
    `${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.note ? ` · ${result.note}` : ""}`,
  );
console.log(`\n${results.length - failed.length}/${results.length} passed against ${base}`);
process.exit(failed.length ? 1 : 0);
