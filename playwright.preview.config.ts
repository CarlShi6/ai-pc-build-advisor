import { defineConfig } from "@playwright/test";

const PORT = 8788;

/**
 * Stage 2 item 8: the production build served by `wrangler dev --local` (workerd with local D1 and
 * rate limiting; no Cloudflare login, nothing deployed). No image provider key is set, and the
 * daily cap is 0, so the provider can never be called. Run with `npm run test:e2e:preview`
 * after `npm run build`. `WRANGLER` overrides the wrangler command (default `npx wrangler`).
 */
const wrangler = process.env.WRANGLER ?? "npx wrangler";

export default defineConfig({
  testDir: "e2e-preview",
  testMatch: "**/*.e2e.ts",
  workers: 1,
  fullyParallel: false,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  use: {
    baseURL: `http://127.0.0.1:${PORT}`,
    channel: "msedge",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `${wrangler} dev --local --ip 127.0.0.1 --port ${PORT} --var IMAGE_ANALYSIS_DAILY_CAP:0`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: { WRANGLER_SEND_METRICS: "false", OPENAI_API_KEY: "", AI_PROVIDER_API_KEY: "" },
  },
});
