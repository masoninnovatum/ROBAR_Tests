// MDM Excel Import (Main Menu "Master Data Excel Import" -> InnoPages/MasterDataExcelImport): a spreadsheet of records is imported
// into one schema as an async job whose Job Detail page lists row-level errors. Web-only; the workbooks are generated with
// exceljs using the headers of the schema's own "Download Template".
// Covered: template download, a valid import (extra column ignored, new records are unapproved v0), the failure modes
// (missing column = job-level `Missing Columns`; blank required cell / invalid dropdown value = row errors), Validation Rules
// Override, and the overwrite prompt (unapproved record updated IN PLACE; approved record gets a NEW unapproved version; "No" = no job).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import ExcelJS from 'exceljs';
import * as mdm from '../support/master-data';
import { findFrame, USERNAME } from '../support/robar';
import { importSheet, randomDi, openImportPage, attachFile, fillImportSignature, writeWorkbook, closeAllModuleTabs } from '../support/master-data-import';

const HEADERS = ['ItemNumber', 'Description', 'Labeler Duns Number', 'Primary DI Number', 'Brand Name'];
const DUNS = '118117576'; // the one real Labeler Duns record ("Innovatum") on TST703

test('Excel Import: template, valid import, failure modes, override and the overwrite prompt', async ({ page }) => {
  test.setTimeout(900_000);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBXLI${stamp}`;
  await mdm.openMasterData(page);

  /** Opens the Master Data grid for the prefix and returns the version rows' texts ("<item> <version>"). */
  const gridRows = async (value: string, expectRows?: number) => {
    // Close every leftover module tab first: runs crashed the renderer ("Page crashed") on the heavy Edit page with several
    // Job Detail tabs still open.
    await closeAllModuleTabs(page);
    const frame = await mdm.reopenMasterData(page);
    const rows = await mdm.retrieve(page, frame, { value, expectRows });
    await page.waitForTimeout(2500);
    return { frame, rows, texts: (await rows.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace('Actions', '').trim()).sort() };
  };
  /** Opens View/Edit on one version row and returns [edit frame, Brand Name, approval text]. */
  const openVersion = async (frame: Frame, rows: ReturnType<Frame['locator']>, index: number) => {
    await rows.nth(index).locator('a:has-text("Actions")').click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await frame.locator('ul:visible a').filter({ hasText: 'View/Edit' }).first().click({ force: true, timeout: 5000 });
    await page.waitForTimeout(3500);
    const ef = await findFrame(page, 'MasterData/Edit');
    const brand = await ef.getByRole('row', { name: 'Brand Name' }).locator('input').first().inputValue();
    const approval = ((await ef.locator('body').innerText()).match(/Approved By:\s*(\S+)/) ?? [])[1] ?? '';
    return { ef, brand, approval };
  };

  await test.step('Download Template gives the schema\'s own headers (ItemNumber, Description, EffectiveBegin, EffectiveEnd, then the field captions)', async () => {
    const f = await openImportPage(page);
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), f.locator('#downloadLink').click({ timeout: 5000 })]);
    expect(download.suggestedFilename()).toBe('RobarMasterData_Template.xlsx');
    const out = path.join(os.tmpdir(), `pw_template_${stamp}.xlsx`);
    await download.saveAs(out);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out);
    const headers = (wb.worksheets[0].getRow(1).values as string[]).slice(1);
    console.log(`template: ${headers.length} columns, sheet "${wb.worksheets[0].name}"`);
    expect(headers.slice(0, 4)).toEqual(['ItemNumber', 'Description', 'EffectiveBegin', 'EffectiveEnd']);
    expect(headers).toEqual(expect.arrayContaining(['Brand Name', 'Primary DI Number', 'Labeler Duns Number']));
    expect(wb.worksheets[0].rowCount, 'the template is headers only').toBe(1);
  });

  await test.step('page validation: Submit stays disabled until a file and the signature are supplied; unsupported extension is refused', async () => {
    const f = await openImportPage(page);
    await expect(f.locator('#btnSubmitJob')).toBeDisabled();
    const txt = path.join(os.tmpdir(), `pw_bad_${stamp}.txt`);
    fs.writeFileSync(txt, 'not a spreadsheet');
    await f.locator('#spreadsheetFile').setInputFiles(txt, { timeout: 10_000 });
    await page.waitForTimeout(1500);
    await expect(f.locator('#fileDisplay')).toHaveValue('', { timeout: 5000 });
    const fileError = f.locator('#uploadWrapper > div:visible');
    await expect(fileError).toBeVisible({ timeout: 5000 });
    console.log(`file-type error text: "${(await fileError.innerText()).trim()}"`);
    expect((await fileError.innerText()).trim().length).toBeGreaterThan(0);
    await expect(f.locator('#btnSubmitJob')).toBeDisabled();
  });

  await test.step('valid import: two rows + an unrecognised column -> Completed, no errors, records created unapproved at v0', async () => {
    const result = await importSheet(
      page,
      [...HEADERS, 'Junk Column'],
      [
        [prefix + 'A', 'Import A', DUNS, randomDi(), 'Import Brand A', 'x'],
        [prefix + 'B', 'Import B', DUNS, randomDi(), 'Import Brand B', 'y'],
      ],
      { tag: 'valid' }
    );
    console.log(`valid import: ${result?.status} job ${result?.jobId}: ${result?.text.slice(0, 220)}`);
    expect(result?.status).toBe('Completed');
    expect(result?.errorRows, 'an extraneous column is ignored, not an error').toEqual([]);
    expect(result?.text).toContain('Percent Complete 100%');
    expect(result?.text).toContain(`PW import valid`);
    const g = await gridRows(prefix, 2);
    expect(g.texts).toEqual([`${prefix}A 0`, `${prefix}B 0`]);
    const a = await openVersion(g.frame, g.rows, g.texts.findIndex((t) => t.startsWith(prefix + 'A')) === 0 ? 0 : 1);
    expect(a.brand).toBe('Import Brand A');
    expect(a.approval, 'imported records are unapproved').toBe('Unapproved');
  });

  await test.step('missing required column: job-level "Missing Columns" and an EMPTY Errors Only grid', async () => {
    const result = await importSheet(page, HEADERS.slice(0, 4), [[prefix + 'M', 'Missing col', DUNS, randomDi()]], { tag: 'missing' });
    console.log(`missing column: ${result?.status} :: ${result?.text.slice(0, 300)}`);
    expect(result?.status).toBe('ValidationErrors');
    expect(result?.text).toContain('Missing Columns');
    expect(result?.errorRows).toEqual([]);
    expect((await gridRows(prefix + 'M')).texts, 'nothing imported').toEqual([]);
  });

  await test.step('blank required cell -> row error "Brand Name: Required"; invalid dropdown value -> "InvalidValue"', async () => {
    const blank = await importSheet(page, HEADERS, [[prefix + 'N', 'Blank brand', DUNS, randomDi(), undefined]], { tag: 'blank' });
    expect(blank?.status).toBe('ValidationErrors');
    expect(blank?.errorRows).toEqual([['2', prefix + 'N', '0', 'Error', 'Brand Name: Required']]);
    const bad = await importSheet(page, HEADERS, [[prefix + 'V', 'Bad duns', '999999999', randomDi(), 'Brand']], { tag: 'badduns' });
    expect(bad?.status).toBe('ValidationErrors');
    expect(bad?.errorRows).toEqual([['2', prefix + 'V', '0', 'Error', 'Labeler Duns Number: InvalidValue']]);
    expect((await gridRows(prefix + 'N')).texts, 'a failed validation imports nothing').toEqual([]);
    expect((await gridRows(prefix + 'V')).texts).toEqual([]);
  });

  await test.step('a mixed sheet (one valid row, one with a blank required cell): observe what is imported', async () => {
    const good = prefix + 'X1';
    const bad = prefix + 'X2';
    const result = await importSheet(
      page,
      HEADERS,
      [
        [good, 'Mixed good', DUNS, randomDi(), 'Mixed Brand'],
        [bad, 'Mixed bad', DUNS, randomDi(), undefined],
      ],
      { tag: 'mixed' }
    );
    console.log(`mixed sheet: ${result?.status} errors=${JSON.stringify(result?.errorRows)}`);
    expect(result?.status).toBe('ValidationErrors');
    expect(result?.errorRows).toEqual([['3', bad, '0', 'Error', 'Brand Name: Required']]);
    const g = await gridRows(prefix + 'X');
    console.log(`mixed sheet imported: ${JSON.stringify(g.texts)}`);
    expect(g.texts, 'the whole sheet is rejected when any row fails validation').toEqual([]);
  });

  await test.step('the failed job offers a Download Spreadsheet link (the uploaded file name)', async () => {
    const result = await importSheet(page, HEADERS, [[prefix + 'W', 'Dl', DUNS, randomDi(), undefined]], { tag: 'dl' });
    const link = result!.frame.locator('a').filter({ hasText: /^pw_import_dl_\d+\.xlsx$/ });
    await expect(link).toHaveCount(1, { timeout: 5000 });
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), link.click({ timeout: 5000 })]);
    const out = path.join(os.tmpdir(), `pw_dl_${stamp}.xlsx`);
    await download.saveAs(out);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(out);
    const sheet = wb.worksheets[0];
    const dump = JSON.stringify([1, 2].map((r) => (sheet.getRow(r).values as any[]).slice(1)));
    console.log(`downloaded result sheet "${sheet.name}": ${dump.slice(0, 400)}`);
    expect(fs.statSync(out).size).toBeGreaterThan(1000);
  });

  await test.step('Validation Rules Override lets the blank required cell import', async () => {
    const result = await importSheet(page, HEADERS, [[prefix + 'O', 'Override', DUNS, randomDi(), undefined]], { tag: 'override', override: true });
    expect(result?.status).toBe('Completed');
    expect(result?.errorRows).toEqual([]);
    const g = await gridRows(prefix + 'O', 1);
    expect(g.texts).toEqual([`${prefix}O 0`]);
    const o = await openVersion(g.frame, g.rows, 0);
    expect(o.brand, 'the required Brand Name stayed blank').toBe('');
  });

  await test.step('overwrite prompt: "No" creates no job; "Yes" updates an UNAPPROVED record in place', async () => {
    const item = prefix + 'G';
    expect((await importSheet(page, HEADERS, [[item, 'Good', DUNS, randomDi(), 'Brand G1']], { tag: 'g1' }))?.status).toBe('Completed');
    const no = await importSheet(page, HEADERS, [[item, 'Good', DUNS, randomDi(), 'Brand NO']], { tag: 'g-no', onExisting: 'No' });
    expect(no, 'answering No stops before any job is created').toBeUndefined();
    let g = await gridRows(item, 1);
    expect((await openVersion(g.frame, g.rows, 0)).brand, 'No changed nothing').toBe('Brand G1');
    expect((await importSheet(page, HEADERS, [[item, 'Good', DUNS, randomDi(), 'Brand G2']], { tag: 'g2' }))?.status).toBe('Completed');
    g = await gridRows(item, 1);
    expect(g.texts, 'still ONE version row').toEqual([`${item} 0`]);
    const v0 = await openVersion(g.frame, g.rows, 0);
    expect(v0.brand).toBe('Brand G2');

    // approve (Mass Approve is the reliable path), then import again: an APPROVED record gets a NEW unapproved version
    const grid = await mdm.backToGrid(page, v0.ef);
    await mdm.retrieve(page, grid, { value: item, expectRows: 1 });
    await mdm.checkRows(grid, [item]);
    await mdm.openBulkAction(grid, 'actMassApprove');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
    await mdm.fillJobSignature(jobFrame, `Playwright import approve ${stamp}`, 'General Approval');
    expect((await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassApprove/JobDetail')).status).toBe('Completed');

    expect((await importSheet(page, HEADERS, [[item, 'Good', DUNS, randomDi(), 'Brand G3']], { tag: 'g3' }))?.status).toBe('Completed');
    g = await gridRows(item, 2);
    expect(g.texts, 'the approved v0 is kept and a v1 is added').toEqual([`${item} 0`, `${item} 1`]);
    const versionRow = async (v: string) => {
      const idx = (await g.rows.allInnerTexts()).findIndex((t) => new RegExp(`${item}\\s+${v}\\b`).test(t.replace(/\s+/g, ' ')));
      return idx;
    };
    const old = await openVersion(g.frame, g.rows, await versionRow('0'));
    expect([old.brand, old.approval.toLowerCase()], 'v0 untouched and still approved').toEqual(['Brand G2', USERNAME.toLowerCase()]);
    g = await gridRows(item, 2);
    const fresh = await openVersion(g.frame, g.rows, await versionRow('1'));
    expect([fresh.brand, fresh.approval], 'v1 carries the imported value, unapproved').toEqual(['Brand G3', 'Unapproved']);
  });

  await closeAllModuleTabs(page);
  void writeWorkbook; void attachFile; void fillImportSignature;
});
