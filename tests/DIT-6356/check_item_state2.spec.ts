// Careful, screenshot-checkpointed version: use the real "Add Filter" widget to search for any
// item number containing "MBUAT" (broad net) and see what actually exists.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { selectSchema } from '../support/master-data';

test('search MBUAT* items via Add Filter widget', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);

  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  await frame.getByText('Add Filter', { exact: true }).first().click({ timeout: 5000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_after_add_filter.png', fullPage: true });

  // Find the newly-added filter row's Value input specifically (last text input on the page).
  const valueInputs = frame.locator('input[type=text]');
  const n = await valueInputs.count();
  console.log(`text input count after Add Filter: ${n}`);
  await valueInputs.last().fill('MBUAT', { timeout: 5000 });
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_filter_filled.png', fullPage: true });

  await frame.locator('#drpApproved').selectOption({ label: 'Any' }, { timeout: 5000 }).catch((e) => console.log('drpApproved select failed: ' + e.message));
  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_filtered_results.png', fullPage: true });

  const bodyText = await frame.locator('body').innerText();
  console.log('=== filtered grid text (first 2000 chars) ===');
  console.log(bodyText.slice(0, 2000));
});
