// Capture MBSome2's CURRENT authorization state for the 3 processes UAT_6356 needs to toggle,
// before touching anything -- so we can restore it exactly afterward (per the skill's standing
// rule: never assume, confirm the original value first).

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

const PROCESSES = ['BP_AllowMfgChangeAtPrint', 'BP_AllowMfgSetAtPrint', 'Override_Lot_At_Print'];

test('capture MBSome2 baseline process authorizations', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  await openMenuItem(page, 'Security Management');
  const frame = await findFrame(page, 'Security');
  await page.waitForTimeout(2000);

  await frame.locator('#rbGroups').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await frame.locator('#groupFilterInput').fill('MBSome2', { timeout: 5000 });
  await frame.locator('#btnApplyGroupFilter').click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  // A plain Playwright click (even force:true) refuses on this grid's row cell ("Element is not
  // visible" -- likely the same virtualized/hidden-until-scrolled grid pattern documented
  // elsewhere in this app). Dispatch a real click event directly via the DOM instead.
  await frame.evaluate(() => {
    const cells = [...document.querySelectorAll('td')];
    const cell = cells.find((td) => td.textContent?.trim() === 'MBSome2');
    if (!cell) throw new Error('MBSome2 cell not found in DOM');
    cell.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  });
  await page.waitForTimeout(1000);

  const results: Record<string, boolean | null> = {};
  for (const proc of PROCESSES) {
    await frame.locator('#processFilterInput').fill(proc, { timeout: 5000 });
    await page.waitForTimeout(800);
    const row = frame.locator('tr', { hasText: proc }).first();
    const checked = await row.locator('input[type=checkbox]').first().isChecked({ timeout: 5000 }).catch(() => null);
    results[proc] = checked;
    console.log(`${proc}: checked=${checked}`);
  }

  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_mbsome2_baseline.png', fullPage: true });
  console.log('BASELINE_JSON=' + JSON.stringify(results));
});
