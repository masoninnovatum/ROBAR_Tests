// Dictionary Management Excel Import (live 2026-10-07, headless, TST703, seed user): Actions > Excel Import = InnoPages/DictionaryManagement/FileSubmission ("Dictionary Excel Data Upload"):
// Download Template link, #spreadsheetFile (+ #fileDisplay), #sheetName, #btnValidate (disabled until a file + sheet), validation grid, signature block, Submit Job. Formal scripts DM_ExcelImport-1.2 and
// DM_ExcelImport_Update-1.3. Self-contained: builds its own workbooks with ExcelJS and its own phrases MBDMI<stamp>x (records cannot be deleted).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as dm from '../support/dictionary';
import * as sec from '../support/security';
import type { Browser } from '@playwright/test';
import { PASSWORD, USERNAME } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const HEADERS = ['Phrase', 'Language', 'Translation', 'EffectiveBegin', 'EffectiveEnd', 'ApprovedBy', 'ApprovalDateTime']; // the downloaded Dictionary_Template.xlsx (the older formal script lists 'Effective Begin Date' etc.)

async function makeXlsx(name: string, rows: Array<Array<string | Date | null>>, sheet = 'Sheet1'): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(r as never);
  const file = path.join(os.tmpdir(), `${name}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

// the Excel import pages live under InnoPages/DictionaryManagement/ but are NOT Management (grid) or ViewEdit (dialog)
const importFrame = (page: Page): Frame => page.frames().filter((x) => {
  const u = x.url();
  return u.includes('InnoPages/DictionaryManagement/') && !u.includes('/Management?') && !u.includes('/ViewEdit');
}).pop()!;

async function openImport(page: Page): Promise<Frame> {
  await dm.openMainAction(page, 'Excel Import');
  for (let i = 0; i < 20 && !page.frames().some((x) => /FileSubmission/i.test(x.url())); i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  return importFrame(page);
}

/** Chooses the file + sheet and presses Validate; returns the page text and the visible dialog text after validation. */
async function validate(page: Page, file: string, sheet = 'Sheet1'): Promise<{ body: string; dialog: string }> {
  const f = importFrame(page);
  await f.locator('#spreadsheetFile').setInputFiles(file);
  await page.waitForTimeout(1500);
  await f.locator('#sheetName').selectOption({ label: sheet });
  await expect(f.locator('#btnValidate')).toBeEnabled();
  await f.locator('#btnValidate').click();
  await page.waitForTimeout(4000);
  console.log(`frames after validate: ${JSON.stringify(page.frames().map((x) => x.url()).filter((u) => /InnoPages/.test(u)))}`);
  const g = importFrame(page);
  return { body: (await g.locator('body').innerText()).replace(/\s+/g, ' '), dialog: (await g.locator('.ui-dialog:visible, .swal2-popup:visible, .modal:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ') };
}

async function sign(page: Page, description: string, user = USERNAME, pw = PASSWORD): Promise<void> {
  const f = importFrame(page);
  console.log(`signature controls: ${JSON.stringify(await f.locator('input:visible, select:visible, button:visible, textarea:visible').evaluateAll((e) => e.map((x) => `${x.id}|${(x as HTMLInputElement).type}|${(x as HTMLInputElement).disabled ? 'dis' : ''}`)))}`);
  await f.locator('input[type=text]:not(#fileDisplay):not(.ui-pg-input):not([id=sigUser])').first().fill(description); // the Job Description box has no id
  await f.locator('#sigUser, input[id*=ser]').first().fill(user);
  await f.locator('#sigPassword, input[type=password]').first().fill(pw);
  await f.locator('#sigReason, select[id*=eason]').first().selectOption({ index: 1 });
  await f.locator('#sigPassword, input[type=password]').first().press('Tab');
}

test('Dictionary Management Excel Import: template, validation errors, new rows, overwrite prompt, signer rights', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  const stamp = Date.now().toString().slice(-6);
  const LANG = `MBLangI${stamp}`;
  const P1 = `MBDMI${stamp}a`;
  const files: string[] = [];
  await dm.openDictionary(page);

  await test.step('page anatomy and Download Template (headers)', async () => {
    const f = await openImport(page);
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(body).toContain('Dictionary Excel Data Upload');
    for (const t of ['Download Template', 'File:', 'Browse', 'Sheet:', 'Validate']) expect(body).toContain(t);
    await expect(f.locator('#btnValidate'), 'Validate disabled until a file + sheet are chosen').toBeDisabled();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), f.getByText('Download Template').click()]);
    const target = path.join(os.tmpdir(), `dm_template_${stamp}.xlsx`);
    await download.saveAs(target);
    console.log(`template file name: ${download.suggestedFilename()}`);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(target);
    const ws = wb.worksheets[0];
    const headers = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(v));
    console.log(`template headers: ${JSON.stringify(headers)} sheet ${ws.name}`);
    expect(headers).toEqual(HEADERS);
    fs.rmSync(target, { force: true });
  });

  await test.step('validation errors: blank Phrase / Language (red cell "This column does not allow null values."), bad dates, duplicate row in Excel', async () => {
    const cell = (col: string) => importFrame(page).locator(`tr.jqgrow td[aria-describedby$="_${col}"]`).first();
    let file = await makeXlsx(`dm_blankphrase_${stamp}`, [['', LANG, 't', '', '', '', '']]); files.push(file);
    let r = await validate(page, file);
    expect(r.body).toContain('Validation Errors');
    expect(await cell('Phrase').locator('div.is-highlighted').getAttribute('title')).toBe('This column does not allow null values.');
    file = await makeXlsx(`dm_blanklang_${stamp}`, [[P1, '', 't', '', '', '', '']]); files.push(file);
    r = await validate(page, file);
    expect(await cell('Language').locator('div.is-highlighted').getAttribute('title')).toBe('This column does not allow null values.');
    file = await makeXlsx(`dm_baddate_${stamp}`, [[P1, LANG, 't', 'not a date', 'also bad', '', '']]); files.push(file);
    r = await validate(page, file);
    const begin = await cell('EffectiveBegin').locator('div.is-highlighted').getAttribute('title').catch(() => null);
    const end = await cell('EffectiveEnd').locator('div.is-highlighted').getAttribute('title').catch(() => null);
    console.log(`bad dates titles: begin="${begin}" end="${end}"`);
    expect(begin, 'a non-date Effective Begin is highlighted').not.toBeNull();
    expect(end, 'a non-date Effective End is highlighted').not.toBeNull();
    file = await makeXlsx(`dm_dup_${stamp}`, [[P1, LANG, 't1', '', '', '', ''], [P1, LANG, 't1', '', '', '', '']]); files.push(file);
    r = await validate(page, file);
    expect(r.body).toContain('Duplicate row in Excel');
    // after validation ERRORS the Validate button stays enabled (it is only disabled again after a No / X on the replace prompt)
    await expect(importFrame(page).locator('#btnValidate')).toBeEnabled();
  });

  await test.step('a valid new row validates, is signed and uploaded (DisplayId + Upload Successful); the record appears unapproved', async () => {
    const file = await makeXlsx(`dm_valid_${stamp}`, [[P1, LANG, 'Imported 1', '1/1/2026', '12/31/2098', '', '']]); files.push(file);
    const r = await validate(page, file);
    expect(r.body).toContain('Validation Successful.');
    await expect(importFrame(page).locator('#btnSubmit'), 'Submit Job disabled until the signature block is complete').toBeDisabled();
    await sign(page, `Playwright import ${stamp}`);
    const f = importFrame(page);
    await expect(f.locator('#btnSubmit')).toBeEnabled();
    await f.locator('#btnSubmit').click();
    await page.waitForTimeout(6000);
    const after = (await importFrame(page).locator('body').innerText()).replace(/\s+/g, ' ');
    expect(after).toMatch(/DisplayId:\s*\d+/);
    expect(after).toContain('Upload Successful.');
    await importFrame(page).locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
    await page.waitForTimeout(4000);
    const found = await dm.search(page, P1);
    expect(found.rows).toHaveLength(1);
    expect(found.rows[0]).toContain('Imported 1');
    expect(found.rows[0]).toContain('1/1/2026');
    expect(found.rows[0]).toContain('12/31/2098');
    expect(found.rows[0], 'imported records are unapproved (no Approved By)').not.toContain(USERNAME);
  });

  await test.step('Row already in database: replace prompt (No / X abort, Yes proceeds), the translation is overwritten', async () => {
    await dm.reopenDictionary(page);
    await openImport(page);
    const file = await makeXlsx(`dm_overwrite_${stamp}`, [[P1, LANG, 'Imported 2', '1/1/2026', '12/31/2098', '', '']]); files.push(file);
    let r = await validate(page, file);
    console.log(`existing row: ${r.body.slice(0, 500)} | dialog: ${r.dialog}`);
    await page.screenshot({ path: 'test-results/dm_import_exists.png' });
    expect(r.body + r.dialog).toContain('Row already in Database'); // capital D here; the formal script says 'database'
    expect(r.body + r.dialog).toContain('The following records will replace data in the database, do you want to proceed?');
    const dlg = () => importFrame(page).locator('.ui-dialog:visible').last();
    await dlg().getByRole('button', { name: 'No' }).click();
    await page.waitForTimeout(1500);
    await expect(importFrame(page).locator('#btnValidate'), 'No aborts: Validate disabled until a new file / sheet').toBeDisabled();
    expect(((await importFrame(page).locator('body').innerText()).replace(/\s+/g, ' '))).not.toContain('Validation Successful.');
    r = await validate(page, file);
    await dlg().locator('.ui-dialog-titlebar-close').click();
    await page.waitForTimeout(1500);
    await expect(importFrame(page).locator('#btnValidate'), 'the X also aborts').toBeDisabled();
    r = await validate(page, file);
    await dlg().getByRole('button', { name: 'Yes' }).click();
    await page.waitForTimeout(2500);
    expect((await importFrame(page).locator('body').innerText()).replace(/\s+/g, ' ')).toContain('Validation Successful.');
    await sign(page, `Playwright overwrite ${stamp}`);
    await importFrame(page).locator('#btnSubmit').click();
    await page.waitForTimeout(6000);
    const after = (await importFrame(page).locator('body').innerText()).replace(/\s+/g, ' ');
    expect(after).toContain('Upload Successful.');
    await importFrame(page).locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
    await page.waitForTimeout(4000);
    const found = await dm.search(page, P1);
    console.log(`after overwrite: ${JSON.stringify(found.rows)}`);
    expect(found.rows[0]).toContain('Imported 2');
  });


  await test.step('the SIGNER needs DM_Import (and DM_ImportOverwrite for the replace path): an MB signer without them is refused with a named process', async () => {
    const adminCtx = await (browser as Browser).newContext();
    const admin = await adminCtx.newPage();
    await sec.openSecurity(admin);
    const MBGROUP = 'MBPWLoginGrp';
    sec.assertMb(MBGROUP);
    const attempt = async (processes: string[]): Promise<string> => {
      await sec.setGroupProcesses(admin, MBGROUP, ['Login_WebMenu', ...processes]);
      await dm.reopenDictionary(page);
      await openImport(page);
      const file = await makeXlsx(`dm_signer_${stamp}_${processes.length}`, [[P1, LANG, 'Imported 3 ' + processes.length, '1/1/2026', '12/31/2098', '', '']]);
      files.push(file);
      await validate(page, file);
      await importFrame(page).locator('.ui-dialog:visible').last().getByRole('button', { name: 'Yes' }).click();
      await page.waitForTimeout(2500);
      await sign(page, 'Playwright signer test', 'MBPWLogin01', PASSWORD);
      await importFrame(page).locator('#btnSubmit').click();
      await page.waitForTimeout(5000);
      return (await importFrame(page).locator('body').innerText()).replace(/\s+/g, ' ') + ' | ' + (await importFrame(page).locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    };
    try {
      const noImport = await attempt([]);
      console.log('signer without DM_Import: ' + noImport.slice(-300));
      expect(noImport).toMatch(/not authorized for this task.{0,6}DM_Import/i);
      const noOverwrite = await attempt(['DM_Import']);
      console.log('signer with DM_Import only: ' + noOverwrite.slice(-300));
      expect(noOverwrite).toMatch(/not authorized for this task.{0,6}DM_ImportOverwrite/i);
    } finally {
      await sec.setGroupProcesses(admin, 'MBPWLoginGrp', ['Login_WebMenu']);
      await adminCtx.close();
    }
  });

  for (const f of files) fs.rmSync(f, { force: true });
});
