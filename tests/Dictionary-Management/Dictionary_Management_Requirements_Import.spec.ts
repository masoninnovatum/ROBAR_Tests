// Dictionary Management Excel Import vs the ValMaster requirements (2026-10-09; .agents/valmaster-dictionary-management.md): Sheet dropdown (F.2.17 / F.2.18), import defaults (F.2.11-F.2.15),
// all-or-nothing validation (F.2.21), overwriting an APPROVED record creates a new unapproved version when ApprovedBy / ApprovalDateTime are blank (F.2.6). Seed user, headless, TST703. Own records
// MBDMX<stamp>a/b/c/d (undeletable). A requirement the system does not meet is recorded as a test annotation `deviation <id>`.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as dm from '../support/dictionary';
import { PASSWORD, USERNAME } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const HEADERS = ['Phrase', 'Language', 'Translation', 'EffectiveBegin', 'EffectiveEnd', 'ApprovedBy', 'ApprovalDateTime'];
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}
const norm = (s: string): string => s.replace(/\s+/g, ' ').trim();
const files: string[] = [];

async function makeXlsx(name: string, rows: Array<Array<string | Date | null>>, sheets: string[] = ['Sheet1']): Promise<string> {
  const wb = new ExcelJS.Workbook();
  for (const s of sheets) {
    const ws = wb.addWorksheet(s);
    ws.addRow(HEADERS);
    if (s === sheets[0]) for (const r of rows) ws.addRow(r as never);
  }
  const file = path.join(os.tmpdir(), `${name}.xlsx`);
  await wb.xlsx.writeFile(file);
  files.push(file);
  return file;
}
const importFrame = (page: Page): Frame => page.frames().filter((x) => {
  const u = x.url();
  return u.includes('InnoPages/DictionaryManagement/') && !u.includes('/Management?') && !u.includes('/ViewEdit');
}).pop()!;

async function openImport(page: Page): Promise<Frame> {
  await dm.reopenDictionary(page);
  await dm.openMainAction(page, 'Excel Import');
  for (let i = 0; i < 20 && !page.frames().some((x) => /FileSubmission/i.test(x.url())); i++) await page.waitForTimeout(1000);
  await page.waitForTimeout(1500);
  return importFrame(page);
}
async function choose(page: Page, file: string): Promise<void> {
  await importFrame(page).locator('#spreadsheetFile').setInputFiles(file);
  await page.waitForTimeout(2500);
}
async function validate(page: Page, file: string, sheet = 'Sheet1'): Promise<string> {
  await choose(page, file);
  const f = importFrame(page);
  await f.locator('#sheetName').selectOption({ label: sheet });
  await expect(f.locator('#btnValidate')).toBeEnabled();
  await f.locator('#btnValidate').click();
  await page.waitForTimeout(4500);
  return norm(await importFrame(page).locator('body').innerText());
}
async function signAndSubmit(page: Page, description: string): Promise<string> {
  const f = importFrame(page);
  await f.locator('input[type=text]:visible:not(#fileDisplay):not(#sigUser):not(#sigComments):not(.ui-pg-input)').first().fill(description);
  await f.locator('#sigUser').fill(USERNAME);
  await f.locator('#sigPassword').fill(PASSWORD);
  await f.locator('#sigReason').selectOption({ index: 1 });
  await f.locator('#sigPassword').press('Tab');
  await expect(f.locator('#btnSubmit')).toBeEnabled();
  await f.locator('#btnSubmit').click();
  await page.waitForTimeout(6000);
  return norm(await importFrame(page).locator('body').innerText());
}

