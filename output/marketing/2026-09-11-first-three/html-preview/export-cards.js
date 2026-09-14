async (page) => {
  const requestedCard = page.url().match(/[?&]card=([^&]+)/)?.[1];
  await page.setViewportSize({ width: 1536, height: 1024 });
  for (const [card, filename] of [
    ['buyer', 'meet-your-new-buyer-html.png'],
    ['openai', 'your-buyer-stays-ahead-html.png'],
    ['napkin', 'now-i-have-a-machine-buyer-handwritten.png'],
    ['firecrawl', 'automated-buying-html.png'],
  ]) {
    if (requestedCard && requestedCard !== 'all' && requestedCard !== card) continue;
    await page.goto(`http://127.0.0.1:54237/html-preview/?card=${card}&export=1`);
    await page.waitForFunction(() => document.fonts.status === 'loaded'
      && [...document.querySelectorAll('.artboard img')].every(image => image.complete
        && image.naturalWidth > 0 && getComputedStyle(image).visibility === 'visible'));
    const artboard = page.locator(`.artboard.${card}`);
    await artboard.screenshot({
      path: `/Users/facundo/repos/github/buyer/output/marketing/2026-09-11-first-three/ready/${filename}`,
      type: 'png',
      scale: 'css',
      animations: 'disabled',
    });
    console.log(`${filename}: 1536 × 1024, fonts and product cutouts loaded`);
  }
}
