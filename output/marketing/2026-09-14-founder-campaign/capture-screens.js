async (page) => {
  const root = '/Users/facundo/repos/github/buyer/output/playwright/founder-campaign';
  const origin = 'https://buyhard.app/';
  const qa = '&utm_source=launch-check&utm_medium=qa&utm_campaign=founder_visuals';
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(`${origin}?demo=true&page=dashboard${qa}`);
  await page.getByRole('button', { name: /2 items need stock/ }).waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.screenshot({ path: `${root}/current-dashboard.png`, animations: 'disabled', scale: 'css' });

  await page.goto(`${origin}?demo=true&page=buys&buy=demo-buy-cups${qa}`);
  await page.getByRole('button', { name: /^approve and order$/i }).waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.screenshot({ path: `${root}/current-approval.png`, animations: 'disabled', scale: 'css' });

  await page.goto(`${origin}?demo=true&page=inventory&item=demo-cups${qa}`);
  await page.getByRole('button', { name: /^pause replenishment$/i }).waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.screenshot({ path: `${root}/current-inventory.png`, animations: 'disabled', scale: 'css' });
  await page.getByRole('textbox', { name: 'Message your buyer' }).fill('What’s the status of the paper cups buy?');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await page.getByRole('log', { name: 'Conversation and updates' }).getByText('12 oz paper cups: needs approval.', { exact: true }).waitFor();
  await page.locator('.desk-agent-timeline').evaluate(el => el.scrollTo({ top: 0 }));
  await page.locator('.desk-agent-panel').screenshot({ path: `${root}/current-buyer-conversation.png`, animations: 'disabled', scale: 'css' });

  await page.setViewportSize({ width: 390, height: 844 });
  page.once('dialog', dialog => dialog.accept());
  await page.goto(`${origin}?demo=true&page=buys&buy=demo-buy-cups${qa}`);
  await page.getByRole('button', { name: /^approve and order$/i }).waitFor();
  await page.waitForFunction(() => document.fonts.status === 'loaded');
  await page.screenshot({ path: `${root}/current-approval-mobile.png`, animations: 'disabled', scale: 'css' });
  console.log('Saved five current sample-interface screenshots. No real purchase or supplier action.');
}
