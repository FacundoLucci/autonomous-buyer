import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

// These JPEGs are real browser screencast frames, with provider timestamps.
// Keep the original transition timing and hold its last frame for one second.
const captures = fileURLToPath(new URL("../public/captures/", import.meta.url));
const sessions = JSON.parse(await readFile(path.join(captures, "capture-times.json"), "utf8"));
const results = [];
for (const { name, frames } of sessions) {
  if (!frames.length) continue;
  const lines = ["ffconcat version 1.0"];
  frames.forEach((frame, i) => {
    lines.push(`file '${frame.file}'`);
    lines.push(
      `duration ${i === frames.length - 1 ? 1 : Math.max(0.001, frames[i + 1].time - frame.time)}`,
    );
  });
  lines.push(`file '${frames.at(-1).file}'`);
  const manifest = path.join(captures, "frames", name, "timing.ffconcat");
  await writeFile(manifest, `${lines.join("\n")}\n`);
  const duration = frames.at(-1).time - frames[0].time + 1;
  const result = spawnSync(
    "ffmpeg",
    [
      "-hide_banner",
      "-loglevel",
      "error",
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      manifest,
      "-t",
      String(duration),
      "-vf",
      "fps=30,scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:0:0,setsar=1",
      "-c:v",
      "libx264",
      "-preset",
      "fast",
      "-crf",
      "18",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      path.join(captures, `${name}.mp4`),
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) throw new Error(`Encoding ${name} failed`);
  const probe = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-show_entries",
      "format=duration",
      "-of",
      "json",
      path.join(captures, `${name}.mp4`),
    ],
    { encoding: "utf8" },
  );
  results.push({
    name,
    sourceFrames: frames.length,
    duration: Number(JSON.parse(probe.stdout).format.duration),
  });
}
await writeFile(
  path.join(captures, "motion-manifest.json"),
  `${JSON.stringify(results, null, 2)}\n`,
);
console.log(JSON.stringify(results, null, 2));
