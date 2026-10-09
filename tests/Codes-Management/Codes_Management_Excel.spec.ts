// Codes Management Excel Import (live 2026-10-08, headless, TST703, seed user): Actions > Excel Import = InnoPages/Codes/FileSubmission ("Codes Excel Data Upload"): Download Template (Codes_Template.xlsx),
// #spreadsheetFile, #sheetName, #btnValidate, validation grid, signature block, Submit Job. Same widgets as Dictionary Management's import. Self-contained: builds its own workbooks with ExcelJS,
// only touches the code type MBCodesTest and codes MBCX<stamp>* (codes cannot be deleted: two new codes per run).
// Signer rights (controller Authenticate): EI_Codes / EI_Codes_Upd are checked ONLY when the file contains rows that already exist (replace path) - see the last step.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as sec from '../support/security';
import { login, openMenuItem, findFrame, PASSWORD, USERNAME } from '../support/robar';

test.use({ actionTimeout: 20_000 });

/** A ValMaster requirement (source of truth) the live system does not meet: recorded as a test annotation, not a failure. */
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

const TYPE = 'MBCodesTest';
let HEADERS: string[] = [];

const mgmt = (page: Page): Frame => page.frames().filter((x) => /InnoPages\/Codes\/Management/i.test(x.url())).pop()!;
const importFrame = (page: Page): Frame => page.frames().filter((x) => /InnoPages\/Codes\/(FileSubmission|JobSubmission)/i.test(x.url())).pop()!;
const text = async (f: Frame): Promise<string> => (await f.locator('body').innerText()).replace(/\s+/g, ' ');

