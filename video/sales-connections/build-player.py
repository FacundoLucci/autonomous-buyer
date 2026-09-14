"""Create a portable, local-only review player from the HyperFrames frame HTML."""
from pathlib import Path
import re, shutil
p=Path(__file__).parent
out=p.parent.parent/"public"/"sales-story"
out.mkdir(parents=True,exist_ok=True)
shutil.copytree(p/"assets",out/"assets",dirs_exist_ok=True)
styles=[]; bodies=[]; scripts=[]
for name in ["01-square","02-shopify"]:
    html=(p/"compositions"/"frames"/(name+".html")).read_text()
    styles+= [re.search(r"<style>(.*?)</style>",html,re.S).group(1).replace("#root","#frame-"+name)]
    body=re.sub(r"<style>.*?</style>|<script.*?</script>","",html,flags=re.S).replace("<template>","").replace("</template>","").replace('id="root"','id="frame-'+name+'"')
    bodies.append(body)
    scripts+=re.findall(r"<script>(.*?)</script>",html,re.S)
html='''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>BUY HARD · Sales walkthrough</title>
<style>
@font-face{font-family:Arimo;src:url("assets/fonts/arimo.woff2") format("woff2");font-weight:100 900}
*{box-sizing:border-box}body{margin:0;background:#f1f1e7;color:#172015;font-family:Arimo,sans-serif}
header,main{width:min(1500px,100%);margin:auto;padding:24px}header{display:flex;justify-content:space-between;gap:20px;align-items:center}header strong{font-size:21px;letter-spacing:-1px}header a{color:inherit;font-size:14px}
h1{margin:0;font-size:clamp(25px,4vw,40px);letter-spacing:-1px}main>p{line-height:1.6;color:#4c5845;font-size:15px}
#stage{position:relative;width:100%;aspect-ratio:16/9;border:1px solid #bdc9ac;overflow:hidden;background:#fffef7}
#canvas{position:absolute;width:1920px;height:1080px;transform-origin:0 0}
#frame-01-square,#frame-02-shopify{position:absolute!important;left:0;top:0}
.controls{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin:18px 0}
button{font:inherit;min-height:44px;padding:10px 18px;border-radius:5px;background:#fffef7;border:1px solid #bdc9ac;color:#172015;cursor:pointer}
button.primary{background:#172015;color:#fffef7;border-color:#172015}button:focus-visible,a:focus-visible,input:focus-visible{outline:3px solid #37723b;outline-offset:3px}
input[type=range]{flex:1;min-width:150px;accent-color:#37723b;min-height:44px}
#time{font-variant-numeric:tabular-nums;font-size:13px;min-width:85px}
.note{font-size:13px!important}.chapter[aria-pressed=true]{background:#dcec8a;border-color:#738c3e}
@media(max-width:600px){main,header{padding:16px}.controls{gap:8px}input[type=range]{min-width:100%;order:2}.note{font-size:12px!important}}
</style><style>STYLES</style></head><body>
<header><strong>BUY HARD</strong><a href="/?demo=true&page=connections">Back to the interactive demo</a></header>
<main><h1>Sales change. Your buyer keeps up.</h1><p>A 24-second walkthrough of Square sales and Shopify orders changing the next buy.</p>
<div id="stage" role="img" aria-label="Animated sample showing sales bringing a supply reorder forward"><div id="canvas">BODIES</div></div>
<div class="controls"><button class="primary" id="play">Play</button><button id="restart">Replay</button><input id="seek" type="range" min="0" max="24" step="0.05" value="0" aria-label="Animation position"><output id="time" aria-live="off">0:00 / 0:24</output><button class="chapter" id="square" aria-pressed="true">Square</button><button class="chapter" id="shopify" aria-pressed="false">Shopify</button></div>
<p class="note">Sample businesses and events. Figures come from the app’s buying calculator. Purchases are drafts for review. The animation does not connect a store or place an order.</p>
</main><script src="assets/gsap.min.js"></script><script>SCRIPTS</script><script>
const master=gsap.timeline({paused:true});
master.add(window.__timelines["01-square"].paused(false),0);
master.add(window.__timelines["02-shopify"].paused(false),12);
master.set("#frame-02-shopify",{autoAlpha:0},0);
master.set("#frame-01-square",{autoAlpha:1},0);
master.set("#frame-01-square",{autoAlpha:0},12);
master.set("#frame-02-shopify",{autoAlpha:1},12);
master.to({},{duration:24},0);
master.pause(0);
const play=document.querySelector("#play"),seek=document.querySelector("#seek"),time=document.querySelector("#time");
function update(){const t=master.time();seek.value=t;time.textContent="0:"+Math.floor(t).toString().padStart(2,"0")+" / 0:24";play.textContent=master.paused()||t>=24?"Play":"Pause";document.querySelector("#square").setAttribute("aria-pressed",String(t<12));document.querySelector("#shopify").setAttribute("aria-pressed",String(t>=12));}
master.eventCallback("onUpdate",update);master.eventCallback("onComplete",()=>{master.pause();update();});
play.onclick=()=>{if(master.time()>=24)master.restart();else if(master.paused())master.play();else master.pause();update();};
document.querySelector("#restart").onclick=()=>{master.restart();update();};
seek.oninput=()=>{master.pause(Number(seek.value));update();};
document.querySelector("#square").onclick=()=>{master.pause(0);update();};
document.querySelector("#shopify").onclick=()=>{master.pause(12);update();};
function resize(){document.querySelector("#canvas").style.transform="scale("+(document.querySelector("#stage").clientWidth/1920)+")";}
new ResizeObserver(resize).observe(document.querySelector("#stage"));resize();update();
</script></body></html>'''
html=html.replace("STYLES","\n".join(styles)).replace("BODIES","\n".join(bodies)).replace("SCRIPTS","\n".join(scripts))
(out/"index.html").write_text(html)
print("Wrote public/sales-story/index.html")
