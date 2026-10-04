// Executes UAT_6198.doc (DIT #6198: Master Data Excel Import treats a blank cell as "end of row"
// instead of "this field is blank", dropping every column that follows it) against
// http://vmsrvval703/innovatum/WebMenu/. Pure browser flow (real HTML <input type=file>, no
// native-app/FlaUI dependency - Playwright's setInputFiles works directly, no OS file dialog).

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as fs from 'fs';
import * as path from 'path';

const SCRATCH = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6198_exec`;
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
fs.mkdirSync(SHOT_DIR, { recursive: true });

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(path.join(SCRATCH, 'progress.log'), line + '\n');
}

test('Execute UAT_6198 - DIT #6198 Excel Import blank-cell bug', async ({ page }) => {
  test.setTimeout(5 * 60 * 1000);
  const results: Record<string, unknown> = {};
  fs.writeFileSync(path.join(SCRATCH, 'progress.log'), '');

  const itemNumber = 'MBUAT6198D_20260928171816'; // v4: same as v3 but Labeler Duns Number fixed
  // to the one real value confirmed to exist ("118117576", Company Name "Innovatum" - the
  // schema's own stated sample "123456789" was not a real record and failed InvalidValue).
  const importFile = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\UAT_6198_import3.xlsx`;

  log('logging in');
  await login(page);

  // ---- STEP 1 evidence: the import file with a blank Column C (EffectiveBegin) followed by
  // populated D/E/F already exists on disk (built directly via Excel COM, verified column
  // layout against the schema's own Download Template).
  log('opening Master Data Excel Import');
  await openMenuItem(page, 'Master Data Excel Import');
  const importFrame = await findFrame(page, 'ExcelImport');
  await page.waitForTimeout(1000);

  await importFrame.selectOption('#ddlSchemas', { label: 'RobarMasterData' });
  log('schema selected');
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step1_import_file_prepared.png'), fullPage: true });

  // ---- STEP 2: import the file ----
  await importFrame.locator('#spreadsheetFile').setInputFiles(importFile);
  log('file attached to input');
  // Wait for the file-attach's own async validation round trip to fully settle (confirmed live:
  // filling fields too early gets wiped when that response lands and the knockout view model
  // re-renders - the "Sample warning from stored procedure" message is a benign, unrelated
  // artifact of that same call, not something to chase). `networkidle` never resolves in this
  // app (confirmed live: hung the full 5-minute test budget, matching this repo's own
  // playwright.config.ts note about persistent background polling elsewhere in the app) - use a
  // fixed generous delay instead.
  await page.waitForTimeout(5000);
  log('post-file-attach validation settled');

  await importFrame.getByText('Job Description:', { exact: false }).locator('xpath=following::input[1]').fill('UAT #6198 v3 - all required fields filled, Brand Logo blank');
  log('Job Description filled');

  // Auto-fill the signature (standing decision, user 2026-09-28: "we're not testing the
  // e-signature, we're testing what is described in the DIT" - seed.ts's own test-account
  // credentials, same account used for login all session, not a live human attestation this UAT
  // corpus needs to gate on). Shared SignatureComponentTemplate ids (#sigUser/#sigPassword/
  // #sigReason/#sigComments), same as Campaign Manager's Approve Item dialog elsewhere in this repo.
  // Confirmed live (matches an already-documented gotcha for this same shared
  // SignatureComponentTemplate elsewhere in this repo, e.g. Mass_Approve_Templates.spec.ts): the
  // Submit button's sigValid()-driven enable binding does not recompute purely from filling the
  // fields, even with real dispatched input/change events - it stays disabled until Password is
  // explicitly blurred. Fill normally, then press Tab to blur, then assert enabled before relying
  // on it - don't assume a fixed settle delay is enough.
  await importFrame.locator('#sigUser').fill(USERNAME);
  await importFrame.locator('#sigPassword').fill(PASSWORD);
  await importFrame.locator('#sigReason').selectOption({ index: 1 }).catch((e) => log('sigReason select skipped: ' + e.message));
  await importFrame.locator('#sigPassword').press('Tab');
  log('signature auto-filled from seed.ts credentials, blurred Password field');
  await expect(importFrame.getByText('Submit Job', { exact: true })).toBeEnabled({ timeout: 10_000 });
  log('Submit Job confirmed enabled');
  await page.screenshot({ path: path.join(SHOT_DIR, 'step2_ready_for_signature.png'), fullPage: true });

  // Re-verify nothing reset right before submitting - fill again if the model wiped it a second
  // time (confirmed live this can happen more than once on this page).
  const jobDescNowEmpty = await importFrame.getByText('Job Description:', { exact: false }).locator('xpath=following::input[1]').inputValue() === '';
  if (jobDescNowEmpty) {
    log('fields were wiped again after fill - re-filling once more');
    await importFrame.getByText('Job Description:', { exact: false }).locator('xpath=following::input[1]').fill('UAT #6198 v3 - all required fields filled, Brand Logo blank');
    await importFrame.locator('#sigUser').fill(USERNAME);
    await importFrame.locator('#sigPassword').fill(PASSWORD);
    await importFrame.locator('#sigReason').selectOption({ index: 1 }).catch(() => {});
  }

  const [jobResponse] = await Promise.all([
    page.waitForResponse((r) => /ExcelImport|SubmitJob|UploadSpreadsheet/i.test(r.url()), { timeout: 15_000 }).catch(() => null),
    importFrame.getByText('Submit Job', { exact: true }).click({ timeout: 10_000 }),
  ]);
  log('Submit Job clicked' + (jobResponse ? `, response from ${jobResponse.url()}` : ' (no matching response captured)'));

  // Poll for job completion, screenshotting EVERY cycle so any transient error message that
  // flashes up gets caught, and logging the frame's own URL each time to see exactly what
  // navigation (if any) happens.
  let outcome: 'submitted' | 'timeout' = 'timeout';
  for (let i = 0; i < 60; i++) { // up to 2 min, 2s apart - no human wait needed now
    await page.waitForTimeout(2000);
    const shotPath = path.join(SHOT_DIR, `poll_${String(i).padStart(3, '0')}.png`);
    await page.screenshot({ path: shotPath, fullPage: true }).catch(() => {});
    const currentUrl = page.url();
    const stillHasButton = await importFrame.getByText('Submit Job', { exact: true }).count().catch(() => -1);
    log(`poll ${i}: url=${currentUrl} submitJobCount=${stillHasButton}`);
    if (stillHasButton === 0 || stillHasButton === -1) {
      outcome = 'submitted';
      break;
    }
  }
  log('poll loop ended with outcome=' + outcome);
  if (outcome === 'timeout') {
    throw new Error('Job was never submitted.');
  }
  results.step2 = { itemNumber, pass: true };

  // ---- STEP 3: open the imported record in MDM, verify fields after the blank one populated ----
  log('opening Master Data');
  await openMenuItem(page, 'Master Data');
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  await mdmFrame.selectOption('#ddlSchemas', { label: 'RobarMasterData' }).catch((e) => log('schema select skipped: ' + e.message));
  await mdmFrame.locator('#drpApproved').selectOption({ label: 'Any' }).catch((e) => log('For Items=Any select skipped: ' + e.message));
  await mdmFrame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  log('Retrieve Data clicked');
  await page.waitForTimeout(2000);
  await mdmFrame.evaluate(() => {
    const jq = (window as any).$ || (window as any).jQuery;
    jq('#grdMasterData').jqGrid('setGridParam', { rowNum: 5000 }).trigger('reloadGrid');
  });
  log('jqGrid rowNum set to 5000');
  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step3_retrieved_record.png'), fullPage: true });

  const totalRows = await mdmFrame.locator('tr').count();
  const itemTextCount = await mdmFrame.getByText(itemNumber).count();
  log(`DIAGNOSTIC: total <tr> in frame=${totalRows}, occurrences of itemNumber text anywhere in frame=${itemTextCount}`);

  if (itemTextCount === 0) {
    log('Item still not found after retry - stopping here for the user to review the poll screenshots.');
    fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ step2: results.step2, step3: { pass: false, note: 'Record still not found after retry' } }, null, 2));
    return;
  }

  const dataRow = mdmFrame.locator('tr').filter({ hasText: itemNumber }).first();
  await dataRow.locator('a:has-text("Actions")').click({ timeout: 10_000 });
  await page.waitForTimeout(500);
  await mdmFrame.locator('a:has-text("View/Edit"):visible').first().click({ timeout: 10_000 });
  log('opened imported record');
  await page.waitForTimeout(1500);

  const brandLogoValue = await mdmFrame.getByRole('row', { name: /^Brand Logo/i }).getByRole('textbox').inputValue().catch(() => null);
  const deviceDescValue = await mdmFrame.getByRole('row', { name: /Device Description/i }).getByRole('textbox').inputValue().catch(() => null);
  const deviceCountValue = await mdmFrame.getByRole('row', { name: /Device Count/i }).getByRole('textbox').inputValue().catch(() => null);

  log(`fields around the blank column: BrandLogo(blank,expected)="${brandLogoValue}" DeviceDescription(after blank)="${deviceDescValue}" DeviceCount(further after)="${deviceCountValue}"`);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step3_record_fields_populated.png'), fullPage: true });

  results.step3 = {
    itemNumber,
    brandLogoValue,
    deviceDescValue,
    deviceCountValue,
    pass: Boolean(deviceDescValue && deviceDescValue.length > 0 && deviceCountValue === '1'),
    note: 'Column J (Brand Logo) was left blank in the import file; Device Description (column K, immediately after) and Device Count (column R, further after) both being populated proves the row was not cut short at the blank cell.',
  };

  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify(results, null, 2));
});
