import { defineConfig } from "@playwright/test";

const PORT = 5181;

/**
 * v3 end-to-end flows (PRD §19.3). Runs against a dedicated dev server with mock persistence and
 * no image provider, in the locally installed Microsoft Edge (no bundled browser download).
 */
export default defineConfig({
  testDir: "e2e",
  testMatch: "**/*.e2e.ts",
  // The mock store is in memory and shared by the dev server, so flows run one at a time.
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
    command: `npm run dev -- --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: `http://127.0.0.1:${PORT}/`,
    reuseExistingServer: false,
    timeout: 120_000,
    env: {
      PERSISTENCE_PROVIDER: "mock",
      AI_PROVIDER: "",
      OPENAI_API_KEY: "",
      AI_PROVIDER_API_KEY: "",
    },
  },
});
