// Pre-deploy check (docs/DEPLOY_CHECKLIST.md). Run it right before `npx wrangler deploy`, in the
// same shell, so the build it makes (with that shell's VITE_TURNSTILE_SITE_KEY) is what deploys.
//
//   npm run deploy:check
//   npm run deploy:check -- --skip-secrets   # before `wrangler login`; never "ready" (exit 2)
//
// 1. Configuration: no placeholders in wrangler.jsonc, a real D1 id, the production defaults
//    (daily cap 30, per IP 10, fast read on), no secret in vars or VITE_*, a contact on /terms.
// 2. Secrets: `wrangler secret list` has OPENAI_API_KEY, and TURNSTILE_SECRET_KEY exactly when the
//    build has a Turnstile site key.
// 3. `npm run build`, and the generated .output/server/wrangler.json keeps that configuration.
// 4. `npm run test:e2e:preview`.
// 5. Routes: the built worker on `wrangler dev --local` (no login, no provider key), every page
//    and API probed. v3 pages answer 200, pre-v3 pages and APIs 404.
// Stops at the first failing stage; exit code 1 on any failure.
import { spawn, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { loadEnv } from "vite";

const wrangler = process.env.WRANGLER ?? "npx --yes wrangler";
const skipSecrets = process.argv.includes("--skip-secrets");
const read = (path) => readFileSync(path, "utf8");

const results = [];
const pass = (name, note = "") => results.push({ ok: true, name, note });
const fail = (name, note = "") => results.push({ ok: false, name, note });
/** `hint` is shown only when the check fails. */
const check = (name, ok, note = "", hint = "") =>
  ok ? pass(name, note) : fail(name, [note, hint].filter(Boolean).join(" · "));
const failed = () => results.some((result) => !result.ok);
let printed = 0;
function report() {
  for (const result of results.slice(printed))
    console.log(
      `${result.ok ? "PASS" : "FAIL"}  ${result.name}${result.note ? ` · ${result.note}` : ""}`,
    );
  printed = results.length;
}
function stopIfFailed() {
  report();
  if (!failed()) return;
  console.log("\nNot ready to deploy: fix the FAIL lines above and run deploy:check again.");
  process.exit(1);
}
function stage(title) {
  report();
  console.log(`\n== ${title}`);
}
const run = (command, options = {}) =>
  spawnSync(command, { shell: true, encoding: "utf8", ...options });

/** JSONC → JSON: comments and trailing commas dropped, strings left alone. */
function parseJsonc(text) {
  let out = "";
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const start = i;
      for (i++; i < text.length && text[i] !== '"'; i++) if (text[i] === "\\") i++;
      out += text.slice(start, i + 1);
    } else if (c === "/" && text[i + 1] === "/") {
      while (i < text.length && text[i] !== "\n") i++;
      out += "\n";
    } else if (c === "/" && text[i + 1] === "*") {
      i = text.indexOf("*/", i + 2) + 1;
    } else out += c;
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const strings = (value, path = "") =>
  typeof value === "string"
    ? [[path, value]]
    : value && typeof value === "object"
      ? Object.entries(value).flatMap(([key, inner]) =>
          strings(inner, path ? `${path}.${key}` : key),
        )
      : [];

const placeholder = /REPLACE_WITH|PLACEHOLDER|CHANGE_?ME|YOUR[_-]|TODO|<[^>]*>/i;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const secretNames = ["OPENAI_API_KEY", "AI_PROVIDER_API_KEY", "TURNSTILE_SECRET_KEY"];

/** The settings that must reach production, from wrangler.jsonc or the generated config. */
function checkConfig(config, label) {
  const found = strings(config).filter(
    ([path, value]) => path !== "$schema" && placeholder.test(value),
  );
  check(
    `${label}: no placeholders`,
    found.length === 0,
    found.map(([path, value]) => `${path} = ${value}`).join(", "),
  );
  const db = config.d1_databases?.find((entry) => entry.binding === "IMAGE_CAP_DB");
  check(
    `${label}: D1 IMAGE_CAP_DB has a real database_id`,
    !!db && uuid.test(db.database_id ?? ""),
    db ? db.database_id : "binding missing",
  );
  check(
    `${label}: IMAGE_RATE_LIMITER binding`,
    !!config.ratelimits?.some((entry) => entry.name === "IMAGE_RATE_LIMITER"),
  );
  const vars = config.vars ?? {};
  check(`${label}: AI_PROVIDER = openai`, vars.AI_PROVIDER === "openai", String(vars.AI_PROVIDER));
  check(
    `${label}: IMAGE_ANALYSIS_DAILY_CAP = 30`,
    vars.IMAGE_ANALYSIS_DAILY_CAP === "30",
    String(vars.IMAGE_ANALYSIS_DAILY_CAP),
  );
  check(
    `${label}: IMAGE_ANALYSIS_IP_DAILY_CAP = 10`,
    vars.IMAGE_ANALYSIS_IP_DAILY_CAP === "10",
    String(vars.IMAGE_ANALYSIS_IP_DAILY_CAP),
  );
  check(
    `${label}: fast read on (IMAGE_FAST_READ unset or on)`,
    !/^(0|false|off|no)$/i.test(String(vars.IMAGE_FAST_READ ?? "").trim()),
    vars.IMAGE_FAST_READ === undefined ? "unset" : String(vars.IMAGE_FAST_READ),
  );
  const leaked = Object.keys(vars).filter(
    (name) => secretNames.includes(name) || /SECRET|TOKEN|API_KEY/.test(name),
  );
  check(`${label}: no secret in vars`, leaked.length === 0, leaked.join(", "));
  if (vars.IMAGE_ANALYSIS_PAUSED !== undefined)
    pass(
      `${label}: IMAGE_ANALYSIS_PAUSED in vars`,
      `${vars.IMAGE_ANALYSIS_PAUSED} (deploy --var overrides it)`,
    );
}

// 1. Configuration --------------------------------------------------------------------------------
stage("1. Configuration");
const source = parseJsonc(read("wrangler.jsonc"));
checkConfig(source, "wrangler.jsonc");

// The same defaults in the code, for a var that goes missing.
const capCode = read("src/lib/v3/image-daily-cap.server.ts");
check("code default: daily cap 30", /DEFAULT_DAILY_CAP\s*=\s*30\b/.test(capCode));
check("code default: per-IP cap 10", /DEFAULT_IP_DAILY_CAP\s*=\s*10\b/.test(capCode));
check(
  "code default: fast read on unless switched off",
  read("src/lib/config.server.ts").includes("imageFastRead: !/^(0|false|off|no)$/i.test("),
);

const contact = read("src/routes/terms.tsx").match(/const CONTACT_EMAIL = "([^"]*)"/)?.[1] ?? "";
check(
  "/terms has a contact email",
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact) && !placeholder.test(contact),
  contact || "missing",
);

