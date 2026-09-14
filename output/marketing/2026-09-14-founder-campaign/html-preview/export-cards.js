async (page) => {
  const origin = 'http://127.0.0.1:54238/2026-09-14-founder-campaign/html-preview/';
  const destination = '/Users/facundo/repos/github/buyer/output/marketing/2026-09-14-founder-campaign/ready';
  const cards = [
    ['old-ui', 'old-ui-annotated.png'],
    ['current-ui', 'current-ui-annotated.png'],
    ['buyer-conversation', 'buyer-conversation.png'],
    ['purchase-decision', 'purchase-decision.png'],
    ['building-buyhard', 'building-buyhard.png'],
    ['small-details', 'small-details.png'],
    ['stay-stocked', 'what-if-stay-stocked.png'],
    ['what-next', 'what-would-you-hand-off.png'],
  ];
  const results = [];
  await page.setViewportSize({width: 1536, height: 1024});
  for (const [id, filename] of cards) {
    await page.goto(`${origin}?card=${id}&export=1`);
    await page.waitForFunction(() => document.fonts.status === 'loaded' &&
      [...document.querySelectorAll('.preview:not([hidden]) img')].every(img => img.complete && img.naturalWidth > 0 && getComputedStyle(img).visibility === 'visible'));
    const board = page.locator(`.preview[data-card="${id}"] .artboard`);
    await board.screenshot({path: `${destination}/${filename}`, type: 'png', scale: 'css', animations: 'disabled'});
    const issues = await board.evaluate(el => {
      const box = el.getBoundingClientRect();
      return [...el.querySelectorAll('.title,.hand,.deck,.mast,.foot')].flatMap(node => {
        const rect = node.getBoundingClientRect();
        return rect.left < box.left || rect.top < box.top || rect.right > box.right || rect.bottom > box.bottom || node.scrollWidth > node.clientWidth + 2
          ? [node.className + ': text leaves its container'] : [];
      });
    });
    results.push({filename, width:1536, height:1024, issues});
  }
  return results;
}
