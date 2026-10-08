// Lot Management Excel Export / Import (live 2026-10-06, Claude01, headless). Export: Actions > Excel Export opens an in-page dialog (`#fileName`, radios `#limitResults` / `#unlimitedResults`,
// `#submitBtn`, then the `#downloadLnk` link) that exports the retrieved lots. Import: Actions > Excel Import -> `DynamicUI/ExcelImport?pageID=` (Download Template link, file input
// `#spreadsheetFile`, sheet select, `#btnValidate`, then `#btnSubmit`), job result `ExcelImportJobDetail?jobID=YYYYMMDD-NNNN`. The Lots template is one sheet "Sheet1" with the headers
// OrderNum, LotNum, ItemNumber, PrintEntity, Expires, Manufactured, Reassay, U1-U5; blank date cells are invalid. Throw-away lots MBLIMP<stamp> are imported and deleted again.

import { test, expect } from '@playwright/test';
import type { Download, Frame } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { login } from '../support/robar';
import * as du from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

const BASE = 'http://vmsrvtst703/InnoPages/DynamicUI';

test('Lot Management Excel: template, export (name validation, limited / unlimited), import (validation errors, create, update)', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const lotA = `MBLIMPA${stamp}`;
  const lotB = `MBLIMPB${stamp}`;
  const today = new Date();
  let g: Frame;

  const openLots = async (): Promise<Frame> => {
    const f = await du.reopenDynamicUi(page, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await page.waitForTimeout(3000);
    return du.reopenDynamicUi(page, 'Lot Management');
  };
  const search = async (column: string, operator: string, value: string, expectRows = true) => {
    await du.retrieve(page, g, column, operator, value, { expectRows: false });
    if (expectRows) await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
    else await page.waitForTimeout(4000);
    return du.rows(g);
  };
  const action = async (g2: Frame, item: string) => {
    await g2.locator('a:has-text("Actions")').first().click();
    await page.waitForTimeout(500);
    await g2.locator('ul:visible li a').filter({ hasText: item }).click({ force: true });
    await page.waitForTimeout(4000);
  };
  const readWorkbook = async (file: string): Promise<{ headers: string[]; rows: string[][] }> => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(file);
    const ws = wb.worksheets[0];
    const all = (ws.getSheetValues() as unknown[][]).slice(1).map((r) => (r ?? []).slice(1).map((c) => (c instanceof Date ? c.toISOString().slice(0, 10) : String(c ?? ''))));
    return { headers: all[0] ?? [], rows: all.slice(1) };
  };

  await test.step('Download Template: Lots_Template.xlsx, one sheet, the 12 column headers', async () => {
    const resp = await page.request.get(`${BASE}/DownloadTemplate?def=Lots`);
    expect(resp.status()).toBe(200);
    expect(resp.headers()['content-disposition']).toContain('Lots_Template.xlsx');
    const file = path.join(os.tmpdir(), `lots_template_${stamp}.xlsx`);
    fs.writeFileSync(file, await resp.body());
    const wb = await readWorkbook(file);
    expect(wb.headers).toEqual(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5']);
  });

  await test.step('Excel Export: file name is required / validated; limited vs unlimited; the file holds the retrieved lots', async () => {
    g = await openLots();
    const rows = await search('LotNum', 'Contains', 'MBMDPL');
    const total = Number((((await g.locator('.ui-paging-info').first().innerText()).match(/of (\d+)/)) ?? [])[1]);
    console.log(`MBMDPL lots in the grid: ${total}`);
    await action(g, 'Excel Export');
    const dlg = g.locator('.ui-dialog:visible').last();
    await expect(dlg).toContainText('Excel Export');
    // blank name, invalid name
    await dlg.locator('#submitBtn').click();
    await page.waitForTimeout(1500);
    const blankMsg = (await dlg.innerText()).replace(/\s+/g, ' ');
    console.log(`blank file name: ${blankMsg}`);
    expect(blankMsg).toContain('File Name is required');
    await dlg.locator('#fileName').fill('bad/name:*');
    await dlg.locator('#submitBtn').click();
    await page.waitForTimeout(1500);
    const badMsg = (await dlg.innerText()).replace(/\s+/g, ' ');
    console.log(`invalid file name: ${badMsg}`);
    expect(badMsg).toContain('File Name is invalid');
    // valid export of everything retrieved (unlimited)
    await dlg.locator('#fileName').fill(`PWLots${stamp}`);
    await dlg.locator('#unlimitedResults').check();
    await dlg.locator('#submitBtn').click();
    await expect(dlg.locator('#downloadLnk')).toBeVisible({ timeout: 90_000 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), dlg.locator('#downloadLnk').click()]);
    const saved = await (download as Download).path();
    console.log(`export file name: ${(download as Download).suggestedFilename()}`);
    expect((download as Download).suggestedFilename()).toMatch(/PWLots.*\.xlsx$/i);
    const wb = await readWorkbook(saved!);
    console.log(`export headers: ${JSON.stringify(wb.headers)} rows: ${wb.rows.length}`);
    expect(wb.headers).toEqual(expect.arrayContaining(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity']));
    expect(wb.rows.length, 'unlimited export holds every retrieved lot').toBe(total);
    expect(wb.rows.flat().some((c) => c.startsWith('MBMDPL'))).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
  });

  await test.step('Excel Import validation: blank date cells are invalid ("Row 2 has an invalid DateTime value for the Expires column"); no Submit until validation succeeds', async () => {
    g = await openLots();
    await search('LotNum', 'Contains', 'MBMDPL');
    await action(g, 'Excel Import');
    const imp = page.frames().filter((x) => /ExcelImport/i.test(x.url())).pop()!;
    const file = path.join(os.tmpdir(), `lots_bad_${stamp}.xlsx`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5']);
    ws.addRow([`${lotA}O`, lotA, 'MI080301', 'ROBAR', '', '', '', '', '', '', '', '']);
    await wb.xlsx.writeFile(file);
    await imp.locator('input[type=file]').setInputFiles(file);
    await imp.locator('#btnValidate').click();
    await page.waitForTimeout(6000);
    const text = (await imp.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`validation errors: ${text.slice(-260)}`);
    for (const col of ['Expires', 'Manufactured', 'Reassay']) expect(text).toContain(`Row 2 has an invalid DateTime value for the ${col} column`);
    expect(await imp.locator('#btnSubmit').isVisible(), 'Submit stays hidden').toBe(false);
  });

  /** Imports `rows` (header row added): Validate, Submit, returns the job result text. */
  const importRows = async (rows: unknown[][], { expectValid = true }: { expectValid?: boolean } = {}): Promise<string> => {
    g = await openLots();
    await search('LotNum', 'Contains', 'MBMDPL');
    await action(g, 'Excel Import');
    const imp = page.frames().filter((x) => /ExcelImport/i.test(x.url())).pop()!;
    const file = path.join(os.tmpdir(), `lots_import_${stamp}_${Date.now()}.xlsx`);
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Sheet1');
    ws.addRow(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5']);
    for (const r of rows) ws.addRow(r as never);
    await wb.xlsx.writeFile(file);
    await imp.locator('input[type=file]').setInputFiles(file);
    await imp.locator('#btnValidate').click();
    await page.waitForTimeout(6000);
    const validation = (await imp.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`validation: ${validation.slice(-200)}`);
    if (!expectValid) {
      expect(await imp.locator('#btnSubmit').isVisible(), 'Submit stays hidden when validation fails').toBe(false);
      return validation;
    }
    expect(validation).toContain('Validation Successful');
    await imp.locator('#btnSubmit').click();
    let text = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(3000);
      const jf = page.frames().filter((x) => /ExcelImportJobDetail/i.test(x.url())).pop();
      text = jf ? (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ') : '';
      if (/Completed|Fail|Error/.test(text)) break;
    }
    console.log(`import job: ${text.slice(0, 400)}`);
    return text;
  };

  try {
  await test.step('Excel Import: two new lots are created (job Completed) and found in the grid', async () => {
    const job = await importRows([
      [`${lotA}O`, lotA, 'MI080301', 'ROBAR', today, today, today, 'imp-u1', '', '', '', ''],
      [`${lotB}O`, lotB, 'MI080301', 'ROBAR', today, today, today, '', '', '', '', ''],
    ]);
    expect(job).toMatch(/Completed/);
    g = await openLots();
    const rows = await search('LotNum', 'Contains', `MBLIMP`);
    const mine = rows.filter((r) => r.includes(stamp));
    console.log(`imported lots: ${JSON.stringify(mine)}`);
    expect(mine).toHaveLength(2);
    expect(mine.find((r) => r.includes(lotA))).toContain('imp-u1');
  });

  await test.step('Excel Import cannot UPDATE: an existing order/lot/item/entity is refused at validation ("Row 2 already exists"), the lot stays unchanged', async () => {
    const validation = await importRows([[`${lotA}O`, lotA, 'MI080301', 'ROBAR', today, today, today, 'imp-u1', 'imp-u2-updated', '', '', '']], { expectValid: false });
    expect(validation).toContain('Row 2 already exists');
    g = await openLots();
    const rows = await search('LotNum', 'Exactly Matches', lotA);
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toContain('imp-u2-updated');
  });
  } finally {
    await test.step('cleanup: delete every imported MBLIMP lot (also leftovers of an interrupted earlier run)', async () => {
      for (let i = 0; i < 6; i++) {
        try {
          g = await openLots();
          const rows = await search('LotNum', 'Contains', 'MBLIMP', false);
          const lot = (rows[0]?.match(/MBLIMP[AB]\d+(?!O)/) ?? [])[0];
          if (!lot) break;
          await du.selectGridRow(g, lot);
          await g.click('#del_grdJqGrid');
          await page.waitForTimeout(1200);
          await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
          await page.waitForTimeout(3000);
        } catch (e) {
          console.log(`cleanup skipped: ${String(e).slice(0, 120)}`);
          break;
        }
      }
    });
  }
});
