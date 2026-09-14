import { createHash } from "node:crypto";
import { copyFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const video = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const folder = path.resolve(video, "../assets/storyboard/you-handle-today-footage/assembly");
const file = path.join(folder, "you-handle-today-v2.mp4");
const timeline = JSON.parse(readFileSync(path.join(video, "src/complete-manifest.json"), "utf8"));
function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `${command} failed`);
  return result.stdout;
}
const probe = JSON.parse(
  run("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_type,codec_name,width,height,r_frame_rate,nb_frames",
    "-of",
    "json",
    file,
  ]),
);
const stream = probe.streams.find((s) => s.codec_type === "video");
if (
  !stream ||
  stream.width !== 1920 ||
  stream.height !== 1080 ||
  stream.nb_frames !== "4320" ||
  stream.r_frame_rate !== "24/1" ||
  Math.abs(Number(probe.format.duration) - 180) > 0.1
) {
  throw new Error("The assembled film does not match its 180-second specification.");
}
run("ffmpeg", ["-hide_banner", "-v", "error", "-i", file, "-f", "null", "-"]);
const samples = [18.5, 46, 65, 88, 94, 106, 117, 144, 157, 175];
for (const time of samples) {
  run("ffmpeg", [
    "-hide_banner",
    "-v",
    "error",
    "-ss",
    String(time),
    "-i",
    file,
    "-frames:v",
    "1",
    "-q:v",
    "2",
    "-y",
    path.join(folder, `qa-v2/export-${time}.jpg`),
  ]);
}
copyFileSync(path.join(folder, "qa-v2/export-65.jpg"), path.join(folder, "poster-v2.jpg"));
copyFileSync(path.join(folder, "narration-guide.srt"), path.join(folder, "narration-v2.srt"));
const verification = {
  file: path.basename(file),
  duration: Number(probe.format.duration),
  width: stream.width,
  height: stream.height,
  fps: 24,
  frames: 4320,
  bytes: Number(probe.format.size),
  sha256: createHash("sha256").update(readFileSync(file)).digest("hex"),
  fullDecode: "passed",
  extractedFrameTimes: samples,
  story: "Approved owner footage plus actual mobile UI with staged story data.",
  cameraAndNarration: "Facundo's Loom recording remains to be added; the lower strip is reserved.",
  audio: "Original footage sound at reduced volume; no generated narrator or music.",
  paidGenerationCalls: 0,
};
writeFileSync(path.join(folder, "complete-v2.json"), JSON.stringify(verification, null, 2) + "\n");
const chapters = [
  [0, "Start"],
  [17, "Piano crash"],
  [33, "Handoff"],
  [63, "Cups online"],
  [75, "Bakery email"],
  [92, "Return + cleanup"],
  [109, "Review terms"],
  [127, "Orders"],
  [147, "Later change"],
  [172, "Close"],
];
const old = path.join(folder, "index.html");
if (existsSync(old) && !existsSync(path.join(folder, "index-v1.html")))
  copyFileSync(old, path.join(folder, "index-v1.html"));
