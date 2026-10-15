// Read-only check: what state are the two candidate MBUAT6356* items actually in right now,
// after a manual save interrupted the automated fill sequence? Every selector here has an
// explicit short timeout -- a wrong guess must fail in seconds, not hang for the whole test
// budget (this app's actionTimeout defaults to unlimited, confirmed the hard way twice already
// today).

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { selectSchema } from '../support/master-data';

const CANDIDATES = ['MBUAT6356_1790693073137', 'MBUAT6356B_1790693287707'];

test('check current state of MBUAT6356 candidate items', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);

  // Stale filter row (Item Number Contains "MBUAT6198D_...") persisted server-side from
  // yesterday's UAT_6198 session and silently excludes every other item -- remove it first.
  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);

  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2500);

  // Real pager page-size <select> (jqGrid's own `.ui-pg-selbox`) -- the JS setGridParam approach
  // reliably reverts to 10 after a Reset/re-retrieve, confirmed twice in DIT-6198 work.
  await frame.locator('.ui-pg-selbox').first().selectOption('1000', { timeout: 5000 }).catch((e) => console.log('page-size select failed: ' + e.message));
  await page.waitForTimeout(2500);

  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_grid_diag.png', fullPage: true });

  for (const itemNumber of CANDIDATES) {
    const count = await frame.getByText(itemNumber).count();
    console.log(`${itemNumber}: present in grid = ${count > 0} (count=${count})`);
    if (count === 0) continue;

    const dataRow = frame.locator('tr').filter({ hasText: itemNumber }).first();
    await dataRow.locator('a:has-text("Actions")').click({ timeout: 10_000 });
    await page.waitForTimeout(500);
    await frame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
    await page.waitForTimeout(1500);

    const fields = ['Effective Begin', 'Primary DI Number', 'Brand Name', 'Device Count', 'Labeler Duns Number', 'Issuing Agency', 'Brand Logo'];
    for (const f of fields) {
      const row = frame.getByRole('row', { name: f });
      const textboxVal = await row.getByRole('textbox').inputValue({ timeout: 3000 }).catch(() => null);
      const selectVal = await row.locator('select').inputValue({ timeout: 3000 }).catch(() => null);
      console.log(`  ${itemNumber} / ${f}: textbox="${textboxVal}" select="${selectVal}"`);
    }
    const bodyText = await frame.locator('body').innerText();
    const idx = bodyText.toLowerCase().indexOf('approved');
    console.log(`  ${itemNumber} / approval status context: ${bodyText.slice(Math.max(0, idx - 50), idx + 50)}`);

    await page.screenshot({ path: `C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_check_${itemNumber}.png`, fullPage: true });
  }
});
