// Investigation 2026-10-30 (FP report): "Images schema: import only imports some of the columns".
// Imports a fully populated sheet (every Images field caption, protected ones included) into the Images schema and reads the saved record back.
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import ExcelJS from 'exceljs';
import * as mdm from '../support/master-data';
import * as sch from '../support/schemas';
import { findFrame } from '../support/robar';
import { importSheet, closeAllModuleTabs, openImportPage, attachFile, fillImportSignature, writeWorkbook } from '../support/master-data-import';

const OUT = path.join(__dirname, '..', '..', 'runs', 'Images_Import_Lang_Overlap_2026-10-30');
fs.mkdirSync(OUT, { recursive: true });
const SCHEMA = process.env.IMG_SCHEMA ?? 'Images';

test(`Images import: which columns are saved (${SCHEMA})`, async ({ page }) => {
  test.setTimeout(900_000);
  const stamp = Date.now().toString().slice(-6);
  const item = `CLIMG${stamp}`;
  const md = await mdm.openMasterData(page);

  // 1. dropdown options of the schema (so the sheet uses legal values)
  const se = await sch.openSchemaEditor(page, md, SCHEMA);
  const captions = await se.locator('.md-field .md-field-caption').evaluateAll((els) => els.map((e) => (e as HTMLElement).innerText.replace(/\s+/g, ' ').trim()));
  console.log('FIELDS:', JSON.stringify(captions));
  for (const c of ['Image Extension', 'Image Type', 'Destination Folder', 'Workflow Preset']) {
    const b = sch.fieldBlock(se, c);
    if (await b.count()) console.log(`OPTIONS ${c}:`, JSON.stringify(await sch.staticOptions(b).catch(() => 'n/a')), (await b.innerText()).replace(/\s+/g, ' ').slice(0, 400));
  }
  await se.locator('body').screenshot({ path: path.join(OUT, `img-01-schema-${SCHEMA.replace(/\W/g, '')}.png`) }).catch(() => {});
  await closeAllModuleTabs(page);

  // 2. the template the page offers
  const f0 = await openImportPage(page, SCHEMA);
  await f0.locator('body').screenshot({ path: path.join(OUT, 'img-02-import-page.png') });
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), f0.locator('#downloadLink').click({ timeout: 5000 })]);
  const tpl = path.join(OUT, `${SCHEMA.replace(/\W/g, '')}_Template.xlsx`);
  await dl.saveAs(tpl);
  const wbT = new ExcelJS.Workbook(); await wbT.xlsx.readFile(tpl);
  const tplHeaders = (wbT.worksheets[0].getRow(1).values as string[]).slice(1);
  console.log('TEMPLATE HEADERS:', JSON.stringify(tplHeaders));
  console.log('FIELDS NOT IN TEMPLATE:', JSON.stringify(captions.filter((c) => !tplHeaders.includes(c))));

  // 3. import a sheet with EVERY field filled (template columns + the protected ones)
  const values: Record<string, string> = {
    'Image Extension': '.png', 'Image Type': 'Product Image', 'Image Revision': 'v7', 'Document Reference': 'DOC-CL-' + stamp,
    'Destination Folder': 'C:\\Innovatum\\WorkflowDestination', 'ECN': 'ECN-CL-' + stamp, 'Send To Workflow': 'False',
    'Workflow ID': 'WF-IMPORTED', 'Workflow Status': 'Open', 'Image File': 'imported.png', 'Approval Workflow ID': 'WF-IMPORTED',
  };
  const headers = ['ItemNumber', 'Description', ...captions.filter((c) => c !== 'Workflow Preset')];
  const row = [item, 'Import columns test', ...headers.slice(2).map((h) => values[h] ?? 'x')];
  console.log('IMPORT HEADERS:', JSON.stringify(headers));
  const result = await importSheet(page, headers, [row], { tag: 'img' + stamp, schema: SCHEMA });
  console.log(`IMPORT RESULT: ${result?.status} job ${result?.jobId} errors=${JSON.stringify(result?.errorRows)} :: ${result?.text.slice(0, 300)}`);
  await result?.frame.locator('body').screenshot({ path: path.join(OUT, 'img-03-job-detail.png') });

  // 4. read the saved record back
  await closeAllModuleTabs(page);
  const g = await mdm.reopenMasterData(page);
  const rows = await mdm.retrieve(page, g, { value: item, schema: SCHEMA, expectRows: 1 });
  await page.waitForTimeout(2000);
  await g.locator('body').screenshot({ path: path.join(OUT, 'img-04-grid.png') });
  console.log('GRID ROW:', (await rows.first().innerText()).replace(/\s+/g, ' '));
  await rows.first().locator('a:has-text("Actions")').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await g.locator('ul:visible a').filter({ hasText: 'View/Edit' }).first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(3500);
  const ef = await findFrame(page, 'MasterData/Edit');
  const saved = await ef.locator('tr').evaluateAll((trs) => trs.map((tr) => {
    const label = (tr.querySelector('label, th, td') as HTMLElement | null)?.innerText.trim();
    const el = tr.querySelector('input:not([type=hidden]), select, textarea') as HTMLInputElement | HTMLSelectElement | null;
    if (!label || !el) return '';
    const v = el.tagName === 'SELECT' ? (el as HTMLSelectElement).selectedOptions[0]?.text : (el as HTMLInputElement).type === 'checkbox' ? String((el as HTMLInputElement).checked) : el.value;
    return `${label} = ${v}`;
  }).filter(Boolean));
  console.log('SAVED RECORD:\n' + saved.join('\n'));
  await ef.locator('body').screenshot({ path: path.join(OUT, 'img-05-saved-record.png') });
  await page.screenshot({ path: path.join(OUT, 'img-05b-saved-record-page.png') });
});