// What the build will see (shell environment and .env files), VITE_* only: those reach browsers.
const viteEnv = loadEnv("production", process.cwd(), "VITE_");
const exposed = Object.keys(viteEnv).filter((name) =>
  /SECRET|TOKEN|PASSWORD|PRIVATE|SERVICE_ROLE|API_KEY/.test(name),
);
check("no secret-looking VITE_* variable", exposed.length === 0, exposed.join(", "));
const turnstile = !!viteEnv.VITE_TURNSTILE_SITE_KEY?.trim();
pass(
  "Turnstile in this build",
  turnstile ? "on (VITE_TURNSTILE_SITE_KEY is set)" : "off (VITE_TURNSTILE_SITE_KEY not set)",
);

// 2. Secrets --------------------------------------------------------------------------------------
stage("2. Worker secrets");
if (skipSecrets) {
  console.log("SKIP  wrangler secret list (--skip-secrets)");
} else {
  const listed = run(`${wrangler} secret list --format json`);
  let names = null;
  try {
    const text = listed.stdout;
    names = JSON.parse(text.slice(text.indexOf("["), text.lastIndexOf("]") + 1)).map(
      (entry) => entry.name,
    );
  } catch {
    names = null;
  }
  if (listed.status !== 0 || !names) {
    fail(
      "wrangler secret list",
      `could not list the Worker's secrets (logged in? Worker created?): ${(listed.stderr || listed.stdout).trim().split("\n").slice(-2).join(" ")}`,
    );
  } else {
    pass("wrangler secret list", names.length ? names.join(", ") : "no secrets");
    check(
      "secret OPENAI_API_KEY",
      names.includes("OPENAI_API_KEY"),
      "",
      "missing: npx wrangler secret put OPENAI_API_KEY",
    );
    if (turnstile)
      check(
        "secret TURNSTILE_SECRET_KEY (Turnstile is on)",
        names.includes("TURNSTILE_SECRET_KEY"),
        "",
        "missing: npx wrangler secret put TURNSTILE_SECRET_KEY",
      );
    else
      check(
        "no TURNSTILE_SECRET_KEY without a site key",
        !names.includes("TURNSTILE_SECRET_KEY"),
        "",
        "the server would require a token the page never shows: set VITE_TURNSTILE_SITE_KEY, or delete the secret",
      );
    const legacy = names.filter((name) => /STRIPE|SUPABASE|BEST_?BUY/i.test(name));
    if (legacy.length) pass("legacy secrets (unused by v3; safe to delete)", legacy.join(", "));
  }
}
stopIfFailed();

