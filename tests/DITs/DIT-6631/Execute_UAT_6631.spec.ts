// Execution of UAT_6631 (DIT #6631): Master Data > In External Column > Load External Filter > Upload External File. The Filter Selections dialog's Select Sheet list must hold every sheet
// of the uploaded workbook (old code: the upload call failed with "Object reference not set..." and the list stayed empty; fixed in 7.0.3.20320).
// HEADED (evidence = OS-level desktop screenshots with the address bar). Results are written to results.json; the spec reports what it observes and never fails on a product deviation.
import { test } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as mdm from '../../support/master-data';

test.use({ headless: false, actionTimeout: 15_000 });

const OUT = process.env.UAT_OUT || String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\cbb849bb-1b4f-4282-bd43-98ea9e43b2be\scratchpad\uat6631_exec`;
const WORKBOOK = path.resolve('test-data/dit6631/CL_ExternalFilter_DIT6631.xlsx');
let pg: import('@playwright/test').Page;
const shot = async (n: number): Promise<void> => {
  await pg.bringToFront();
  await pg.waitForTimeout(600);
  const w = await pg.evaluate(() => ({ x: window.screenX, y: window.screenY, w: window.outerWidth, h: window.outerHeight }));
  const file = path.join(OUT, `step_${String(n).padStart(2, '0')}.png`);
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/screenshot-desktop.ps1'), '-Path', file]);
  // keep ONLY the browser window (address bar included): the desktop holds the user's other windows
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/crop-image.ps1'), '-Path', file, '-X', String(w.x), '-Y', String(w.y), '-W', String(w.w - 12), '-H', String(w.h - 16)]);
};

test('UAT 6631 execution', async ({ page }) => {
  test.setTimeout(600_000);
  pg = page;
  fs.mkdirSync(OUT, { recursive: true });
  const res: Record<string, { pass: boolean; observed: string }> = {};
  const rec = (n: number, pass: boolean, observed: string) => { res[String(n)] = { pass, observed }; console.log(`STEP ${n} ${pass ? 'PASS' : 'FAIL'}: ${observed}`); fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(res, null, 2)); };
  let uploadResp = '';
  page.on('response', async (r) => { if (r.url().includes('UploadExternalFile')) uploadResp = (await r.text().catch(() => '')).slice(0, 200); });

  // Step 1
  const frame = await mdm.openMasterData(page);
  await mdm.selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(2500);
  const opSel = frame.locator("select[name$='Operator']").first();
  const hasFilterRow = (await opSel.count()) > 0;
  await shot(1);
  rec(1, hasFilterRow, hasFilterRow ? 'Master Data page open, schema RobarMasterData, filter row (Column/Operator/Value) shown' : 'filter row not found');

  // Step 2
  await opSel.selectOption({ label: 'In External Column' });
  await page.waitForTimeout(800);
  const loadBtn = frame.locator("button[id^='btnLoadExternalFilter']").first();
  const valuePlaceholder = (await frame.locator('input:visible').evaluateAll((els) => els.map((e) => ((e as HTMLInputElement).placeholder || (e as HTMLInputElement).value || '').trim()).filter((t) => /external/i.test(t)))).join(' | ');
  const btnShown = await loadBtn.isVisible().catch(() => false);
  await shot(2);
  rec(2, btnShown, `Load External Filter button visible=${btnShown}; Value box shows "${valuePlaceholder}"`);

  // Step 3
  await loadBtn.click();
  await page.waitForTimeout(3000);
  const uploadBtn = frame.getByRole('button', { name: 'Upload External File' });
  const popup = (await frame.locator('#fileToUpload').count()) > 0;
  const rows = await frame.locator('#gridView tr.jqgrow').count().catch(() => 0);
  await shot(3);
  rec(3, popup, `External Filters window open=${popup}; Upload External File button=${await uploadBtn.count()}; ${rows} loaded file row(s)`);

  // Step 4
  await frame.locator('#fileToUpload').setInputFiles(WORKBOOK);
  await page.waitForTimeout(6000);
  const dlg = (await frame.locator('#ddlSpreadsheetSelect').count()) > 0 && (await frame.locator('#ddlColumnSelect').count()) > 0;
  const errDialog = await frame.locator('.ui-dialog:visible').allInnerTexts().catch(() => []);
  await shot(4);
  rec(4, dlg && !/object reference not set/i.test(uploadResp) && !/"ErrorMessage":"/.test(uploadResp), `Filter Selections dialog open=${dlg}; upload response="${uploadResp || '(JSON model returned)'}"`);

  // Step 5
  const sheets = (await frame.locator('#ddlSpreadsheetSelect option').allInnerTexts().catch(() => [])).map((s) => s.trim());
  const listed = sheets.filter((s) => s && s !== 'Select');
  await frame.locator('#ddlSpreadsheetSelect').evaluate((s) => s.setAttribute('size', '3')).catch(() => {}); // screenshot only: shows the option list inline
  await page.waitForTimeout(800);
  await shot(5);
  await frame.locator('#ddlSpreadsheetSelect').evaluate((s) => s.removeAttribute('size')).catch(() => {});
  const ok5 = listed.includes('Sheet1') && listed.includes('Second');
  rec(5, ok5, `Select Sheet options: ${JSON.stringify(sheets)}`);

  // Step 6
  if (ok5) {
    await frame.locator('#ddlSpreadsheetSelect').selectOption({ label: 'Sheet1' });
    await page.waitForTimeout(1000);
    const cols = (await frame.locator('#ddlColumnSelect option').allInnerTexts()).map((s) => s.trim()).filter((s) => s && s !== 'Select');
    const enabled = await frame.locator('#ddlColumnSelect').isEnabled();
    await shot(6);
    rec(6, enabled && cols.includes('ItemNumber') && cols.includes('Note'), `Select Column enabled=${enabled}; options ${JSON.stringify(cols)}`);
  } else { await shot(6); rec(6, false, 'not reachable: Select Sheet list holds no sheet to select'); }

  // Step 7
  if (ok5) {
    await frame.locator('#ddlColumnSelect').selectOption({ label: 'ItemNumber' });
    await frame.locator('#btnSubmitSheet').click({ timeout: 8000 });
    await page.waitForTimeout(5000);
    const dialogGone = (await frame.locator('#ddlSpreadsheetSelect:visible').count()) === 0;
    const gridText = (await frame.locator('#gridView').innerText().catch(() => '')).replace(/\s+/g, ' ');
    const listedNow = /CL_ExternalFilter_DIT6631/i.test(gridText);
    await shot(7);
    rec(7, dialogGone && listedNow, `Filter Selections closed=${dialogGone}; workbook listed in External Filters grid=${listedNow}`);
  } else { await shot(7); rec(7, false, 'not reachable'); }

  // Step 8: clean up (only when the workbook was actually added)
  if (res['7']?.pass) {
    const row = frame.locator('#gridView tr.jqgrow').filter({ hasText: 'CL_ExternalFilter_DIT6631' }).first();
    await row.locator('input[type=checkbox]').check({ timeout: 5000 });
    await frame.getByRole('button', { name: 'Delete Filter' }).click({ timeout: 5000 });
    await page.waitForTimeout(3000);
    // observe only: whatever dialog appears after Delete Filter (a confirmation, an error) is recorded, never clicked blindly
    const dialogs = (await frame.locator('.ui-dialog:visible').allInnerTexts().catch(() => [])).map((t) => t.replace(/\s+/g, ' ').trim()).filter((t) => !/Upload External File/.test(t));
    console.log('DIALOGS after Delete Filter: ' + JSON.stringify(dialogs));
    const gone = (await frame.locator('#gridView tr.jqgrow').filter({ hasText: 'CL_ExternalFilter_DIT6631' }).count()) === 0;
    await shot(8);
    rec(8, gone, `workbook removed from External Filters grid=${gone}; dialogs after Delete Filter: ${JSON.stringify(dialogs)}`);
  } else { await shot(8); rec(8, false, 'not run: nothing was added to clean up'); }
  void errDialog;
});
