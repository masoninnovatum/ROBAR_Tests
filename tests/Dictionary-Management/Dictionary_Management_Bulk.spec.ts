// Dictionary Management Bulk Actions (live 2026-10-07, headless, TST703, seed user): Mass Approve, New Version of an approved record, version filters, Mass Retire / Unretire, Export to Excel.
// Each bulk action = Job Submission page (description + e-signature + reason code, Submit Job disabled until complete) -> async Job Detail. Self-contained: creates its own phrases MBDMB<stamp>x
// (records cannot be deleted; the retire test leaves one retired record behind).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';
import * as dm from '../support/dictionary';
import { PASSWORD, USERNAME } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const jobFrame = (page: Page): Frame | undefined => page.frames().filter((x) => /DictionaryManagement\/(\w*JobSubmission|\w*JobDetail)/i.test(x.url())).pop();
const waitJobFrame = async (page: Page, re: RegExp): Promise<Frame> => {
  for (let i = 0; i < 40; i++) {
    const f = page.frames().filter((x) => re.test(x.url())).pop();
    if (f) { await page.waitForTimeout(1500); return f; }
    await page.waitForTimeout(1000);
  }
  throw new Error(`no frame matching ${re}`);
};

/** Selects the rows (by phrase) in the grid, opens Bulk Actions > item and returns the job submission frame. */
async function startBulk(page: Page, frame: Frame, phrases: string[], item: string): Promise<Frame> {
  // the grid footer counts the ticked rows ("Checked Rows:n"); ticking two rows quickly in a row sometimes loses a tick (the export then missed a row), so tick with a pause and re-tick until the count is right
  const want = `Checked Rows:${phrases.length}`;
  for (let attempt = 0; attempt < 4; attempt++) {
    for (const p of phrases) {
      const box = frame.locator('#grdJqGrid tr.jqgrow').filter({ hasText: p }).first().locator('input[type=checkbox]');
      if (!(await box.isChecked())) await box.check();
      await page.waitForTimeout(700);
    }
    if ((await frame.locator('body').innerText()).includes(want)) break;
    await frame.locator('#cb_grdJqGrid').uncheck().catch(() => {});
    await page.waitForTimeout(700);
  }
  await expect(frame.locator('body')).toContainText(want, { timeout: 10_000 });
  await frame.locator('#drpActions').click();
  await page.waitForTimeout(500);
  await frame.locator('ul:visible li a').filter({ hasText: item }).click({ force: true });
  return waitJobFrame(page, /DictionaryManagement\/\w*JobSubmission/i);
}

