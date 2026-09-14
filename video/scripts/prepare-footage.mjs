import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const video = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const root = path.resolve(video, "..");
const pilot = path.join(root, "assets/storyboard/you-handle-today-footage/pilot");
const destination = path.join(video, "public/footage");
const timeline = JSON.parse(readFileSync(path.join(video, "src/footage-manifest.json"), "utf8"));
const files = new Map();
for (const scene of timeline.scenes) {
  if (scene.shot) files.set(scene.shot + ".mp4", path.join(pilot, "clips", scene.shot + ".mp4"));
  if (scene.poster)
    files.set(scene.poster + ".png", path.join(pilot, "frames", scene.poster + ".png"));
}
for (const [name, source] of files) {
  if (path.basename(name) !== name || !existsSync(source))
    throw new Error(`Missing selected footage: ${name}`);
}
mkdirSync(destination, { recursive: true });
for (const [name, source] of files) copyFileSync(source, path.join(destination, name));
const assembly = path.join(root, "assets/storyboard/you-handle-today-footage/assembly");
mkdirSync(assembly, { recursive: true });
writeFileSync(path.join(assembly, "timeline.json"), JSON.stringify(timeline, null, 2) + "\n");
writeFileSync(
  path.join(assembly, "selected-assets.json"),
  JSON.stringify(
    [...files].map(([name, source]) => ({ name, source: path.relative(root, source) })),
    null,
    2,
  ) + "\n",
);
console.log(`Prepared ${files.size} selected assets for the 180-second review assembly.`);
