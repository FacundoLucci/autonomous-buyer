async (page) => {
  // Capture the actual UI at 2x resolution so the enlarged detail stays sharp.
  const detail = await page.context().browser().newPage({
    viewport: {width:1440,height:1000},
    deviceScaleFactor: 2,
  });
  try {
    await detail.goto('https://buyhard.app/?demo=true&page=buys&buy=demo-buy-cups&utm_source=launch-check&utm_medium=qa&utm_campaign=founder_visuals');
    await detail.getByRole('button', {name:/^approve and order$/i}).waitFor();
    await detail.waitForFunction(() => document.fonts.status === 'loaded');
    await detail.screenshot({
      path:'/Users/facundo/repos/github/buyer/output/playwright/founder-campaign/current-approval-2x.png',
      animations:'disabled',
      scale:'device',
    });
    return {width:2880,height:2000,cssViewport:'1440x1000',deviceScaleFactor:2};
  } finally { await detail.close(); }
}
