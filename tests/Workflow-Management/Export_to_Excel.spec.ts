// Workflow Management > Bulk Actions > Export to Excel (re-check, 2026-10-05). The earlier notes recorded a silent HTTP 503 from
// `GET /InnoPages/WorkflowManagement/ExportToExcel` (the same shape as an old Master Data finding). In 7.0.3.20198 on TST703 it
// WORKS: the GET answers 200 with an .xlsx body, the browser downloads `WorkflowExport.xlsx`, and the file lists the ticked
// workflows. Headless; read-only. Page anatomy: tile "Workflow Management" -> `InnoPages/WorkflowManagement/Management`; "Find
// Workflows for User" `#drpUser` (defaults to the logged-in user), `#drpApproved`, `#btGetWorkflows`; grid `#gridResults`
// (columns Workflow ID, Change Control ID, Workflow Description, Status, Last User, Last Status Change, Detail); Bulk Actions
// `#drpActions` -> `#actWfEdit`, `#actViewAndVote`, `#actWfReport`, `#actWfExportToExcel` (needs at least one ticked row).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import ExcelJS from 'exceljs';
import { login, openMenuItem, findFrame } from '../support/robar';

test('Workflow Management Export to Excel downloads a valid workbook with the ticked workflows (the old 503 does not reproduce)', async ({ page }) => {
  test.setTimeout(240_000);
  await login(page);
  await openMenuItem(page, 'Workflow Management');
  const f = await findFrame(page, 'WorkflowManagement');
  await f.locator('#btGetWorkflows').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(3000);

  await f.locator('#drpUser').selectOption({ label: 'Any User' }, { timeout: 5000 });
  await f.click('#btGetWorkflows', { timeout: 5000 });
  await f.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);

  const ids = (await f.locator('#gridResults tr.jqgrow').evaluateAll((trs) => trs.slice(0, 2).map((tr) => (tr.querySelector('td[aria-describedby="gridResults_WorkflowID"]')?.textContent ?? '').trim()))).filter(Boolean);
  expect(ids.length, 'two workflow ids read from the grid').toBe(2);
  for (let i = 0; i < 2; i++) await f.locator('#gridResults tr.jqgrow').nth(i).locator('input[type=checkbox]').check({ timeout: 5000 });
  await page.waitForTimeout(1200);
  await expect(f.locator('#drpActions'), 'Bulk Actions appear once rows are ticked').toBeVisible();
  await f.locator('#drpActions').click();
  await page.waitForTimeout(500);
  expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(expect.arrayContaining(['Export to Excel']));

  const [response, download] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/WorkflowManagement/ExportToExcel'), { timeout: 20_000 }),
    page.waitForEvent('download', { timeout: 20_000 }),
    f.locator('#actWfExportToExcel').click({ force: true }),
  ]);
  expect(response.status(), 'ExportToExcel is not the old 503').toBe(200);
  expect(response.headers()['content-type']).toContain('spreadsheetml.sheet');
  expect(download.suggestedFilename()).toBe('WorkflowExport.xlsx');
  const out = path.join(os.tmpdir(), `pw_wf_export_${Date.now()}.xlsx`);
  await download.saveAs(out);
  expect(fs.statSync(out).size).toBeGreaterThan(1000);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(out);
  const ws = wb.worksheets[0];
  const header = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(v ?? ''));
  console.log(`export: sheet "${ws.name}", ${ws.rowCount} rows, header ${JSON.stringify(header)}`);
  const text = JSON.stringify(ws.getSheetValues());
  for (const id of ids) expect(text, `workflow ${id} is in the export`).toContain(id);
  expect(ws.rowCount, 'header + one row per ticked workflow').toBe(1 + ids.length);
});
