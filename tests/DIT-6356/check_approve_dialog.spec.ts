// Diagnostic: dump the real HTML of #approveItemDialog to find the actual Submit button markup,
// instead of guessing another selector variation.

import { test } from '@playwright/test';
import { login, USERNAME, PASSWORD, BASE_URL } from '../support/robar';

const ITEM_NUMBER = 'MBUAT6356E_1790694817112';
const LABEL_TYPE = 'Carton Label';

test('dump approveItemDialog HTML', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  const origin = new URL(BASE_URL).origin;
  const editUrl = `${origin}/InnoPages/items/Edit?itemNumber=${encodeURIComponent(ITEM_NUMBER)}&labelType=${encodeURIComponent(LABEL_TYPE)}&versionNumber=0`;
  await page.goto(editUrl);
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);

  await page.click('text=Actions', { timeout: 5000 });
  await page.click('text=Approve Item', { timeout: 5000 });
  await page.waitForTimeout(500);

  const html = await page.locator('#approveItemDialog').evaluate((el) => el.outerHTML).catch((e) => 'ERROR: ' + e.message);
  console.log('=== #approveItemDialog outerHTML ===');
  console.log(html);
});
