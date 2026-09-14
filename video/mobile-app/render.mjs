import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "../..");
const folder = path.join(repository, "assets/storyboard/you-handle-today-footage/mobile-app");
const env = { ...process.env, HYPERFRAMES_NO_TELEMETRY: "1", DO_NOT_TRACK: "1" };
const existingBrowser = path.join(
  repository,
  "video/node_modules/.remotion/chrome-headless-shell/mac-arm64/chrome-headless-shell-mac-arm64/chrome-headless-shell",
);
if (!env.HYPERFRAMES_BROWSER_PATH && existsSync(existingBrowser)) {
  env.HYPERFRAMES_BROWSER_PATH = existingBrowser;
}
function run(command, args, cwd = repository) {
  const result = spawnSync(command, args, { cwd, env, stdio: "inherit" });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
run("pnpm", ["exec", "vite", "build", "--config", "video/mobile-app/vite.config.mts"]);
run(process.execPath, [path.join(here, "prepare.mjs")]);
run(path.join(here, "node_modules/.bin/hyperframes"), [
  "render",
  path.join(folder, "site"),
  "--output",
  path.join(folder, "mobile-app-staged-v1.mp4"),
  "--workers",
  "2",
  ...(process.platform === "darwin" ? ["--gpu"] : []),
]);
run(process.execPath, [path.join(here, "finish.mjs")]);
