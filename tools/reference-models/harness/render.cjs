// Usage: node render.cjs <repoDir> <workDir> <passId> [views...]
// Bundles <workDir>/src/createObjectModel.ts into a review page and captures each view to
// <workDir>/renders/<passId>-<view>.png. Dev-only tooling; nothing here ships.
const path = require("path");
const fs = require("fs");
const [repo, work, passId, ...viewArgs] = process.argv.slice(2);
const views = viewArgs.length ? viewArgs : ["front", "side", "orbit", "rear"];
const esbuild = require(path.join(repo, "node_modules", "esbuild"));
const { chromium } = require(path.join(repo, "node_modules", "@playwright", "test"));

(async () => {
  const out = path.join(work, "renders");
  fs.mkdirSync(out, { recursive: true });
  const bundle = path.join(work, "renders", "harness.js");
  await esbuild.build({
    entryPoints: [path.join(__dirname, "harness.ts")],
    bundle: true,
    format: "iife",
    outfile: bundle,
    nodePaths: [path.join(repo, "node_modules")],
    alias: { MODEL_FACTORY: path.join(work, "src", "createObjectModel.ts") },
    logLevel: "error",
  });
  const html = path.join(out, "harness.html");
  fs.writeFileSync(html, `<!doctype html><meta charset="utf-8"><body><script src="harness.js"></script></body>`);
  const browser = await chromium.launch({
    channel: "msedge",
    headless: true,
    args: ["--enable-unsafe-swiftshader", "--use-angle=swiftshader", "--ignore-gpu-blocklist", "--allow-file-access-from-files"],
  });
  const page = await browser.newPage({ viewport: { width: Number(process.env.VW ?? 800), height: Number(process.env.VH ?? 800) } });
  page.on("pageerror", (error) => console.log("pageerror:", error.message));
  for (const view of views) {
    const extra = `&shadows=${process.env.SHADOWS ?? "on"}&bg=${encodeURIComponent(process.env.BG ?? "#7f8790")}&fov=${process.env.FOV ?? "30"}&fill=${process.env.FILL ?? "0"}&unlit=${process.env.UNLIT ?? "0"}&exposure=${process.env.EXPOSURE ?? "1"}&w=${process.env.VW ?? 800}&h=${process.env.VH ?? 800}`;
    await page.goto(`file:///${html.replace(/\\/g, "/")}?view=${view}${extra}`);
    const info = await page.waitForFunction(() => window.__ready, null, { timeout: 30000 });
    const file = path.join(out, `${passId}-${view}.png`);
    await page.locator("canvas").screenshot({ path: file });
    const ready = await info.jsonValue();
    if (ready.manifest) fs.writeFileSync(path.join(out, `${passId}-parts.json`), JSON.stringify(ready.manifest, null, 2));
    console.log(file, JSON.stringify({ sizeMm: ready.sizeMm, meshes: ready.meshes }));
  }
  await browser.close();
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
