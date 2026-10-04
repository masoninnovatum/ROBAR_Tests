// VAL703 uses different fixture names than TST703 (confirmed: no "MBSomeSecurity" group here,
// but "MBSome2"/"MBSome3" exist instead). Find out which group MBUser2 actually belongs to here.
// Short explicit timeouts everywhere per the skill's own actionTimeout-defaults-to-unlimited gotcha.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test('find MBUser2 group assignment in VAL703 Security Management', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  await openMenuItem(page, 'Security Management');
  const frame = await findFrame(page, 'Security');
  await page.waitForTimeout(2000);

  const radios = frame.locator('input[type=radio]');
  const radioCount = await radios.count();
  console.log(`radio count: ${radioCount}`);
  await radios.first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_users_view_raw.png', fullPage: true });

  const html = await frame.locator('body').innerHTML();
  // Print just the input elements near the top of the form (filter controls), not the whole page.
  const inputMatches = [...html.matchAll(/<input[^>]*>/gi)].slice(0, 15).map((m) => m[0]);
  console.log('=== first 15 <input> tags ===');
  console.log(inputMatches.join('\n'));

  const bodyText = await frame.locator('body').innerText();
  const idx = bodyText.indexOf('MBUser2');
  console.log('=== text around MBUser2 (or NOT FOUND) ===');
  console.log(idx === -1 ? 'NOT FOUND in current view' : bodyText.slice(Math.max(0, idx - 200), idx + 200));
});
