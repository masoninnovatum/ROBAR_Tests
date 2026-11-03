// DIT 6631 repro spike: Master Data > Load External Filter > Upload External File: the Filter Selections dialog's Select Sheet list should hold the workbook's sheets.
import { test } from '@playwright/test';
import * as path from 'path';
import * as mdm from '../../support/master-data';

const SHOT = 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/cbb849bb-1b4f-4282-bd43-98ea9e43b2be/scratchpad/dit6631/';

test('Select Sheet list', async ({ page }) => {
  test.setTimeout(300_000);
  const consoleMsgs: string[] = [];
  page.on('response', async (r) => { if (r.url().includes('UploadExternalFile')) console.log('UPLOADRESP', (await r.text().catch(() => '')).slice(0, 300)); }); page.on('console', (m) => { if (/csp|content security|nonce|refused/i.test(m.text())) consoleMsgs.push(m.text().slice(0, 200)); });
  const frame = await mdm.openMasterData(page);
  await mdm.selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(2500);
  const ops = await frame.locator("select[name$='Operator']").first().locator('option').allInnerTexts().catch(() => []);
  console.log('OPS', JSON.stringify(ops));
  await frame.locator("select[name$='Operator']").first().selectOption({ label: ops.find((o) => /external column/i.test(o) && !/not/i.test(o)) || 'In External Column' });
  await page.waitForTimeout(800);
  await frame.locator("button[id^='btnLoadExternalFilter']").first().click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: SHOT + 'r1.png' });
  await frame.locator('#fileToUpload').setInputFiles(path.resolve('test-data/dit6631/CL_ExternalFilter_DIT6631.xlsx'));
  await page.waitForTimeout(5000);
  await page.screenshot({ path: SHOT + 'r2.png' });
  console.log('NAMES', JSON.stringify(await frame.evaluate(() => (window as any).spreadSheetNames)), 'LISTENER-RAN', await frame.evaluate(() => typeof (window as any).spreadsheetChanged)); const sheets = await frame.locator('#ddlSpreadsheetSelect option').allInnerTexts().catch(() => ['(no dialog)']);
  console.log('SHEETS', JSON.stringify(sheets));
  console.log('CSP', JSON.stringify(consoleMsgs));
});
