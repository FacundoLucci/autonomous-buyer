import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const video = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
function run(command, args) {
  const result = spawnSync(command, args, { cwd: video, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run(process.execPath, ["scripts/prepare-complete.mjs"]);
run(process.execPath, ["scripts/prepare-mobile-frames.mjs"]);
run(path.join(video, "node_modules/.bin/remotion"), [
  "render",
  "src/complete-index.tsx",
  "YouHandleToday",
  "../assets/storyboard/you-handle-today-footage/assembly/you-handle-today-v2.mp4",
  "--codec=h264",
  "--crf=20",
  "--pixel-format=yuv420p",
  "--concurrency=2",
  "--offthreadvideo-video-threads=1",
  "--offthreadvideo-cache-size-in-bytes=268435456",
  "--timeout=120000",
  ...process.argv.slice(2),
]);
run(process.execPath, ["scripts/finish-complete.mjs"]);