/** Fills the signature block (seed credentials, auto-fill is the standing decision), submits and waits for the Job Detail text to show Completed / Failed. */
async function submitJob(page: Page, jf: Frame, description: string, extra?: (f: Frame) => Promise<void>): Promise<string> {
  await jf.locator('#txtJobDescription').fill(description);
  if (extra) await extra(jf);
  await jf.locator('#sigUser').fill(USERNAME);
  await jf.locator('#sigPassword').fill(PASSWORD);
  await jf.locator('#sigReason').selectOption({ index: 1 });
  await jf.locator('#sigComments').fill('Playwright dictionary test');
  await jf.locator('#sigPassword').press('Tab');
  await expect(jf.locator('#btnSubmit')).toBeEnabled();
  await jf.locator('#btnSubmit').click();
  const detail = await waitJobFrame(page, /DictionaryManagement\/\w*JobDetail/i);
  let text = '';
  for (let i = 0; i < 60; i++) {
    text = (await detail.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (/Status:?\s*(Completed|Failed)/i.test(text) || /100%/.test(text)) break;
    await page.waitForTimeout(2000);
  }
  return text;
}

async function createEntry(page: Page, phrase: string, language: string, translation: string): Promise<void> {
  await dm.openMainAction(page, 'New Entry');
  await dm.fillNewEntry(page, { phrase, language, translation });
  await page.waitForTimeout(2500);
}

test('Dictionary Management Bulk Actions: Mass Approve, New Version of an approved record, version filters, Retire / Unretire, Export to Excel', async ({ page }) => {
  test.setTimeout(1_200_000);
  const stamp = Date.now().toString().slice(-6);
  const LANG = `MBLangB${stamp}`;
  const PA = `MBDMB${stamp}a`;
  const PB = `MBDMB${stamp}b`;
  await dm.openDictionary(page);
  await createEntry(page, PA, LANG, 'Bulk A');
  await createEntry(page, PB, LANG, 'Bulk B');
  let r = await dm.search(page, `MBDMB${stamp}`);
  expect(r.rows).toHaveLength(2);

  await test.step('Mass Approve: job submission page, Submit Job disabled until complete, Job Detail, record becomes approved', async () => {
    const jf = await startBulk(page, r.frame, [PA], 'Mass Approve');
    const body = (await jf.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`approve page: ${body.slice(0, 300)}`);
    expect(body).toContain('Mass Approve Job Submission');
    expect(body).toMatch(/Selected:\s*1/);
    await expect(jf.locator('#btnSubmit'), 'Submit Job disabled until everything is filled').toBeDisabled();
    const reasons = (await jf.locator('#sigReason option').allInnerTexts()).map((t) => t.trim());
    console.log(`reason codes: ${JSON.stringify(reasons)}`);
    expect(reasons[0]).toBe('Select Reason');
    const text = await submitJob(page, jf, `Playwright approve ${stamp}`);
    console.log(`approve job detail: ${text.slice(0, 500)}`);
    expect(text).toMatch(/Completed|100%/);
    expect(text).toContain(PA);
    await waitJobFrame(page, /DictionaryManagement\/\w*JobDetail/i);
    await jobFrame(page)!.locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
    await page.waitForTimeout(4000);
    r = await dm.search(page, PA);
    expect(r.rows).toHaveLength(1);
    console.log(`approved row: ${r.rows[0]}`);
    expect(r.rows[0].toLowerCase()).toContain(USERNAME.toLowerCase());
  });

  await test.step('Mass Approve on an already approved record is refused with a banner', async () => {
    r = await dm.search(page, PA);
    const jf = await startBulk(page, r.frame, [PA], 'Mass Approve');
    const banner = (await jf.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`re-approve: ${banner.slice(0, 300)}`);
    // the banner is shown on the Job Submission page itself (no modal)
    expect(banner).toContain('One or more dictionary records are already approved.');
    await jf.locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
    await page.waitForTimeout(3000);
  });

  await test.step('New Version of the approved record: edit dialog with disabled Phrase / Language, Submit creates an unapproved version 1; a second one is refused', async () => {
    await dm.reopenDictionary(page);
    r = await dm.search(page, PA);
    await r.frame.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(400);
    await r.frame.locator('ul:visible li a').filter({ hasText: 'New Version' }).click({ force: true });
    await page.waitForTimeout(1500);
    expect(await dm.modalText(page)).toContain('Are you sure you want to create a new version?');
    await dm.frameOf(page).getByRole('button', { name: 'Yes' }).click();
    await page.waitForTimeout(3000);
    const ef = dm.editFrame(page);
    console.log(`new version dialog frame: ${ef?.url()}`);
    expect(ef, 'the edit dialog opens for an approved record').toBeDefined();
    const texts = ef!.locator('input[type=text]:not([id^=dp])');
    expect(await texts.nth(0).isDisabled()).toBe(true);
    expect(await texts.nth(1).isDisabled()).toBe(true);
    await ef!.locator('#nonHtmlTrans').fill('Bulk A v1');
    await ef!.locator('#btnSubmit').click();
    await page.waitForTimeout(3000);
    r = await dm.search(page, PA);
    console.log(`after new version: ${JSON.stringify(r.rows)}`);
    expect(r.rows).toHaveLength(2);
    expect(r.rows.some((x) => /Bulk A v1/.test(x) && / 1 /.test(x))).toBe(true);
    // again: blocked while version 1 is unapproved
    await r.frame.locator('#grdJqGrid tr.jqgrow').filter({ hasText: 'Bulk A v1' }).first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(400);
    await r.frame.locator('ul:visible li a').filter({ hasText: 'New Version' }).click({ force: true });
    await page.waitForTimeout(1500);
    await dm.frameOf(page).getByRole('button', { name: 'Yes' }).click();
    await page.waitForTimeout(2500);
    expect(await dm.modalText(page)).toMatch(/A latest unapproved version.{0,6}1.{0,6}already exists/);
    await dm.frameOf(page).getByRole('button', { name: 'Continue' }).click();
    await page.waitForTimeout(800);
  });

  await test.step('Version filters and Latest Only on a phrase with versions 0 (approved) and 1 (unapproved) plus an unapproved phrase', async () => {
    const all = await dm.search(page, `MBDMB${stamp}`);
    expect(all.rows).toHaveLength(3);
    const approved = await dm.search(page, `MBDMB${stamp}`, { version: 'Approved' });
    expect(approved.rows, 'Approved = only the approved version 0 of PA').toHaveLength(1);
    const unapproved = await dm.search(page, `MBDMB${stamp}`, { version: 'Unapproved' });
    expect(unapproved.rows, 'Unapproved = PA v1 and PB').toHaveLength(2);
    const lastApproved = await dm.search(page, `MBDMB${stamp}`, { version: 'Last Version Is Approved' });
    console.log(`Last Version Is Approved: ${lastApproved.rows.length} rows ${JSON.stringify(lastApproved.rows)}`);
    const latest = await dm.search(page, `MBDMB${stamp}`, { latest: true });
    expect(latest.rows, 'Latest Only = PA v1 and PB').toHaveLength(2);
    expect(latest.rows.some((x) => /Bulk A v1/.test(x))).toBe(true);
    expect(latest.rows.some((x) => /Bulk A /.test(x) && !/v1/.test(x))).toBe(false);
  });

  await test.step('Mass Retire / Unretire: Retire pre-selected, record retired (Effective End), then Unretire', async () => {
    // NOTE: the page loads in two stages - right after opening it shows "Selected: 0" with every control disabled, then fills in the count and enables the form
    r = await dm.search(page, PB);
    const jf = await startBulk(page, r.frame, [PB], 'Mass Retire/Unretire');
    await expect(jf.locator('#txtJobDescription')).toBeEnabled({ timeout: 30_000 });
    const body = (await jf.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`retire page: ${body.slice(0, 300)}`);
    expect(body).toMatch(/Selected:\s*1/);
    const radios = await jf.locator('input[type=radio]').evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).id}|${(x as HTMLInputElement).value}|checked=${(x as HTMLInputElement).checked}|disabled=${(x as HTMLInputElement).disabled}`));
    console.log(`retire radios: ${JSON.stringify(radios)}`);
    const text = await submitJob(page, jf, `Playwright retire ${stamp}`);
    console.log(`retire job detail: ${text.slice(0, 400)}`);
    expect(text).toMatch(/Completed|100%/);
    await jobFrame(page)!.locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
    await page.waitForTimeout(4000);
    r = await dm.search(page, PB);
    console.log(`retired row: ${JSON.stringify(r.rows)}`);
    expect(r.rows[0]).not.toContain('12/31/2099');
    const eff = await dm.search(page, PB, { effective: true });
    expect(eff.rows, 'a retired record is not effective').toHaveLength(0);
    r = await dm.search(page, PB);
    const jf2 = await startBulk(page, r.frame, [PB], 'Mass Retire/Unretire');
    const radios2 = await jf2.locator('input[type=radio]').evaluateAll((e) => e.map((x) => `${(x as HTMLInputElement).value}|checked=${(x as HTMLInputElement).checked}|disabled=${(x as HTMLInputElement).disabled}`));
    console.log(`unretire radios: ${JSON.stringify(radios2)}`);
    const unretire = jf2.locator('input[type=radio]').filter({ has: jf2.locator('xpath=self::*[@value="Unretire" or @id="rbUnretire"]') }).first();
    if (await unretire.count()) await unretire.check();
    const text2 = await submitJob(page, jf2, `Playwright unretire ${stamp}`);
    console.log(`unretire job detail: ${text2.slice(0, 400)}`);
    await jobFrame(page)!.locator('a').filter({ hasText: 'Dictionary Management' }).first().click();
    await page.waitForTimeout(4000);
    r = await dm.search(page, PB);
    console.log(`unretired row: ${JSON.stringify(r.rows)}`);
  });

  await test.step('Export to Excel: job submission (description + filename), Job Detail with a download link, the file holds the selected rows', async () => {
    r = await dm.search(page, `MBDMB${stamp}`);
    const jf = await startBulk(page, r.frame, [PA, PB], 'Export to Excel');
    const body = (await jf.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`export page: ${body.slice(0, 300)}`);
    const file = `PWDict${stamp}`;
    // Export has NO signature block: just Job Description + Filename, Submit Job disabled until both are filled
    console.log(`export controls: ${JSON.stringify(await jf.locator('input, button, select').evaluateAll((e) => e.map((x) => `${x.id}|${(x as HTMLInputElement).type}|${(x as HTMLInputElement).disabled ? 'dis' : ''}`)))}`);
    await expect(jf.locator('#btnSubmit')).toBeDisabled();
    const texts = jf.locator('input[type=text]');
    await texts.nth(0).fill(`Playwright export ${stamp}`);
    await expect(jf.locator('#btnSubmit'), 'still disabled without a filename').toBeDisabled();
    await texts.nth(1).fill(file);
    await texts.nth(1).press('Tab');
    await expect(jf.locator('#btnSubmit')).toBeEnabled();
    await jf.locator('#btnSubmit').click();
    const exportDetail = await waitJobFrame(page, /DictionaryManagement\/\w*JobDetail/i);
    let text = '';
    for (let i = 0; i < 60; i++) {
      text = (await exportDetail.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/Status:?\s*(Completed|Failed)/i.test(text) || /100\s*%/.test(text)) break;
      await page.waitForTimeout(2000);
    }
    console.log(`export job detail: ${text.slice(0, 400)}`);
    expect(text).toMatch(/Completed|100%/);
    const detail = jobFrame(page)!;
    const link = detail.locator('a').filter({ hasText: /Download/i }).first();
    await expect(link).toBeVisible();
    const [download] = await Promise.all([page.waitForEvent('download', { timeout: 30_000 }), link.click()]);
    const target = path.join(os.tmpdir(), `${file}.xlsx`);
    await download.saveAs(target);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(target);
    const ws = wb.worksheets[0];
    const rows: string[][] = [];
    ws.eachRow((row) => rows.push((row.values as unknown[]).slice(1).map((v) => String(v ?? ''))));
    console.log(`export file: ${JSON.stringify(rows.slice(0, 4))}`);
    expect(rows[0].join(',')).toContain('Phrase');
    expect(rows.some((x) => x.includes(PA))).toBe(true);
    expect(rows.some((x) => x.includes(PB))).toBe(true);
    fs.rmSync(target, { force: true });
  });
});
