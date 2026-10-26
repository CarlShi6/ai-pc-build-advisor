// Usage: node webp2png.cjs <repo> <dir>  — flattens every *.webp in <dir> onto white and saves *.png.
const path = require("path");
const fs = require("fs");
const [repo, dir] = process.argv.slice(2);
const { chromium } = require(path.join(repo, "node_modules", "@playwright", "test"));
(async () => {
  const browser = await chromium.launch({ channel: "msedge", headless: true, args: ["--allow-file-access-from-files"] });
  const page = await browser.newPage();
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith(".webp"))) {
    const url = "file:///" + path.join(dir, file).split(path.sep).join("/");
    await page.goto(url);
    const data = await page.evaluate(async () => {
      const img = document.querySelector("img");
      await img.decode();
      const c = document.createElement("canvas");
      c.width = img.naturalWidth; c.height = img.naturalHeight;
      const g = c.getContext("2d"); g.fillStyle = "#fff"; g.fillRect(0, 0, c.width, c.height); g.drawImage(img, 0, 0);
      return c.toDataURL("image/png");
    });
    fs.writeFileSync(path.join(dir, file.replace(/\.webp$/, ".png")), Buffer.from(data.split(",")[1], "base64"));
    console.log(file);
  }
  await browser.close();
})();
