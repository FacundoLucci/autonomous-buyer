import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const folder = path.resolve(here, "../../assets/storyboard/you-handle-today-footage/mobile-app");
const source = path.join(folder, "mobile-app-staged-v1.mp4");
const metadata = JSON.parse(readFileSync(path.join(folder, "chapters.json"), "utf8"));
const clips = path.join(folder, "clips");
mkdirSync(clips, { recursive: true });
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout;
}
const encoder =
  process.platform === "darwin"
    ? ["-c:v", "h264_videotoolbox", "-b:v", "5M"]
    : ["-c:v", "libx264", "-preset", "fast", "-crf", "18"];
const exports = metadata.chapters.map((chapter, index) => {
  const file = `${String(index + 1).padStart(2, "0")}-${chapter.name.toLowerCase().replaceAll(" ", "-")}.mp4`;
  run("ffmpeg", [
    "-hide_banner",
    "-loglevel",
    "error",
    "-ss",
    String(chapter.start),
    "-i",
    source,
    "-t",
    String(chapter.end - chapter.start),
    "-map",
    "0:v:0",
    ...encoder,
    "-pix_fmt",
    "yuv420p",
    "-movflags",
    "+faststart",
    "-an",
    "-y",
    path.join(clips, file),
  ]);
  const probe = JSON.parse(
    run("ffprobe", [
      "-v",
      "error",
      "-show_entries",
      "format=duration,size",
      "-of",
      "json",
      path.join(clips, file),
    ]),
  );
  if (Math.abs(Number(probe.format.duration) - (chapter.end - chapter.start)) > 0.05) {
    throw new Error(`Unexpected duration for ${file}`);
  }
  return {
    ...chapter,
    file: `clips/${file}`,
    duration: Number(probe.format.duration),
    bytes: Number(probe.format.size),
  };
});
run("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-ss",
  "20",
  "-i",
  source,
  "-frames:v",
  "1",
  "-y",
  path.join(folder, "poster.jpg"),
]);
const bytes = readFileSync(source);
writeFileSync(
  path.join(folder, "recording.json"),
  JSON.stringify(
    {
      ...metadata,
      file: path.basename(source),
      bytes: bytes.length,
      sha256: createHash("sha256").update(bytes).digest("hex"),
      renderer: "Hyperframes 0.8.37",
      ui: "Production React components and styles imported from this checkout",
      data: "Staged fictional film scenario; timed word reveal, no live model stream",
      externalActions: "No orders, supplier emails, or paid video generation",
      narration: "Silent; ready for Facundo's Loom overlay",
      exports,
    },
    null,
    2,
  ) + "\n",
);
console.log(`Prepared ${exports.length} individually timed clips and recording metadata.`);
