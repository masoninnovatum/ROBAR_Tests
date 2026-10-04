// Master Data Excel Import helpers (Main Menu tile "Master Data Excel Import", `InnoPages/MasterDataExcelImport/JobSubmission`,
// result page `.../JobDetail?jobid=<n>`). Live-confirmed 2026-10-04 -- see Excel_Import.spec.ts for the behaviours.
//
// Gotchas baked in here:
//  * every import leaves a Job Detail TAB open, and `findFrame` / `page.frames().find` then return the OLD tab's frame
//    (stale status, wrong job). Close every tab except the Main Menu before each import, and always read the LAST matching frame.
//  * the spreadsheet is built with exceljs (no sample file needed); the schema's own "Download Template" gives the exact headers.

import type { Page, Frame } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as path from 'path';
import * as os from 'os';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from './robar';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface ImportResult {
  /** Normalised Job Detail page text. */
  text: string;
  /** Status as displayed (e.g. `Completed`, `ValidationErrors` -- no space). */
  status: string;
  jobId: string;
  /** Rows of the "Errors Only" grid as [ExcelRowId, ItemNumber, VersionNumber, Status, Message]. */
  errorRows: string[][];
  frame: Frame;
}

/** Writes a one-sheet workbook (`Sheet1`) and returns its path. */
export async function writeWorkbook(headers: string[], rows: (string | number | undefined)[][], tag: string): Promise<string> {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Sheet1');
  ws.addRow(headers);
  for (const r of rows) ws.addRow(r);
  const file = path.join(os.tmpdir(), `pw_import_${tag}_${Date.now()}.xlsx`);
  await wb.xlsx.writeFile(file);
  return file;
}

/** A unique-ish 14-digit Primary DI Number (GS1-style prefix + 6 random digits). */
export function randomDi(): string {
  return '00841646' + String(Math.floor(Math.random() * 1e6)).padStart(6, '0');
}

/** Closes every WebMenu tab except the Main Menu, then makes the Main Menu active. */
export async function closeAllModuleTabs(page: Page): Promise<void> {
  for (let i = 0; i < 12; i++) {
    const close = page.locator('li.ui-tabs-tab:not(:has-text("Main Menu")) .ui-icon-close').first();
    if (!(await close.isVisible({ timeout: 500 }).catch(() => false))) break;
    await close.click({ timeout: 3000 }).catch(() => {});
    await delay(400);
  }
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
}

/** Opens a fresh Excel Import page with the given schema chosen and returns its frame. */
export async function openImportPage(page: Page, schema = 'RobarMasterData'): Promise<Frame> {
  await closeAllModuleTabs(page);
  await openMenuItem(page, 'Master Data Excel Import');
  const f = await findFrame(page, 'MasterDataExcelImport/JobSubmission');
  await f.locator('#ddlSchemas').waitFor({ timeout: 15_000 });
  await delay(1500);
  await f.selectOption('#ddlSchemas', { label: schema }, { timeout: 5000 });
  await delay(1000);
  return f;
}

/** Attaches a file and waits for the sheet list to populate (the attach triggers a server round trip). */
export async function attachFile(page: Page, f: Frame, file: string): Promise<void> {
  await f.locator('#spreadsheetFile').setInputFiles(file, { timeout: 10_000 });
  await f.locator('#ddlSheets option').nth(1).waitFor({ state: 'attached', timeout: 20_000 });
  await delay(1500);
}

/** Fills Job Description + the signature block and blurs the password (Submit only enables after that). */
export async function fillImportSignature(f: Frame, description: string, reasonIndex = 1): Promise<void> {
  await f.locator('#jobDescription').fill(description, { timeout: 5000 });
  await f.locator('#sigUser').fill(USERNAME, { timeout: 5000 });
  await f.locator('#sigPassword').fill(PASSWORD, { timeout: 5000 });
  await f.locator('#sigReason').selectOption({ index: reasonIndex }, { timeout: 5000 });
  await f.locator('#sigComments').fill('Playwright import', { timeout: 5000 });
  await f.locator('#sigPassword').press('Tab');
  await delay(800);
}

/**
 * Imports `rows` under `headers` into `schema`: attach, sign, submit, answer the overwrite prompt with `onExisting`, then poll
 * the Job Detail page to a terminal status. Returns undefined when the overwrite prompt was answered "No" (no job is created).
 */
export async function importSheet(
  page: Page,
  headers: string[],
  rows: (string | number | undefined)[][],
  opts: { tag: string; override?: boolean; onExisting?: 'Yes' | 'No'; schema?: string }
): Promise<ImportResult | undefined> {
  const file = await writeWorkbook(headers, rows, opts.tag);
  const f = await openImportPage(page, opts.schema);
  await attachFile(page, f, file);
  if (opts.override) await f.locator('#validationRuleOverride').check({ timeout: 5000 });
  await fillImportSignature(f, `PW import ${opts.tag}`);
  await f.locator('#btnSubmitJob').click({ timeout: 5000 });

  for (let i = 0; i < 60; i++) {
    await delay(2000);
    const dlg = f.locator('.ui-dialog:visible');
    if ((await dlg.count().catch(() => 0)) > 0) {
      const answer = opts.onExisting ?? 'Yes';
      await dlg.locator('button').filter({ hasText: new RegExp(`^${answer}$`) }).click({ timeout: 5000 });
      if (answer === 'No') return undefined;
      continue;
    }
    const jf = page.frames().filter((x) => /MasterDataExcelImport\/JobDetail/.test(x.url())).pop();
    if (!jf) continue;
    const text = (await jf.locator('body').innerText({ timeout: 5000 }).catch(() => '')).replace(/\s+/g, ' ');
    const status = (text.match(/Status\s+(\w+)/) ?? [])[1] ?? '';
    if (!status || /^(InProgress|Validating)$/.test(status)) continue;
    const errorRows = await jf.locator('tr.jqgrow').evaluateAll((trs) =>
      trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim()).filter(Boolean))
    );
    return { text, status, jobId: (jf.url().match(/jobid=(\d+)/) ?? [])[1] ?? '', errorRows, frame: jf };
  }
  throw new Error('Excel Import job did not reach a terminal status within 2 minutes');
}
