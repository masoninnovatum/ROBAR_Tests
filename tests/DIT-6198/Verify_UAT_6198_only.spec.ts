// Verification-only pass for UAT_6198 - the import itself already succeeded live (confirmed by
// the user watching the Job Details page show 100% success) before this run's own poll loop got
// stuck navigating back to Main Menu. This skips straight to opening the already-imported record.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as fs from 'fs';
import * as path from 'path';

const SCRATCH = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6198_exec`;
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(SCRATCH, 'progress.log'), line + '\n');
}

test('Verify UAT_6198 record - import already succeeded live', async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);
  const results: Record<string, unknown> = {};
  fs.writeFileSync(path.join(SCRATCH, 'progress.log'), '');

  const itemNumber = 'MBUAT6198D_20260928171816';

  log('logging in');
  await login(page);

  log('opening Master Data');
  await openMenuItem(page, 'Master Data');
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  // Dismiss any lingering error dialog from a stale cross-schema query first.
  await mdmFrame.getByRole('button', { name: 'Continue' }).click({ timeout: 3_000 }).catch(() => {});

  // Confirmed live: an earlier session's exploratory query against a DIFFERENT schema
  // (LabelerDuns) left its own "Selected Columns" (Company_Address/Company_City/etc.) persisted
  // at the account level, and querying RobarMasterData while that stale column selection is
  // still active produces a genuine SQL "Invalid column name" error dialog (those columns don't
  // exist on this schema). Click Reset first to clear it back to this schema's own defaults.
  await mdmFrame.getByRole('button', { name: 'Reset' }).click({ timeout: 5_000 }).catch((e) => log('Reset click skipped: ' + e.message));
  await page.waitForTimeout(500);
  await mdmFrame.selectOption('#ddlSchemas', { label: 'RobarMasterData' }).catch((e) => log('schema select skipped: ' + e.message));
  await mdmFrame.locator('#drpApproved').selectOption({ label: 'Any' }).catch((e) => log('For Items=Any select skipped: ' + e.message));
  await mdmFrame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  log('Retrieve Data clicked');
  await page.waitForTimeout(2000);
  // Use the grid's own real page-size selector (standard jqGrid pager markup, no id, only the
  // `.ui-pg-selbox` class per this app's established convention) rather than the JS API - that
  // approach worked before but got reset by this run's earlier Reset click.
  await mdmFrame.locator('.ui-pg-selbox').first().selectOption('1000').catch((e) => log('page-size select skipped: ' + e.message));
  log('page size set to 1000 via .ui-pg-selbox');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step3_retrieved_record.png'), fullPage: true });

  const totalRows = await mdmFrame.locator('tr').count();
  const itemTextCount = await mdmFrame.getByText(itemNumber).count();
  log(`DIAGNOSTIC: total <tr> in frame=${totalRows}, occurrences of itemNumber text anywhere in frame=${itemTextCount}`);

  if (itemTextCount === 0) {
    log('Item not found - the import may not have actually created this record.');
    fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ step3: { pass: false, note: 'Record not found' } }, null, 2));
    return;
  }

  const dataRow = mdmFrame.locator('tr').filter({ hasText: itemNumber }).first();
  await dataRow.locator('a:has-text("Actions")').click({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await mdmFrame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
  log('opened imported record');
  await page.waitForTimeout(1500);

  const brandLogoValue = await mdmFrame.getByRole('row', { name: /^Brand Logo/i }).getByRole('textbox').inputValue().catch(() => null);
  const deviceDescValue = await mdmFrame.getByRole('row', { name: /Device Description/i }).getByRole('textbox').inputValue().catch(() => null);
  const deviceCountValue = await mdmFrame.getByRole('row', { name: /Device Count/i }).getByRole('textbox').inputValue().catch(() => null);

  log(`fields around the blank column: BrandLogo(blank,expected)="${brandLogoValue}" DeviceDescription(after blank)="${deviceDescValue}" DeviceCount(further after)="${deviceCountValue}"`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step3_record_fields_populated.png'), fullPage: true });

  results.step3 = {
    itemNumber,
    brandLogoValue,
    deviceDescValue,
    deviceCountValue,
    pass: Boolean(deviceDescValue && deviceDescValue.length > 0 && deviceCountValue === '1'),
    note: 'Column J (Brand Logo) was left blank in the import file; Device Description (column K, immediately after) and Device Count (column R, further after) both being populated proves the row was not cut short at the blank cell.',
  };

  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify(results, null, 2));
});
