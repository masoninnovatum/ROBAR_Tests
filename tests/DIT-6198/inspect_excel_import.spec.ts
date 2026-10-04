// Throwaway inspection script - dump the Master Data Excel Import page's structure (file input,
// any template-download link, schema selector) before writing the real Execute_UAT_6198 script.
import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test('download RobarMasterData excel import template', async ({ page }) => {
  test.setTimeout(60_000);
  await login(page);
  await openMenuItem(page, 'Master Data Excel Import');
  const frame = await findFrame(page, 'ExcelImport');
  await page.waitForTimeout(1500);

  await frame.selectOption('#ddlSchemas', { label: 'RobarMasterData' });
  await page.waitForTimeout(500);

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    frame.getByText('Download Template', { exact: true }).click(),
  ]);
  const savePath = 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\RobarMasterData_template.xlsx';
  await download.saveAs(savePath);
  console.log('Template saved to: ' + savePath);
});