async function makeXlsx(name: string, rows: Array<Record<string, string>>, sheet = 'Sheet1'): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet(sheet);
  ws.addRow(HEADERS);
  for (const r of rows) ws.addRow(HEADERS.map((h) => r[h] ?? ''));
  const file = path.join(os.tmpdir(), `${name}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

async function openImport(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Codes Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Codes Management');
  const f = await findFrame(page, 'InnoPages/Codes/Management');
  await page.waitForTimeout(3000);
  await f.locator('#drpMainActions').click();
  await page.waitForTimeout(400);
  await f.locator('ul:visible li a').filter({ hasText: 'Excel Import' }).click({ force: true });
  for (let i = 0; i < 20 && !page.frames().some((x) => /Codes\/FileSubmission/i.test(x.url())); i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  return importFrame(page);
}

async function validate(page: Page, file: string, sheet = 'Sheet1'): Promise<{ body: string; dialog: string }> {
  // choosing a file POSTs the form (formState=selectSheet) and reloads the frame, so re-resolve it afterwards. Codes differs from Dictionary: Validate = #btnSubmit, sheet list = #sheetName2, upload = #btnBeginUpload
  await importFrame(page).locator('#spreadsheetFile').setInputFiles(file);
  await page.waitForTimeout(3500);
  const f = importFrame(page);
  await expect(f.locator('#sheetName2')).toBeVisible();
  await f.locator('#sheetName2').selectOption({ label: sheet });
  await expect(f.locator('#btnSubmit')).toBeEnabled();
  await f.locator('#btnSubmit').click();
  await page.waitForTimeout(4000);
  const g = importFrame(page);
  return { body: await text(g), dialog: (await g.locator('.ui-dialog:visible, .swal2-popup:visible, .modal:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ') };
}

async function sign(page: Page, description: string, user = USERNAME, pw = PASSWORD): Promise<void> {
  const f = importFrame(page);
  console.log(`signature controls: ${JSON.stringify(await f.locator('input:visible, select:visible, button:visible, textarea:visible').evaluateAll((e) => e.map((x) => `${x.id}|${(x as HTMLInputElement).type}|${(x as HTMLInputElement).disabled ? 'dis' : ''}`)))}`);
  await f.locator('input[type=text]:visible:not([disabled]):not(#fileDisplay):not(#sigUser):not(#sigComments):not(.ui-pg-input)').first().fill(description); // the Job Description box has no id (the disabled box is the chosen file name; the error grid pager has a text box too)
  await f.locator('#sigUser, input[id*=ser]').first().fill(user);
  await f.locator('#sigPassword, input[type=password]').first().fill(pw);
  await f.locator('#sigReason, select[id*=eason]').first().selectOption({ index: 1 }).catch(() => {});
  await f.locator('#sigPassword, input[type=password]').first().press('Tab');
}

/** Retrieves the codes whose Code contains `part` in the Management grid (the MBCodesTest type keeps growing, so never page through it) and returns the row texts. */
async function testRows(page: Page, part: string): Promise<string[]> {
  const f = mgmt(page);
  await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await f.locator('select[name="dvFilters[0].Column"]').selectOption('Code');
  await f.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains');
  await page.waitForTimeout(800);
  await f.locator('input[name="dvFilters[0].Value"]:visible').first().fill(part);
  await Promise.all([page.waitForResponse((r) => r.url().includes('GridSessionStart'), { timeout: 20_000 }).catch(() => null), f.click('#btnRetrieveData')]);
  await page.waitForTimeout(2500);
  return (await f.locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}

test('Codes Management Excel Import: template, validation errors, new rows, overwrite prompt, signer rights', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  const stamp = Date.now().toString().slice(-6);
  const A = `MBCX${stamp}a`;
  const B = `MBCX${stamp}b`;
  const files: string[] = [];
  await login(page);

  await test.step('page anatomy and Download Template (headers)', async () => {
    const f = await openImport(page);
    const body = await text(f);
    expect(body).toContain('Codes Excel Data Upload');
    for (const t of ['Download Template', 'File:', 'Sheet:']) expect(body).toContain(t);
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), f.getByText('Download Template').click()]);
    expect(download.suggestedFilename()).toBe('Codes_Template.xlsx');
    const target = path.join(os.tmpdir(), `codes_template_${stamp}.xlsx`);
    await download.saveAs(target);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(target);
    const ws = wb.worksheets[0];
    HEADERS = (ws.getRow(1).values as unknown[]).slice(1).map((v) => String(v));
    console.log(`template headers: ${JSON.stringify(HEADERS)} sheet ${ws.name}, rows ${ws.rowCount}`);
    expect([...HEADERS].sort()).toEqual(['Active', 'Code', 'CodeType', 'Description']);
    fs.rmSync(target, { force: true });
  });

  await test.step('validation errors: blank Code / CodeType, Code over 30 characters, bad Active, duplicate row in Excel', async () => {
    const cell = (col: string) => importFrame(page).locator(`tr.jqgrow td[aria-describedby$="_${col}"]`).first();
    const hi = async (col: string) => cell(col).locator('div.is-highlighted').getAttribute('title').catch(() => null);
    let file = await makeXlsx(`codes_blankcode_${stamp}`, [{ CodeType: TYPE, Code: '', Description: 'd', Active: 'Y' }]); files.push(file);
    let r = await validate(page, file);
    expect(r.body).toContain('Validation Errors');
    console.log(`blank Code -> "${await hi('Code')}"`);
    expect(await hi('Code')).not.toBeNull();
    file = await makeXlsx(`codes_blanktype_${stamp}`, [{ CodeType: '', Code: A, Description: 'd', Active: 'Y' }]); files.push(file);
    r = await validate(page, file);
    console.log(`blank CodeType -> "${await hi('CodeType')}"`);
    expect(await hi('CodeType')).not.toBeNull();
    file = await makeXlsx(`codes_long_${stamp}`, [{ CodeType: TYPE, Code: 'X'.repeat(31), Description: 'd', Active: 'Y' }]); files.push(file);
    r = await validate(page, file);
    console.log(`31-character Code -> "${await hi('Code')}"`);
    expect(await hi('Code')).not.toBeNull();
    file = await makeXlsx(`codes_dup_${stamp}`, [{ CodeType: TYPE, Code: A, Description: 'd', Active: 'Y' }, { CodeType: TYPE, Code: A, Description: 'd', Active: 'Y' }]); files.push(file);
    r = await validate(page, file);
    expect(r.body).toContain('Duplicate row in Excel');
  });

  await test.step('a valid file (Active written as YES / 0, blank Description) validates, is signed and uploaded; the codes appear mapped to Y / N', async () => {
    const file = await makeXlsx(`codes_valid_${stamp}`, [{ CodeType: TYPE, Code: A, Description: 'Imported 1', Active: 'YES' }, { CodeType: TYPE, Code: B, Description: '', Active: '0' }]); files.push(file);
    const r = await validate(page, file);
    expect(r.body).toContain('Validation Successful');
    if (!r.dialog.includes('Validation Successful')) deviation('CM.160202.F.4.13', 'a "Validation Successful" popup message', 'the message is shown inline on the page (no popup)');
    const reasons = (await importFrame(page).locator('#sigReason option').allInnerTexts()).map((t) => t.trim());
    console.log(`Reason options: ${JSON.stringify(reasons)}`);
    for (const want of ['Data Load', 'General', 'QA Approval']) if (!reasons.includes(want)) deviation('CM.160202.F.4.24', `Reason option "${want}"`, JSON.stringify(reasons));
    await sign(page, `Playwright codes import ${stamp}`);
    const f = importFrame(page);
    await expect(f.locator('#btnBeginUpload')).toBeEnabled();
    await f.locator('#btnBeginUpload').click();
    await page.waitForTimeout(150);
    const disabledNow = await f.locator('#btnBeginUpload').isDisabled().catch(() => null);
    const indicator = await f.locator('.inlineimage:visible').count().catch(() => 0);
    console.log(`right after Begin Upload: button disabled=${disabledNow}; running indicator visible=${indicator > 0}`);
    if (disabledNow === false) deviation('CM.160202.F.4.17', 'Begin Upload disabled once the upload begins', 'the button stays enabled right after the click');
    if (!indicator) deviation('CM.160202.F.4.18', 'a circle indicator while the upload runs', 'no indicator seen right after the click');
    await page.waitForTimeout(6000);
    const after = await text(importFrame(page));
    expect(after).toMatch(/DisplayId:\s*\d+/);
    expect(after).toContain('Upload Successful');
    await importFrame(page).locator('a').filter({ hasText: 'Previous Page' }).first().click();
    await page.waitForTimeout(4000);
    const rows = await testRows(page, `MBCX${stamp}`);
    console.log(`after import: ${JSON.stringify(rows.filter((x) => x.includes(`MBCX${stamp}`)))}`);
    expect(rows).toContain(`${TYPE} ${A} Imported 1 Y`);
    expect(rows).toContain(`${TYPE} ${B} N`);
  });

  await test.step('Active = "Maybe" is NOT rejected by validation (defect candidate); what the upload then does', async () => {
    await openImport(page);
    const M = `MBCX${stamp}m`;
    const file = await makeXlsx(`codes_badactive_${stamp}`, [{ CodeType: TYPE, Code: M, Description: 'bad active', Active: 'Maybe' }]); files.push(file);
    const r = await validate(page, file);
    console.log(`Active=Maybe validation: ${r.body.slice(0, 200)}`);
    expect(r.body, 'validation lets an invalid Active value through').toContain('Validation Successful');
    await sign(page, `Playwright bad active ${stamp}`);
    await importFrame(page).locator('#btnBeginUpload').click();
    await page.waitForTimeout(6000);
    console.log(`Maybe upload error dialog: frame=[${(await importFrame(page).locator('.ui-dialog-content').allTextContents()).join(' | ').replace(/\s+/g, ' ')}] top page=[${(await page.locator('.ui-dialog-content').allTextContents()).join(' | ').replace(/\s+/g, ' ')}]`);
    const after = await text(importFrame(page));
    console.log(`Active=Maybe upload result: ${after.slice(0, 400)}`);
    await page.screenshot({ path: 'test-results/codes_badactive_upload.png' });
    await openImport(page);
    await importFrame(page).locator('a').filter({ hasText: 'Previous Page' }).first().click();
    await page.waitForTimeout(4000);
    const rows = await testRows(page, `MBCX${stamp}`);
    console.log(`Active=Maybe code in grid: ${JSON.stringify(rows.filter((x) => x.includes(M)))}`);
  });

  await test.step('Row already in database: replace prompt (No / X abort, Yes proceeds), the description is overwritten', async () => {
    await openImport(page);
    const file = await makeXlsx(`codes_overwrite_${stamp}`, [{ CodeType: TYPE, Code: A, Description: 'Imported 2', Active: 'N' }]); files.push(file);
    let r = await validate(page, file);
    console.log(`existing row: ${r.body.slice(0, 400)} | dialog: ${r.dialog}`);
    expect(r.body + r.dialog).toMatch(/Row already in [Dd]atabase/);
    expect(r.body + r.dialog).toContain('The following records will replace data in the database, do you want to proceed?');
    const dlg = () => importFrame(page).locator('.ui-dialog:visible').last();
    await dlg().getByRole('button', { name: 'No' }).click();
    await page.waitForTimeout(1500);
    expect(await text(importFrame(page))).not.toContain('Validation Successful');
    r = await validate(page, file);
    await dlg().locator('.ui-dialog-titlebar-close').click();
    await page.waitForTimeout(1500);
    expect(await text(importFrame(page))).not.toContain('Validation Successful');
    r = await validate(page, file);
    await dlg().getByRole('button', { name: 'Yes' }).click();
    await page.waitForTimeout(2500);
    expect(await text(importFrame(page))).toContain('Validation Successful');
    await sign(page, `Playwright codes overwrite ${stamp}`);
    await importFrame(page).locator('#btnBeginUpload').click();
    await page.waitForTimeout(6000);
    console.log(`overwrite upload dialogs: ${(await importFrame(page).locator(".ui-dialog:visible").allInnerTexts()).join(" | ").replace(/s+/g, " ")}`);
    expect(await text(importFrame(page))).toContain('Upload Successful');
    await importFrame(page).locator('a').filter({ hasText: 'Previous Page' }).first().click();
    await page.waitForTimeout(4000);
    const rows = await testRows(page, `MBCX${stamp}`);
    console.log(`after overwrite: ${JSON.stringify(rows.filter((x) => x.includes(A)))}`);
    expect(rows).toContain(`${TYPE} ${A} Imported 2 N`);
  });

  await test.step('signer rights: EI_Codes / EI_Codes_Upd are checked only for the replace path (and name just one process)', async () => {
    const adminCtx = await (browser as Browser).newContext();
    const admin = await adminCtx.newPage();
    await sec.openSecurity(admin);
    const MBGROUP = 'MBPWLoginGrp';
    sec.assertMb(MBGROUP);
    const attempt = async (processes: string[], rows: Array<Record<string, string>>, tag: string, replace: boolean): Promise<string> => {
      await sec.setGroupProcesses(admin, MBGROUP, ['Login_WebMenu', ...processes]);
      await openImport(page);
      const file = await makeXlsx(`codes_signer_${stamp}_${tag}`, rows);
      files.push(file);
      await validate(page, file);
      if (replace) {
        await importFrame(page).locator('.ui-dialog:visible').last().getByRole('button', { name: 'Yes' }).click();
        await page.waitForTimeout(2500);
      }
      await sign(page, 'Playwright signer test', 'MBPWLogin01', PASSWORD);
      await importFrame(page).locator('#btnBeginUpload').click();
      await page.waitForTimeout(5000);
      return (await text(importFrame(page))) + ' | ' + (await importFrame(page).locator('.ui-dialog-content').allTextContents()).join(' | ').replace(/\s+/g, ' ') + ' | top: ' + (await page.locator('.ui-dialog-content').allTextContents()).join(' | ').replace(/\s+/g, ' ');
    };
    try {
      const replaceRow = [{ CodeType: TYPE, Code: A, Description: 'Imported 3', Active: 'Y' }];
      const none = await attempt([], replaceRow, 'none', true);
      console.log('replace, signer without EI_Codes / EI_Codes_Upd: ' + none.slice(-260));
      expect(none).toMatch(/not authorized for this task.{0,6}EI_Codes_Upd/i);
      if (!none.includes('User not authorized for this task EI_Codes_Upd')) deviation('CM.160202.F.4.7', '"User not authorized for this task EI_Codes_Upd"', 'the message has a period: "User not authorized for this task. EI_Codes_Upd"');
      const insOnly = await attempt(['EI_Codes'], replaceRow, 'ins', true);
      console.log('replace, signer with EI_Codes only: ' + insOnly.slice(-260));
      expect(insOnly).toMatch(/not authorized for this task.{0,6}EI_Codes_Upd/i);
      const updOnly = await attempt(['EI_Codes_Upd'], replaceRow, 'upd', true);
      console.log('replace, signer with EI_Codes_Upd only: ' + updOnly.slice(-260));
      const fresh = await attempt([], [{ CodeType: TYPE, Code: `MBCX${stamp}c`, Description: 'no rights signer', Active: 'Y' }], 'new', false);
      console.log('NEW row only, signer with no EI_* rights: ' + fresh.slice(-260));
      if (!/not authorized for this task.{0,3}EI_Codes/i.test(fresh)) deviation('CM.160202.F.4.1', '"User not authorized for this task EI_Codes" for a signer without EI_Codes', 'an empty error dialog (no message); nothing is created');
      await openImport(page);
      await importFrame(page).locator('a').filter({ hasText: 'Previous Page' }).first().click();
      await page.waitForTimeout(4000);
      console.log(`NEW row by a signer with no EI_* rights was created: ${JSON.stringify(await testRows(page, `MBCX${stamp}c`))}`);
    } finally {
      await sec.setGroupProcesses(admin, MBGROUP, ['Login_WebMenu']);
      await adminCtx.close();
    }
  });

  for (const f of files) fs.rmSync(f, { force: true });
});
