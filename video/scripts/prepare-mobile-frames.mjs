import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const video = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const source = path.join(video, "public/footage/mobile-app-staged-v1.mp4");
const folder = path.join(video, "public/footage/mobile-frames");
const manifestPath = path.join(video, "src/mobile-frame-map.json");
const sha256 = createHash("sha256").update(readFileSync(source)).digest("hex");
if (existsSync(manifestPath)) {
  const previous = JSON.parse(readFileSync(manifestPath, "utf8"));
  if (
    previous.sha256 === sha256 &&
    previous.frames.length === 2160 &&
    previous.frames.every((f) => existsSync(path.join(folder, f)))
  ) {
    console.log("Reusing the approved mobile recording's decoded frames.");
    process.exit(0);
  }
}
mkdirSync(folder, { recursive: true });
const result = spawnSync(
  "ffmpeg",
  [
    "-hide_banner",
    "-loglevel",
    "error",
    "-threads",
    "2",
    "-i",
    source,
    "-map",
    "0:v:0",
    "-fps_mode",
    "passthrough",
    "-start_number",
    "0",
    "-compression_level",
    "2",
    "-threads",
    "2",
    "-y",
    path.join(folder, "%04d.png"),
  ],
  { stdio: "inherit" },
);
if (result.error) throw result.error;
if (result.status !== 0) process.exit(result.status ?? 1);
const unique = new Map();
const frames = [];
for (let i = 0; i < 2160; i++) {
  const name = `${String(i).padStart(4, "0")}.png`;
  const file = path.join(folder, name);
  const hash = createHash("sha256").update(readFileSync(file)).digest("hex");
  const existing = unique.get(hash);
  if (existing) {
    frames.push(existing);
    unlinkSync(file);
  } else {
    unique.set(hash, name);
    frames.push(name);
  }
}
writeFileSync(
  manifestPath,
  JSON.stringify({ sha256, fps: 24, width: 1080, height: 2340, frames }, null, 2) + "\n",
);
console.log(
  `Decoded 2160 mobile frames; ${unique.size} distinct images. Pixels and timing are unchanged.`,
);
