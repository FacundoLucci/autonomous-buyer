import { cpSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repository = path.resolve(here, "../..");
const folder = path.join(repository, "assets/storyboard/you-handle-today-footage/mobile-app");
mkdirSync(path.join(folder, "site/brand"), { recursive: true });
cpSync(path.join(repository, "public/brand"), path.join(folder, "site/brand"), { recursive: true });
// CSS masks resolve the component's relative URLs from the bundled stylesheet.
cpSync(path.join(repository, "public/brand"), path.join(folder, "site/assets/brand"), {
  recursive: true,
});
writeFileSync(
  path.join(folder, "site/stream-test.html"),
  readFileSync(path.join(folder, "site/index.html"), "utf8").replace(
    'data-duration="90"',
    'data-duration="8" data-offset="10"',
  ),
);
const chapters = [
  { name: "Handoff", start: 0, end: 24 },
  { name: "Cups online", start: 24, end: 32 },
  { name: "Bakery email", start: 32, end: 53 },
  { name: "Review terms", start: 53, end: 68 },
  { name: "Confirmations", start: 68, end: 78 },
  { name: "Later change", start: 78, end: 90 },
];
writeFileSync(
  path.join(folder, "chapters.json"),
  JSON.stringify(
    {
      duration: 90,
      fps: 24,
      width: 1080,
      height: 2340,
      viewport: { width: 360, height: 780 },
      chapters,
    },
    null,
    2,
  ) + "\n",
);
writeFileSync(
  path.join(folder, "index.html"),
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BUY HARD · Mobile app recording</title><style>
*{box-sizing:border-box}body{margin:0;color:#15170f;background:#dce985;font:16px/1.5 Arial,Helvetica,sans-serif}main{max-width:1160px;margin:auto;padding:26px 16px}header{border-top:2px solid;padding:14px 0;font:12px monospace}h1{font-size:54px;letter-spacing:-.06em;line-height:1.05}a{color:inherit}p{max-width:750px}.grid{display:grid;grid-template-columns:360px minmax(0,1fr);gap:48px;margin-top:30px}iframe{display:block;width:360px;height:780px;border:0;outline:1px solid #15170f;pointer-events:none;background:#eef1d5}video{width:100%;max-width:360px;max-height:780px;background:#eef1d5;border:1px solid}.controls{margin:24px 0;display:flex;gap:8px;flex-wrap:wrap}button{font:12px monospace;padding:11px 14px;background:#eef1d5;color:inherit;border:1px solid;cursor:pointer}input{width:100%;accent-color:#15170f}.note{font-size:14px;border-top:1px solid;padding-top:16px}h2{font-size:24px;letter-spacing:-.03em}@media(max-width:800px){.grid{grid-template-columns:1fr;gap:28px}h1{font-size:44px}}
</style></head><body><main><header>BUY HARD / MOBILE APP RECORDING</header><h1>One handoff.<br>The buyer takes it from there.</h1><p>Actual app components at a 360 × 780 mobile viewport. Buyer replies stream in; supplier emails and order terms stay still for reading.</p><div class="controls"><button id="play">Play preview</button>${chapters.map((c) => `<button data-time="${c.start}">${c.name}</button>`).join("")}</div><label for="seek">Preview time: <output id="time">0:00</output> / 1:30</label><input id="seek" type="range" min="0" max="89.95" step="0.05" value="0"><div class="grid"><div><iframe id="app" src="site/app.html" title="Actual mobile UI — staged recording"></iframe></div><div><h2>The exported recording</h2><video controls playsinline preload="metadata" poster="poster.jpg" src="mobile-app-staged-v1.mp4"></video><p><a href="mobile-app-staged-v1.mp4" download>Download mobile recording</a> · <a href="chapters.json">Chapter timings</a></p><h2>Separate inserts</h2><p>${chapters.map((c, i) => `<a href="clips/${String(i + 1).padStart(2, "0")}-${c.name.toLowerCase().replaceAll(" ", "-")}.mp4" download>${c.name}</a>`).join(" · ")}</p><p class="note">This uses the real app UI with a staged film scenario. Replies and supplier outcomes are sample data, with timing controlled for the recording. It is not a live purchasing run. No orders or supplier emails are sent.</p><p><a href="../assembly/index.html">Back to the three-minute footage review</a></p></div></div></main><script>
const app=document.getElementById('app'),seek=document.getElementById('seek'),button=document.getElementById('play');let playing=false,position=0,last=0;function draw(t){position=Math.max(0,Math.min(89.95,t));app.contentWindow.renderMobile?.(position);seek.value=position;document.getElementById('time').textContent=Math.floor(position/60)+':'+String(Math.floor(position%60)).padStart(2,'0')}function tick(now){if(!playing)return;draw(position+(now-last)/1000);last=now;if(position>=89.95){playing=false;button.textContent='Play preview';return}requestAnimationFrame(tick)}function pause(){playing=false;button.textContent='Play preview'}button.onclick=()=>{if(playing){pause();return}playing=true;button.textContent='Pause preview';last=performance.now();requestAnimationFrame(tick)};seek.oninput=()=>{pause();draw(Number(seek.value))};document.querySelectorAll('[data-time]').forEach(b=>b.onclick=()=>{pause();draw(Number(b.dataset.time))});app.onload=async()=>{await app.contentWindow.mobileReady;draw(position)};
</script></body></html>`,
);
console.log("Prepared mobile recording review and chapter timings.");
