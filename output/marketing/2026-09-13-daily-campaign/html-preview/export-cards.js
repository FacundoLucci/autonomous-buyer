async (page) => {
  const results=[];
  await page.setViewportSize({width:1536,height:1024});
  for (const id of ['start_with_source','sales_plan_the_buy','good_day_sample']) {
    await page.goto('http://127.0.0.1:54238/2026-09-13-daily-campaign/html-preview/?card='+id+'&export=1');
    await page.waitForFunction(() => document.fonts.status === 'loaded' && [...document.querySelectorAll('.preview:not([hidden]) img')].every(img => img.complete && img.naturalWidth>0));
    const board=page.locator('.preview[data-card="'+id+'"] .artboard');
    await board.screenshot({path:'/Users/facundo/repos/github/buyer/output/playwright/monday-campaign/'+id+'.png',type:'png',scale:'css',animations:'disabled'});
    const issues=await board.evaluate(el=>{
      const box=el.getBoundingClientRect();
      return [...el.querySelectorAll('.title,.support,.mast,.foot,.step strong,.buyer strong,.sample-tag')].flatMap(node=>{
        const r=node.getBoundingClientRect();
        return r.left<box.left||r.top<box.top||r.right>box.right||r.bottom>box.bottom||node.scrollWidth>node.clientWidth+2 ? [node.className+': overflow'] : [];
      });
    });
    results.push({id,width:1536,height:1024,issues});
  }
  return results;
}