"""Editable HyperFrames scenes, using the app's computed sample values."""
from pathlib import Path
import json
root=Path(__file__).parent
scenarios=json.loads((root/"scenarios.json").read_text())
css='''
@font-face{font-family:Arimo;src:url("assets/fonts/arimo.woff2") format("woff2");font-weight:100 900}
@font-face{font-family:"Share Tech Mono";src:url("assets/fonts/share-tech-mono.woff2") format("woff2")}
#root{width:1920px;height:1080px;position:relative;overflow:hidden;color:#172015;font-family:Arimo,sans-serif}
.clip{position:absolute;inset:0;width:1920px;height:1080px}.f-ground{background:#fffef7}
.f-chrome{position:absolute;left:96px;right:96px;top:52px;display:flex;align-items:center;justify-content:space-between}
.f-brand{font-size:36px;font-weight:800;letter-spacing:-2px}.f-meta{font:23px "Share Tech Mono",monospace;letter-spacing:1px}
.f-title{position:absolute;left:96px;top:140px;margin:0;font-size:88px;font-weight:700;line-height:1.05;letter-spacing:-4px}
.f-source{position:absolute;left:96px;top:285px;width:640px;height:555px;background:#fffef7;border:2px solid #bdc9ac;border-radius:12px;overflow:hidden;box-sizing:border-box}
.f-window{height:55px;padding:0 28px;border-bottom:1px solid #bdc9ac;display:flex;align-items:center;justify-content:space-between;font:20px "Share Tech Mono",monospace}
.f-body{padding:34px 36px}.f-name{font-size:31px;font-weight:700;margin-bottom:28px}
.f-label{font:22px "Share Tech Mono",monospace;text-transform:uppercase;letter-spacing:1px}
.f-quantity{font-size:114px;line-height:1.06;letter-spacing:-6px;font-weight:700;margin-top:14px}
.f-line{font-size:27px;margin-top:4px}.f-mapping{border-top:1px solid #bdc9ac;padding-top:24px;margin-top:30px;font-size:25px}
.f-event{margin-top:26px;display:flex;align-items:center;gap:11px;font-size:23px;color:#37723b}
.f-dot{width:11px;height:11px;border-radius:50%;background:#37723b}
.f-link{position:absolute;left:754px;top:514px;width:96px;height:76px;overflow:visible}
.f-buyer{position:absolute;left:870px;top:285px;width:954px;height:555px;box-sizing:border-box;background:#dcec8a;border:2px solid #b3c379;border-radius:12px;padding:32px 38px}
.f-top{display:flex;justify-content:space-between;align-items:center}.f-small-brand{font-size:30px;font-weight:800;letter-spacing:-1.5px}
.f-state{position:relative;width:320px;height:26px;font-size:22px;text-align:right}.f-state>span{position:absolute;right:0;top:0}
.f-stock{position:absolute;left:38px;top:106px;width:386px}.f-item{font-size:28px;margin:0}
.f-stack{position:relative;height:116px;margin-top:6px}.f-number{position:absolute;left:0;top:0;font-size:94px;font-weight:700;letter-spacing:-4px;line-height:1.12}
.f-number small{font-size:24px;font-weight:400;letter-spacing:0;margin-left:12px}
.f-track{width:370px;height:10px;background:#b4c566;overflow:hidden;border-radius:5px}.f-fill{height:10px;background:#37723b;transform-origin:0 50%;border-radius:5px}
.f-cover{position:relative;height:46px;margin-top:15px;font-size:24px}.f-cover>span{position:absolute;top:0;left:0}
.f-timing{position:absolute;left:474px;top:110px;width:402px}.f-timing-value{position:relative;height:80px;margin-top:18px}
.f-timing-value>strong{position:absolute;left:0;top:0;font-size:62px;letter-spacing:-2px;line-height:1}
.f-why{font-size:23px;line-height:1.5;margin:5px 0}
.f-message{position:absolute;left:38px;right:38px;top:327px;height:186px;box-sizing:border-box;background:#fffef7;border:1px solid #afc075;border-radius:8px;padding:25px 28px}
.f-author{font:20px "Share Tech Mono",monospace}.f-message p{font-size:31px;font-weight:700;letter-spacing:-.7px;margin:13px 0}
.f-buy-row{display:flex;justify-content:space-between;align-items:center;font-size:24px}.f-pill{font-size:20px;background:#edf3e7;border:1px solid #b6caa7;border-radius:5px;padding:8px 13px}
.f-watching{position:absolute;left:38px;right:38px;top:345px;font-size:31px;line-height:1.4}
.f-foot{position:absolute;left:96px;right:96px;top:874px;display:flex;align-items:center;justify-content:space-between;font-size:25px}
.f-disclaimer{position:absolute;left:96px;top:956px;font:20px "Share Tech Mono",monospace;color:#54634b}
'''
for index,(provider,s) in enumerate(scenarios.items(),1):
    fid=f"{index:02d}-{provider}"
    b,a=s["before"],s["after"]
    title="Busy day. Stock handled." if provider=="square" else "More orders. Boxes ready."
    quote="Busy lunch? Cups are covered." if provider=="square" else "A good launch. A ready buyer."
    item="Cups" if provider=="square" else "Shipping boxes"
    mapping="1 coffee uses 1 cup" if provider=="square" else "1 gift set uses 1 box"
    footer="Your sales change. Your buying plan follows." if provider=="square" else "Stay stocked. Keep doing your thing."
    html=f'''<template><style>{css}</style>
<div id="root" data-composition-id="{fid}" data-start="0" data-duration="12" data-width="1920" data-height="1080">
<div id="scene-{fid}-ground" class="clip f-ground" data-start="0" data-duration="12" data-track-index="0"></div>
<div id="scene-{fid}-content" class="clip f-content" data-start="0" data-duration="12" data-track-index="1">
<div class="f-chrome"><strong class="f-brand">BUY HARD</strong><span class="f-meta">SAMPLE SCENARIO · {s["provider"]}</span></div>
<h1 class="f-title">{title}</h1>
<section class="f-source"><div class="f-window"><span>{s["provider"]} / sample store</span><span>10:42</span></div>
<div class="f-body"><div class="f-name">{s["business"]}</div><div class="f-label">{s["sourceLabel"]}</div>
<div class="f-sales"><div class="f-quantity">{s["saleQuantity"]}</div><div class="f-line">{s["product"]} sold</div></div>
<div class="f-mapping">{mapping}</div><div class="f-event"><span class="f-dot"></span>Sales update received</div></div></section>
<svg class="f-link" viewBox="0 0 96 76" fill="none" aria-hidden="true"><path class="f-arrow" d="M4 38H88M72 22L88 38L72 54" stroke="#37723b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
<section class="f-buyer"><div class="f-top"><strong class="f-small-brand">BUY HARD</strong><div class="f-state"><span class="f-before">Watching your stock</span><span class="f-after">Reorder brought forward</span></div></div>
<div class="f-stock"><p class="f-item">{item}</p><div class="f-stack"><div class="f-number f-before">{b["stock"]}<small>{s["unit"]} left</small></div><div class="f-number f-after">{a["stock"]}<small>{s["unit"]} left</small></div></div><div class="f-track"><div class="f-fill"></div></div><div class="f-cover"><span class="f-before">{b["daysLeft"]} days of cover</span><span class="f-after">{a["daysLeft"]} days of cover</span></div></div>
<div class="f-timing"><div class="f-label">Next buy</div><div class="f-timing-value"><strong class="f-before">In 3 days</strong><strong class="f-after">Today</strong></div><p class="f-why">{s["leadTimeDays"]}d delivery + 1d preparation<br>+ 1d reserve</p></div>
<div class="f-watching">You’re stocked for now.<br>I’ll keep an eye on what changes.</div>
<div class="f-message"><div class="f-author">YOUR BUYER · SAMPLE</div><p>{quote}</p><div class="f-buy-row"><strong>{a["plan"]["quantity"]} {s["unit"]} · {a["orderPacks"]} packs</strong><span class="f-pill">For your review</span></div></div></section>
<div class="f-foot"><span class="f-payoff">{footer}</span><strong>buyhard.app</strong></div>
<div class="f-disclaimer">Illustrative sales and purchase draft · No order has been placed</div>
</div></div>
<script src="assets/gsap.min.js"></script>
<script>
(function(){{
 const scope=document.querySelector('[data-composition-id="{fid}"]');
 const q=s=>scope.querySelectorAll(s);
 const tl=gsap.timeline({{paused:true,defaults:{{ease:"power3.out"}}}});
 tl.fromTo(q(".f-title"),{{y:14,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.45}},0);
 tl.fromTo(q(".f-sales"),{{y:14,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.5}},2);
 tl.fromTo(q(".f-event"),{{y:8,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.4}},3.1);
 tl.fromTo(q(".f-arrow"),{{strokeDasharray:140,strokeDashoffset:140}},{{strokeDashoffset:0,duration:.65}},3.65);
 tl.set(q(".f-before"),{{autoAlpha:0}},4.5);
 tl.fromTo(q(".f-after"),{{y:9,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.45}},4.5);
 tl.fromTo(q(".f-fill"),{{scaleX:1}},{{scaleX:{a["stock"]/b["stock"]},duration:.65}},4.5);
 tl.to(q(".f-watching"),{{autoAlpha:0,duration:.15}},6.85);
 tl.fromTo(q(".f-message"),{{y:12,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.55}},7);
 tl.fromTo(q(".f-why"),{{y:6,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.4}},8.4);
 tl.fromTo(q(".f-payoff"),{{y:6,autoAlpha:0}},{{y:0,autoAlpha:1,duration:.4}},9.5);
 tl.to({{}},{{duration:12}},0);
 window.__timelines=window.__timelines||{{}};
 window.__timelines["{fid}"]=tl;
}})();
</script></template>'''
    (root/"compositions"/"frames"/(fid+".html")).write_text(html.replace("f-","hf-"+fid+"-"))
p=root/"STORYBOARD.md";p.write_text(p.read_text().replace("- status: outline","- status: animated"))