// 3. Build ----------------------------------------------------------------------------------------
stage("3. Build");
const built = run("npm run build", { stdio: "inherit" });
check("npm run build", built.status === 0, built.status === 0 ? "" : `exit ${built.status}`);
stopIfFailed();
const generated = JSON.parse(read(".output/server/wrangler.json"));
checkConfig(generated, ".output/server/wrangler.json");
check(".output/server/wrangler.json: Workers Logs on", generated.observability?.enabled === true);
check(
  "wrangler deploy uses the generated config",
  read(".wrangler/deploy/config.json").includes(".output"),
);
stopIfFailed();

// 4. Preview E2E ----------------------------------------------------------------------------------
stage("4. Preview E2E (production build on local workerd)");
const e2e = run("npm run test:e2e:preview", { stdio: "inherit" });
check("npm run test:e2e:preview", e2e.status === 0, e2e.status === 0 ? "" : `exit ${e2e.status}`);
stopIfFailed();

// 5. Routes ---------------------------------------------------------------------------------------
stage("5. Routes on the built worker");
const surface = read("src/lib/production-surface.ts");
const listOf = (name) =>
  [
    ...(surface.match(new RegExp(`const ${name} = \\[([^\\]]*)\\]`))?.[1] ?? "").matchAll(
      /"([^"]+)"/g,
    ),
  ].map((match) => match[1]);
