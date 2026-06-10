import { chromium } from "playwright";
import { spawn } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const outputDir = path.join(root, "assets", "promo");
const outputWebm = path.join(outputDir, "forge-demo.webm");

const DURATION_MS = 17_500;
const WIDTH = 1920;
const HEIGHT = 1080;

function serveStatic(dir) {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url ?? "/").split("?")[0]);
      const filePath = path.join(dir, urlPath === "/" ? "promo-demo.html" : urlPath);
      if (!filePath.startsWith(dir)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.readFile(filePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end();
          return;
        }
        const ext = path.extname(filePath);
        const types = {
          ".html": "text/html",
          ".png": "image/png",
          ".svg": "image/svg+xml",
        };
        res.writeHead(200, { "Content-Type": types[ext] ?? "application/octet-stream" });
        res.end(data);
      });
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      resolve({ server, url: `http://127.0.0.1:${port}/promo-demo.html` });
    });
  });
}

function runNodeScript(scriptName) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, scriptName);
    const proc = spawn(process.execPath, [scriptPath], { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${scriptName} exited with code ${code}`));
    });
  });
}

fs.mkdirSync(outputDir, { recursive: true });

const { server, url } = await serveStatic(publicDir);

let browser;
let rawVideoPath;

try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: HEIGHT },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: outputDir,
      size: { width: WIDTH, height: HEIGHT },
    },
  });

  const page = await context.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForTimeout(DURATION_MS);

  const video = page.video();
  await context.close();
  rawVideoPath = await video.path();
} finally {
  await browser?.close();
  server.close();
}

if (fs.existsSync(outputWebm)) {
  fs.unlinkSync(outputWebm);
}
fs.renameSync(rawVideoPath, outputWebm);

console.log(`\nRecorded source video:\n  ${outputWebm}`);
console.log("Enhancing to 60 FPS MP4…");
await runNodeScript("enhance-promo.mjs");
