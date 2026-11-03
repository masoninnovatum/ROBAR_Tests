// Investigation 2026-10-30 (FP report): "Images schema: import only imports some of the columns".
// Several small imports into the Images / FP Images schemas; after each, the saved record is read back (every control on the Edit page, both tabs).
// Nothing is approved and Send To Workflow is never set to True (the Image Workflow Automation EXE would pick the record up).
import { test } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import * as mdm from '../support/master-data';
import { findFrame } from '../support/robar';
import { importSheet, closeAllModuleTabs } from '../support/master-data-import';

const OUT = path.join(__dirname, '..', '..', 'runs', 'Images_Import_Lang_Overlap_2026-10-30');
fs.mkdirSync(OUT, { recursive: true });

interface Case { tag: string; schema: string; headers: string[]; values: string[] }

async function readBack(page: any, item: string, schema: string, tag: string): Promise<string[]> {
  await closeAllModuleTabs(page);
  const g = await mdm.reopenMasterData(page);
  const rows = await mdm.retrieve(page, g, { value: item, schema, expectRows: 1 });
  await page.waitForTimeout(2000);
  await rows.first().locator('a:has-text("Actions")').click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await g.locator('ul:visible a').filter({ hasText: 'View/Edit' }).first().click({ force: true, timeout: 5000 });
  await page.waitForTimeout(4000);
  const ef = await findFrame(page, 'MasterData/Edit');
  const dump: string[] = await ef.locator('input:not([type=hidden]), select, textarea').evaluateAll((els: any[]) => els.map((el) => {
    const lab = (el.closest('tr, .row, div')?.querySelector('label, span.label, th, td') as HTMLElement | null)?.innerText?.trim() ?? '';
    const v = el.tagName === 'SELECT' ? (el.selectedOptions[0]?.text ?? '') : el.type === 'checkbox' ? String(el.checked) : el.value;
    return `${el.id || el.name} [${lab}] = ${v}`;
  }));
  await page.screenshot({ path: path.join(OUT, `${tag}-record-general.png`) });
  await ef.getByText('Workflow', { exact: true }).first().click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, `${tag}-record-workflow.png`) });
  return dump;
}

test('Images import: case matrix', async ({ page }) => {
  test.setTimeout(1_500_000);
  const stamp = Date.now().toString().slice(-6);
  await mdm.openMasterData(page);
  const cases: Case[] = (JSON.parse(process.env.IMG_CASES ?? 'null') as Case[] | null) ?? [
    { tag: 'A_ecn_only', schema: 'Images', headers: ['Image Extension', 'ECN'], values: ['.jpg', 'ECN-A-' + stamp] },
    { tag: 'B_all_template_cols', schema: 'Images', headers: ['Image Extension', 'Image Type', 'Image Revision', 'Document Reference', 'Destination Folder', 'ECN', 'Send To Workflow', 'Workflow Preset'], values: ['.gif', 'Warning Symbol', 'rB', 'DOC-B', 'C:\\Innovatum\\WorkflowDestination', 'ECN-B-' + stamp, 'False', 'ImgPreset1'] },
    { tag: 'C_fpimages_all', schema: 'FP Images', headers: ['Image Extension', 'Image Type', 'Image Revision', 'Document Reference', 'Destination Folder', 'ECN', 'Send To Workflow', 'Workflow Preset'], values: ['.png', 'Product Image', 'rC', 'DOC-C', 'C:\\Innovatum\\WorkflowDestination', 'ECN-C-' + stamp, 'False', 'ImgPreset1'] },
  ];
  for (const c of cases) {
    const item = `CLIMG${c.tag.slice(0, 1)}${stamp}`;
    const res = await importSheet(page, ['ItemNumber', 'Description', ...c.headers], [[item, 'case ' + c.tag, ...c.values]], { tag: c.tag + stamp, schema: c.schema });
    console.log(`\n=== CASE ${c.tag} (${c.schema}) item ${item}: ${res?.status} job ${res?.jobId} errors=${JSON.stringify(res?.errorRows)}`);
    await res?.frame.locator('body').screenshot({ path: path.join(OUT, `${c.tag}-job-detail.png`) }).catch(() => {});
    if (res?.status !== 'Completed') continue;
    console.log('SENT   :', c.headers.map((h, i) => `${h}=${c.values[i]}`).join(' | '));
    console.log('SAVED  :\n  ' + (await readBack(page, item, c.schema, c.tag)).join('\n  '));
  }
});
