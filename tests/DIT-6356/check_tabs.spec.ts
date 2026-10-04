// Diagnostic: the Master Data Edit page for RobarMasterData is tabbed (Device Id, Packaging
// Structure, Regulatory Data, Traceabilty and Iso Symbols, Characteristics, Storage and Handling,
// Sterilization Method, Additional Identifiers, GUDID Control). Find which tab actually contains
// "Device Count" -- confirmed NOT on the default "Device Id" tab, which is why fillFieldByCaption
// hung waiting for that row on every previous attempt.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { selectSchema } from '../support/master-data';

const TABS = [
  'Device Id', 'Packaging Structure', 'Regulatory Data', 'Traceabilty and Iso Symbols',
  'Characteristics', 'Storage and Handling', 'Sterilization Method', 'Additional Identifiers',
  'GUDID Control',
];

test('find which tab holds Device Count', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);

  // Reuse the item already created and left in an unapproved state on the DB (item id 213901).
  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await frame.getByText('Add Filter', { exact: true }).last().click({ timeout: 5000, force: true });
  await page.waitForTimeout(800);
  await frame.locator('.criteriaFilter-ColumnSelect').last().selectOption({ label: 'Item Number' }, { timeout: 5000 });
  await page.waitForTimeout(500);
  await frame.locator('.criteriaFilter-Filter select').nth(1).selectOption({ label: 'Contains' }, { timeout: 5000 }).catch(() => {});
  await frame.locator('.criteriaFilter-Value').last().fill('MBUAT6356C', { timeout: 5000 });
  await frame.locator('#drpApproved').selectOption({ label: 'Any' }, { timeout: 5000 }).catch(() => {});
  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2000);

  const dataRow = frame.locator('tr').filter({ hasText: 'MBUAT6356C' }).first();
  await dataRow.locator('a:has-text("Actions")').click({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await frame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
  await page.waitForTimeout(1500);

  for (const tabName of TABS) {
    await frame.getByText(tabName, { exact: true }).click({ timeout: 5000 }).catch((e) => console.log(`tab click failed for ${tabName}: ${e.message}`));
    await page.waitForTimeout(500);
    const count = await frame.getByText('Device Count', { exact: true }).count();
    console.log(`tab "${tabName}": Device Count present = ${count > 0}`);
    if (count > 0) {
      await page.screenshot({ path: `C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_tab_${tabName.replace(/\s/g, '_')}.png`, fullPage: true });
    }
  }
});