const legacyPages = listOf("legacyPages");
const v3Apis = listOf("v3Apis");
const modes = [
  ...(read("src/routes/start.$mode.tsx").match(/const modes = \[([^\]]*)\]/)?.[1] ?? "").matchAll(
    /"([^"]+)"/g,
  ),
].map((match) => match[1]);
const routeBlock =
  read("src/routeTree.gen.ts").match(/fullPaths:\s*((?:\s*\|\s*'[^']*')+)/)?.[1] ?? "";
const pages = [...routeBlock.matchAll(/'([^']*)'/g)]
  .map((match) => match[1])
  .flatMap((path) => (path === "/start/$mode" ? modes.map((mode) => `/start/${mode}`) : [path]));
const apis = [
  ...new Set(
    [...read("src/lib/api-router.ts").matchAll(/pathname === "(\/api\/[^"]+)"/g)].map((m) => m[1]),
  ),
];
const isLegacy = (path) => legacyPages.some((base) => path === base || path.startsWith(`${base}/`));
const dynamic = pages.filter((path) => path.includes("$"));
check("every page route is known", dynamic.length === 0 && pages.length > 0, dynamic.join(", "));
check("route lists found", legacyPages.length > 0 && v3Apis.length > 0 && apis.length > 0);
stopIfFailed();

const PORT = 8791;
const base = `http://127.0.0.1:${PORT}`;
const worker = spawn(
  `${wrangler} dev --local --ip 127.0.0.1 --port ${PORT} --inspector-port 9233 --persist-to .wrangler/deploy-check-state --var IMAGE_ANALYSIS_DAILY_CAP:0`,
  {
    shell: true,
    stdio: "ignore",
    env: {
      ...process.env,
      WRANGLER_SEND_METRICS: "false",
      OPENAI_API_KEY: "",
      AI_PROVIDER_API_KEY: "",
    },
  },
);
const stopWorker = () => {
  if (process.platform === "win32")
    spawnSync(`taskkill /pid ${worker.pid} /T /F`, { shell: true, stdio: "ignore" });
  else worker.kill("SIGTERM");
};
try {
  let up = false;
  for (const deadline = Date.now() + 120_000; Date.now() < deadline && !up; ) {
    up = await fetch(`${base}/`).then(
      (response) => response.ok,
      () => false,
    );
    if (!up) await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  check("built worker starts on wrangler dev --local", up);
  stopIfFailed();

  const status = (path) =>
    fetch(`${base}${path}`, { redirect: "manual" }).then(async (response) => {
      await response.arrayBuffer();
      return response.status;
    });
  const rows = [];
  for (const path of pages) {
    const legacy = isLegacy(path);
    const got = await status(path);
    rows.push({ kind: "page", path, live: !legacy, got, ok: legacy ? got === 404 : got === 200 });
  }
  for (const path of apis) {
    const live = v3Apis.includes(path);
    const got = await status(path);
    rows.push({ kind: "api", path, live, got, ok: live ? got !== 404 && got < 500 : got === 404 });
  }
  for (const path of ["/no-such-page", "/api/no-such-api"]) {
    const got = await status(path);
    rows.push({ kind: "unknown", path, live: false, got, ok: got === 404 });
  }

  const line = (row) =>
    `  ${row.ok ? "ok  " : "BAD "} ${String(row.got).padEnd(4)} ${row.kind.padEnd(8)} ${row.path}`;
  console.log("\nGoing live (v3):");
  for (const row of rows.filter((row) => row.live)) console.log(line(row));
  console.log("\nHidden in production (must be 404):");
  for (const row of rows.filter((row) => !row.live)) console.log(line(row));
  console.log("");
  const live = rows.filter((row) => row.live);
  const hidden = rows.filter((row) => !row.live);
  check(
    `v3 routes served (${live.length})`,
    live.every((row) => row.ok),
    live
      .filter((row) => !row.ok)
      .map((row) => `${row.path} ${row.got}`)
      .join(", "),
  );
  check(
    `pre-v3 and unknown routes are 404 (${hidden.length})`,
    hidden.every((row) => row.ok),
    hidden
      .filter((row) => !row.ok)
      .map((row) => `${row.path} ${row.got}`)
      .join(", "),
  );
} finally {
  stopWorker();
}
stopIfFailed();

if (skipSecrets) {
  console.log(
    "\nEverything else passed, but the Worker's secrets were not checked (--skip-secrets).",
  );
  console.log("Run `npm run deploy:check` without it after `npx wrangler login` before deploying.");
  process.exit(2);
}
console.log(
  "\nReady to deploy: npx wrangler deploy (see docs/DEPLOY_CHECKLIST.md for the --var to use).",
);