test('Dictionary Management Excel Import vs ValMaster: sheet dropdown, defaults, all-or-nothing validation, overwrite of an approved record', async ({ page }) => {
  test.setTimeout(1_500_000);
  const stamp = Date.now().toString().slice(-6);
  const LANG = `MBLangX${stamp}`;
  const [PA, PB, PC, PD] = ['a', 'b', 'c', 'd'].map((s) => `MBDMX${stamp}${s}`);
  const d = new Date();
  const today = `${d.getMonth() + 1}/${d.getDate()}/${d.getFullYear()}`;
  await dm.openDictionary(page);

  try {
    await test.step('F.2.17 / F.2.18: the Sheet dropdown (one worksheet -> that name; several -> alphabetical with "(Select a sheet)" first)', async () => {
      await openImport(page);
      await choose(page, await makeXlsx(`dmx_two_${stamp}`, [], ['Zeta', 'Alpha']));
      await expect.poll(async () => importFrame(page).locator('#sheetName option').count(), { timeout: 15_000 }).toBeGreaterThan(2);
      const two = await importFrame(page).locator('#sheetName').evaluate((e: HTMLSelectElement) => ({ disabled: e.disabled, options: Array.from(e.options).map((o) => o.text), value: e.options[e.selectedIndex]?.text }));
      console.log(`sheet dropdown, two worksheets: ${JSON.stringify(two)}`);
      if (two.options[0] !== '(Select a sheet)') deviation('DM.20210908.F.2.17', 'first value "(Select a sheet)"', JSON.stringify(two.options));
      const rest = two.options.filter((o) => o !== '(Select a sheet)');
      if (JSON.stringify(rest) !== JSON.stringify([...rest].sort())) deviation('DM.20210908.F.2.17', 'worksheets in alphabetical order', JSON.stringify(two.options));
      await openImport(page);
      await choose(page, await makeXlsx(`dmx_one_${stamp}`, [], ['OnlySheet']));
      const one = await importFrame(page).locator('#sheetName').evaluate((e: HTMLSelectElement) => ({ disabled: e.disabled, options: Array.from(e.options).map((o) => o.text), value: e.options[e.selectedIndex]?.text }));
      console.log(`sheet dropdown, one worksheet: ${JSON.stringify(one)}`);
      if (one.value !== 'OnlySheet') deviation('DM.20210908.F.2.18', 'the only worksheet name as the default value', JSON.stringify(one));
    });

    await test.step('F.2.11 / F.2.12 / F.2.13 / F.2.14 / F.2.15: blank dates default to today / 12/31/2099; a non-ROBAR ApprovedBy with a blank ApprovalDateTime is accepted and dated today; a future Effective Begin is accepted', async () => {
      await openImport(page);
      const future = '1/1/2031';
      const file = await makeXlsx(`dmx_defaults_${stamp}`, [
        [PA, LANG, 'Defaults', '', '', '', ''],
        [PB, LANG, 'External approver', '', '', 'ExternalSigner99', ''],
        [PC, LANG, 'Future begin', future, '', '', ''],
      ]);
      const body = await validate(page, file);
      console.log(`validation: ${body.slice(0, 200)}`);
      expect(body).toContain('Validation Successful');
      const after = await signAndSubmit(page, `Playwright import defaults ${stamp}`);
      console.log(`import result: ${after.slice(-120)}`);
      expect(after).toContain('Upload Successful');
      await importFrame(page).locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
      await page.waitForTimeout(4000);
      const r = await dm.search(page, `MBDMX${stamp}`, { version: 'Any', latest: false, effective: false });
      const row = (p: string) => r.rows.find((x) => x.includes(p)) ?? '';
      console.log(`imported rows: ${JSON.stringify(r.rows)}`);
      const a = row(PA);
      if (!a.includes(today)) deviation('DM.20210908.F.2.11', `Effective Begin = ${today}`, a);
      if (!a.includes('12/31/2099')) deviation('DM.20210908.F.2.12', 'Effective End = 12/31/2099', a);
      const b = row(PB);
      if (!b.includes('ExternalSigner99')) deviation('DM.20210908.F.2.15', 'a non-ROBAR Approved By is accepted', b);
      if (!new RegExp(`ExternalSigner99\\s+${today.replace(/\//g, '\\/')}`).test(b)) deviation('DM.20210908.F.2.13', `Approve Date = ${today} when ApprovalDateTime is blank`, b);
      if (!row(PC).includes('1/1/2031')) deviation('DM.20210908.F.2.14', 'a future Effective Begin is accepted', row(PC));
      expect(r.rows).toHaveLength(3);
    });

    await test.step('F.2.6: overwriting an APPROVED record with blank ApprovedBy / ApprovalDateTime creates a NEW UNAPPROVED version', async () => {
      await openImport(page);
      const file = await makeXlsx(`dmx_overwrite_${stamp}`, [[PB, LANG, 'External approver (changed)', '', '', '', '']]);
      const body = await validate(page, file);
      console.log(`overwrite validation: ${body.slice(0, 300)}`);
      const dlg = importFrame(page).locator('.ui-dialog:visible').last();
      await dlg.getByRole('button', { name: 'Yes' }).click();
      await page.waitForTimeout(2500);
      expect(norm(await importFrame(page).locator('body').innerText())).toContain('Validation Successful');
      const after = await signAndSubmit(page, `Playwright overwrite approved ${stamp}`);
      console.log(`overwrite result: ${after.slice(-120)}`);
      expect(after).toContain('Upload Successful');
      await importFrame(page).locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
      await page.waitForTimeout(4000);
      const r = await dm.search(page, PB, { version: 'Any', latest: false, effective: false });
      console.log(`versions of ${PB}: ${JSON.stringify(r.rows)}`);
      const unapproved = r.rows.filter((x) => x.includes('changed') && !x.includes(USERNAME));
      if (r.rows.length !== 2 || unapproved.length !== 1) deviation('DM.20210908.F.2.6', 'two versions: the approved original and a NEW UNAPPROVED version with the changed translation', JSON.stringify(r.rows));
    });

    await test.step('F.2.21: validation must pass in its entirety - a file with one valid and one invalid row imports nothing', async () => {
      await openImport(page);
      const file = await makeXlsx(`dmx_allornothing_${stamp}`, [[PD, LANG, 'valid row', '', '', '', ''], ['', LANG, 'blank phrase', '', '', '', '']]);
      const body = await validate(page, file);
      console.log(`mixed validity: ${body.slice(-200)}`);
      expect(body).not.toContain('Validation Successful');
      expect(body).toContain('Validation Errors');
      await dm.reopenDictionary(page);
      const r = await dm.search(page, PD, { version: 'Any', latest: false, effective: false });
      expect(r.rows, 'the valid row was not imported').toHaveLength(0);
    });
  } finally {
    for (const f of files) fs.rmSync(f, { force: true });
  }
});
