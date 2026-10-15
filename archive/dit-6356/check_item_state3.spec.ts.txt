// Simplest reliable path: unfiltered retrieve (For Items: Any), real pager page-size select to
// 1000 (total schema count already confirmed ~500, fits in one page), then dump the ENTIRE grid
// text and grep for "MBUAT" myself rather than depending on the flakier Add Filter widget or
// exact getByText matches.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { selectSchema } from '../support/master-data';

test('dump full grid and grep for MBUAT', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);
  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await frame.locator('.ui-pg-selbox').first().selectOption('1000', { timeout: 5000 }).catch((e) => console.log('page-size select failed: ' + e.message));
  await page.waitForTimeout(2500);

  const fullText = await frame.locator('#grdMasterData').innerText().catch(async () => frame.locator('body').innerText());
  const lines = fullText.split('\n');
  const matches = lines.filter((l) => l.toUpperCase().includes('MBUAT'));
  console.log(`Total grid lines: ${lines.length}`);
  console.log('=== lines containing MBUAT ===');
  console.log(matches.length ? matches.join('\n') : '(none found)');

  const viewLine = lines.find((l) => l.toLowerCase().includes('view'));
  console.log('view-count line: ' + viewLine);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_full_grid_1000.png', fullPage: true });
});
