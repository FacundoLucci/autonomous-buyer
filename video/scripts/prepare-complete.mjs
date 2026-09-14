import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import path from "node:path";

const video = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(video, "..");
const assets = path.join(root, "assets/storyboard/you-handle-today-footage");
const destination = path.join(video, "public/footage");
const assembly = path.join(assets, "assembly");
const timeline = JSON.parse(readFileSync(path.join(video, "src/complete-manifest.json"), "utf8"));
const mobile = JSON.parse(readFileSync(path.join(assets, "mobile-app/recording.json"), "utf8"));
const mobilePath = path.join(assets, "mobile-app", mobile.file);
const hash = createHash("sha256").update(readFileSync(mobilePath)).digest("hex");
if (hash !== mobile.sha256) throw new Error("The approved mobile recording hash has changed.");

const files = new Map([[mobile.file, mobilePath]]);
let frame = 0;
for (const scene of timeline.scenes) {
  if (Math.round(scene.start * 24) !== frame) throw new Error(`Timeline gap at ${scene.start}`);
  frame += Math.round(scene.duration * 24);
  if (scene.app && (scene.app.start < 0 || scene.app.start + scene.app.duration > 90.001)) {
    throw new Error(`Invalid app trim at ${scene.start}`);
  }
  if (scene.shot) {
    if (scene.duration > 5.18 && !scene.app) throw new Error(`Footage stretched at ${scene.start}`);
    files.set(`${scene.shot}.mp4`, path.join(assets, `pilot/clips/${scene.shot}.mp4`));
  }
  if (scene.poster)
    files.set(`${scene.poster}.png`, path.join(assets, `pilot/frames/${scene.poster}.png`));
}
if (frame !== 4320) throw new Error(`Expected 4320 frames; received ${frame}`);
mkdirSync(destination, { recursive: true });
mkdirSync(path.join(assembly, "qa-v2"), { recursive: true });
for (const [name, source] of files) {
  if (!existsSync(source)) throw new Error(`Missing selected source: ${name}`);
  copyFileSync(source, path.join(destination, name));
}
writeFileSync(path.join(assembly, "timeline-v2.json"), JSON.stringify(timeline, null, 2) + "\n");
writeFileSync(
  path.join(assembly, "selected-assets-v2.json"),
  JSON.stringify(
    {
      mobileSourceSha256: hash,
      files: [...files].map(([name, source]) => ({ name, source: path.relative(root, source) })),
      holds: timeline.scenes
        .filter((s) => s.app && s.duration > s.app.duration)
        .map((s) => ({
          start: s.start,
          duration: Number((s.duration - s.app.duration).toFixed(4)),
          reason:
            "Reading hold on the final app frame; footage and streaming retain their original speed.",
        })),
    },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared ${files.size} approved sources and a continuous 180-second edit.`);
