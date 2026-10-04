// One-off exploratory check: do MBUser2 / MBSomeSecurity (the negative-permission test fixtures
// documented in robar-module-reference.md for Print by Lot's Manufactured-field business rule)
// already exist in VAL703, or do they need to be created here (a separate DB from TST703 where
// they were originally set up for UAT_6356's first execution)?

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test('check Security Management for MBUser2 / MBSomeSecurity in VAL703', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  await openMenuItem(page, 'Security Management');
  const frame = await findFrame(page, 'Security');
  await page.waitForTimeout(2000);

  // Users view: filter by UserID contains "MBUser2"
  await frame.getByRole('radio', { name: 'Users' }).click({ timeout: 5000 }).catch(async () => {
    await frame.locator('input[type=radio]').nth(1).click({ timeout: 5000 }).catch(() => {});
  });
  await page.waitForTimeout(1000);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_security_users_view.png', fullPage: true });

  const bodyText = await frame.locator('body').innerText();
  console.log('=== Security Management body text (first 3000 chars) ===');
  console.log(bodyText.slice(0, 3000));

  const mbuser2Count = await frame.getByText('MBUser2', { exact: false }).count();
  const mbSomeSecCount = await frame.getByText('MBSomeSecurity', { exact: false }).count();
  console.log(`MBUser2 occurrences: ${mbuser2Count}, MBSomeSecurity occurrences: ${mbSomeSecCount}`);
});