writeFileSync(
  old,
  `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BUY HARD · You handle today · Complete cut</title>
<style>
:root{--lime:#dce985;--ink:#15170f;--pale:#eef1d5}*{box-sizing:border-box}body{margin:0;background:var(--lime);color:var(--ink);font:17px/1.5 Arial,Helvetica,sans-serif}main{max-width:1320px;margin:auto;padding:28px}header{display:flex;justify-content:space-between;gap:24px;border-top:2px solid;padding:15px 0}.brand{font-size:29px;font-weight:900;letter-spacing:-1.5px}.label{font:12px/1.5 monospace;text-transform:uppercase;letter-spacing:.06em}h1{font-size:clamp(44px,7vw,80px);line-height:1;letter-spacing:-.065em;margin:30px 0 18px}p{max-width:960px}a{color:inherit;text-underline-offset:4px}.player{position:relative;background:var(--ink);border:1px solid}video{display:block;width:100%;aspect-ratio:16/9}.cue{position:absolute;left:12%;right:4%;bottom:2.3%;font-size:clamp(9px,1.83vw,25px);line-height:1.25;pointer-events:none}.cue[hidden]{display:none}.row{display:flex;gap:16px;justify-content:space-between;flex-wrap:wrap;padding:14px 0;border-bottom:1px solid}.chapters,.files{display:flex;gap:9px;flex-wrap:wrap;margin:20px 0}button,.button{font:13px monospace;background:var(--pale);color:inherit;border:1px solid;padding:11px 14px;cursor:pointer;text-decoration:none}button:hover,.button:hover{background:var(--ink);color:var(--lime)}a:focus-visible,button:focus-visible,input:focus-visible{outline:3px solid;outline-offset:3px}.notes{padding:18px 22px;background:var(--pale);border-top:1px solid;border-bottom:1px solid}h2{font-size:30px;letter-spacing:-.035em}.notes p{font-size:15px}.switch{display:flex;align-items:center;gap:9px;cursor:pointer}.switch input{accent-color:var(--ink)}footer{font:12px/1.6 monospace;margin-top:26px}@media(max-width:650px){main{padding:18px 14px}.row{font-size:12px}header{align-items:flex-start}.cue{font-size:9px}}
</style></head><body><main>
<header><span class="brand">BUY HARD</span><span class="label">You handle today<br>Complete visual edit · Version 02</span></header>
<h1>You handle today.</h1><p>One damaged shipment. One handoff. The owner keeps the shop moving while the buyer arranges the replacements.</p>
<div class="player"><video id="review" controls playsinline preload="metadata" poster="poster-v2.jpg" src="you-handle-today-v2.mp4"></video><div id="cue" class="cue" hidden></div></div>
<div class="row"><span class="label">3:00 · 1920 × 1080 · Real mobile app UI</span><label class="switch"><input type="checkbox" id="show-cues">Show narration cues</label><a href="you-handle-today-v2.mp4" download>Download complete cut ↗</a></div>
<div class="chapters" aria-label="Jump to a scene">${chapters.map(([time, label]) => `<button data-time="${time}">${label}</button>`).join("")}</div>
<div class="notes"><strong>Ready for your Loom recording.</strong><p>The film combines the approved piano and cleanup footage with streaming buyer replies, the online cup order, and the bakery email exchange. The lower strip leaves room for your camera and narration. Location sound is included; your voice and camera are the remaining pieces.</p><p>The app screens use the real UI with staged story data. They are a film scenario, not a live purchasing run.</p></div>
<div class="files"><a class="button" href="../narration.md">Recording script ↗</a><a class="button" href="narration-v2.srt">Narration timing ↗</a><a class="button" href="../mobile-app/">Mobile recording + inserts ↗</a><a class="button" href="footage-sequence-v1.mp4">Footage only ↗</a><a class="button" href="README-v2.md">Edit notes ↗</a><a class="button" href="index-v1.html">Previous review ↗</a></div>
<footer>No new footage generation or fal credits were used for this edit.</footer>
</main><script>
const player=document.getElementById('review'),cue=document.getElementById('cue'),toggle=document.getElementById('show-cues');
const cues=${JSON.stringify(timeline.captions)};
function updateCue(){const current=cues.find(c=>player.currentTime>=c.start&&player.currentTime<c.end);cue.textContent=current?.text??'';cue.hidden=!toggle.checked||!current}
player.addEventListener('timeupdate',updateCue);player.addEventListener('seeked',updateCue);toggle.addEventListener('change',updateCue);updateCue();
document.querySelectorAll('[data-time]').forEach(button=>button.addEventListener('click',()=>{player.currentTime=Number(button.dataset.time);player.play().catch(()=>{});player.scrollIntoView({block:'center',behavior:'smooth'})}));
</script></body></html>`,
);
console.log("Verified and prepared the complete three-minute film review.");
