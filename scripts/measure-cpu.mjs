// CPU time per request of the production build on local workerd (docs/DEPLOY.md, "CPU time").
//
// Cloudflare limits a Worker by CPU time, not wall time: waiting on the AI provider or on a
// stream costs nothing. This script reads the operating system's CPU time of the workerd process
// that runs the app (not wrangler's proxy in front of it), sends each kind of request several
// times, and divides, after taking off what the process uses while idle over the same time.
// That includes workerd's own HTTP handling, so it is an upper bound on the app's CPU.
// (workerd's sampling profiler is no help here: it counts time spent waiting on a fetch as busy.)
//
// Run it against the streaming preview worker, whose AI provider is the local fake (no OpenAI
// call, no key):
//   npm run build
//   node e2e-preview/fake-provider.mjs &
//   npx wrangler dev --local --ip 127.0.0.1 --port 8789 \
//     --var IMAGE_ANALYSIS_DAILY_CAP:100000 --var IMAGE_ANALYSIS_IP_DAILY_CAP:100000 \
//     --var OPENAI_API_KEY:fake-provider-placeholder --var IMAGE_AI_BASE_URL:http://127.0.0.1:8790/v1
//   node scripts/measure-cpu.mjs [--port 8789] [--runs 10] [--pid <workerd pid>]
//
// Windows and Linux. Local numbers come from this machine's CPU, not Cloudflare's; use them to
// compare requests and see how far each is from the plan's limit, then check the dashboard.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const args = new Map(
  process.argv
    .slice(2)
    .join(" ")
    .split(/\s*--/)
    .filter(Boolean)
    .map((pair) => pair.split(/\s+/)),
);
const port = Number(args.get("port") ?? 8789);
const runs = Number(args.get("runs") ?? 10);
const base = `http://127.0.0.1:${port}`;

/** workerd processes: pid, parent pid, and the entry port it listens on (0 for the app's). */
function workerdProcesses() {
  if (process.platform === "win32") {
    const script =
      "Get-CimInstance Win32_Process -Filter \"Name='workerd.exe'\" | ForEach-Object { '{0} {1} {2}' -f $_.ProcessId, $_.ParentProcessId, $_.CommandLine }";
    return execFileSync("powershell", ["-NoProfile", "-Command", script], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter(Boolean)
      .map(parseProcess);
  }
  return execFileSync("ps", ["-eo", "pid=,ppid=,args="], { encoding: "utf8" })
    .split("\n")
    .filter((line) => /workerd\s+serve/.test(line))
    .map((line) => parseProcess(line.trim()));
}
function parseProcess(line) {
  const [pid, ppid] = line.trim().split(/\s+/).map(Number);
  const entry = /entry=127\.0\.0\.1:(\d+)/.exec(line)?.[1];
  return { pid, ppid, entryPort: entry ? Number(entry) : null };
}

/** The app's workerd: the sibling of the proxy that listens on `port`. */
function appProcess() {
  if (args.get("pid")) return Number(args.get("pid"));
  const all = workerdProcesses();
  const proxy = all.find((item) => item.entryPort === port);
  if (!proxy) throw new Error(`No workerd listens on port ${port}. Is wrangler dev running?`);
  const app = all.find((item) => item.ppid === proxy.ppid && item.pid !== proxy.pid);
  if (!app) throw new Error("Found wrangler's proxy but not the app's workerd; pass --pid.");
  return app.pid;
}

/** CPU milliseconds (user + system) the process has used so far. */
function cpuMs(pid) {
  if (process.platform === "win32")
    return Number(
      execFileSync(
        "powershell",
        ["-NoProfile", "-Command", `(Get-Process -Id ${pid}).TotalProcessorTime.TotalMilliseconds`],
        { encoding: "utf8" },
      ).trim(),
    );
  const fields = readFileSync(`/proc/${pid}/stat`, "utf8").split(") ")[1].split(" ");
  const ticks = Number(fields[11]) + Number(fields[12]);
  return (ticks * 1000) / Number(execFileSync("getconf", ["CLK_TCK"], { encoding: "utf8" }));
}

const photo = readFileSync("e2e/fixtures/white-build-glass-front.png");
const drain = async (response) => {
  await response.arrayBuffer();
  return response.status;
};

/** Each request kind, sent `runs` times after one warm-up. */
const scenarios = [
  { name: "GET / (server render)", send: () => fetch(`${base}/`).then(drain) },
  { name: "GET /studio (server render)", send: () => fetch(`${base}/studio`).then(drain) },
  { name: "GET /terms (server render)", send: () => fetch(`${base}/terms`).then(drain) },
  { name: "GET /og.png (static file)", send: () => fetch(`${base}/og.png`).then(drain) },
  {
    name: "POST /api/image-analyses (prechecks + streamed read)",
    // The server reads at most 12 photos a minute per isolate; stay under it.
    runs: Math.min(runs, 10),
    send: () =>
      fetch(`${base}/api/image-analyses`, {
        method: "POST",
        headers: {
          "content-type": "image/png",
          accept: "application/x-ndjson",
          // A new session each time, so the per-session limit (3 a minute) does not answer instead.
          cookie: `aipc_image_session=${crypto.randomUUID()}`,
        },
        body: photo,
      }).then(drain),
  },
  {
    name: "POST /api/build/recommend (Describe)",
    send: () =>
      fetch(`${base}/api/build/recommend`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ budget: 1500 }),
      }).then(drain),
  },
  {
    name: "POST /api/analytics/events",
    send: () =>
      fetch(`${base}/api/analytics/events`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ event: "v3_image_submitted", path: "/", properties: {} }),
      }).then(drain),
  },
];

const pid = appProcess();
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// What the process uses while idle, per millisecond of wall time.
const idleStart = cpuMs(pid);
await sleep(3_000);
const idlePerMs = Math.max(0, (cpuMs(pid) - idleStart) / 3_000);

const rows = [];
for (const scenario of scenarios) {
  const status = await scenario.send(); // warm-up: loads the chunks this request needs
  if (status >= 400) throw new Error(`${scenario.name} answered ${status}; nothing to measure.`);
  const count = scenario.runs ?? runs;
  const before = cpuMs(pid);
  const started = Date.now();
  for (let run = 0; run < count; run++) {
    const answer = await scenario.send();
    if (answer >= 400) throw new Error(`${scenario.name} answered ${answer} on run ${run + 1}.`);
  }
  const wall = Date.now() - started;
  const used = cpuMs(pid) - before - idlePerMs * wall;
  rows.push({
    request: scenario.name,
    runs: count,
    "CPU ms per request": +Math.max(0, used / count).toFixed(1),
    "wall ms per request": Math.round(wall / count),
  });
}

console.log(`workerd pid ${pid} on port ${port}; each request after a warm-up.`);
console.table(rows);
console.log(
  "Cloudflare limits: Workers Free 10 ms CPU per request; Workers Paid 30 s by default (configurable).",
);
