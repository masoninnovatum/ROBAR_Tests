// Isolated, fast diagnostic: navigate straight to the already-created MBUAT6356D item (id 213911,
// left mid-edit on the Packaging Structure tab from the last failed run) and probe the Device
// Count row/textbox directly with short timeouts and explicit counts, instead of re-running the
// full multi-minute creation flow again.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { selectSchema } from '../support/master-data';

test('diagnose Device Count field', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);

  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await frame.getByText('Add Filter', { exact: true }).last().click({ timeout: 5000, force: true });
  await page.waitForTimeout(800);
  await frame.locator('.criteriaFilter-ColumnSelect').last().selectOption({ label: 'Item Number' }, { timeout: 5000 });
  await page.waitForTimeout(500);
  await frame.locator('.criteriaFilter-Filter select').nth(1).selectOption({ label: 'Contains' }, { timeout: 5000 }).catch(() => {});
  await frame.locator('.criteriaFilter-Value').last().fill('MBUAT6356D', { timeout: 5000 });
  await frame.locator('#drpApproved').selectOption({ label: 'Any' }, { timeout: 5000 }).catch(() => {});
  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2000);

  const dataRow = frame.locator('tr').filter({ hasText: 'MBUAT6356D' }).first();
  await dataRow.locator('a:has-text("Actions")').click({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await frame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
  await page.waitForTimeout(1500);

  await frame.getByText('Packaging Structure', { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(1000);

  const rowLocator = frame.getByRole('row', { name: 'Device Count' });
  const rowCount = await rowLocator.count();
  console.log(`Device Count row count: ${rowCount}`);

  const textboxCount = await rowLocator.getByRole('textbox').count();
  console.log(`Device Count row -> textbox count: ${textboxCount}`);

  if (textboxCount > 0) {
    const currentValue = await rowLocator.getByRole('textbox').first().inputValue({ timeout: 3000 }).catch((e) => 'ERROR: ' + e.message);
    console.log(`Device Count current value: "${currentValue}"`);

    const isVisible = await rowLocator.getByRole('textbox').first().isVisible().catch((e) => 'ERROR: ' + e.message);
    const isEnabled = await rowLocator.getByRole('textbox').first().isEnabled().catch((e) => 'ERROR: ' + e.message);
    console.log(`Device Count textbox: visible=${isVisible} enabled=${isEnabled}`);

    console.log('Attempting fill with 5s timeout...');
    await rowLocator.getByRole('textbox').first().fill('1', { timeout: 5000 })
      .then(() => console.log('Fill succeeded'))
      .catch((e) => console.log('Fill failed: ' + e.message));
  }

  const rowHtml = await rowLocator.first().evaluate((el) => el.outerHTML).catch((e) => 'ERROR: ' + e.message);
  console.log('Row outerHTML: ' + rowHtml);
});
