import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const outputDir = path.join(root, "assets", "promo");

const inputWebm = path.join(outputDir, "forge-demo.webm");
const outputMp4 = path.join(outputDir, "forge-demo.mp4");

const TARGET_FPS = 60;
const WIDTH = 1920;
const HEIGHT = 1080;

function runFfmpeg(args, label) {
  return new Promise((resolve, reject) => {
    console.log(`\n${label}…`);
    const proc = spawn("ffmpeg", args, { stdio: "inherit" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with code ${code}`));
    });
  });
}

if (!fs.existsSync(inputWebm)) {
  console.error(`Source not found: ${inputWebm}`);
  console.error("Run: node scripts/record-promo.mjs");
  process.exit(1);
}

// Transcode the Playwright screen recording (real motion) to a high-quality MP4.
// fps=60 upsamples the native ~25fps capture for smoother playback.
await runFfmpeg(
  [
    "-y",
    "-i",
    inputWebm,
    "-vf",
    `fps=${TARGET_FPS}`,
    "-c:v",
    "libx264",
    "-preset",
    "slow",
    "-crf",
    "12",
    "-profile:v",
    "high",
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    outputMp4,
  ],
  `Enhancing ${path.basename(inputWebm)} → ${path.basename(outputMp4)} (${WIDTH}x${HEIGHT}, ${TARGET_FPS} FPS)`,
);

const mp4 = fs.statSync(outputMp4);
console.log(
  `\nDone.\n  ${outputMp4}\n    ${WIDTH}x${HEIGHT} · ${TARGET_FPS} FPS · ${(mp4.size / 1024 / 1024).toFixed(2)} MB`,
);
