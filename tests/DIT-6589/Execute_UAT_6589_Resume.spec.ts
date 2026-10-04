// Resumes DIT #6589 UAT execution from step 4 onward, after the original run's Template
// Management portion (steps 1-3) already completed successfully live - template
// "DIT6589_82918311" was created and approved (confirmed: BarTender's own "Approved by: MBUser1 -
// 9/15/2026" label, read via FlaUI dump-tree after the first run's process crashed on an unrelated
// bug in this repo's own polling code, AFTER the real approval had already gone through).
//
// See Execute_UAT_6589.spec.ts for the full step 1-3 logic and the standing credential-boundary
// rule this also follows (no auto-typed login, no auto-filled e-signature).

import { test, expect } from '@playwright/test';
import { openMenuItem, findFrame } from '../support/robar';
import * as mdm from '../support/master-data';
import * as fs from 'fs';
import * as path from 'path';

const TEMPLATE_NAME = 'DIT6589_82918311'; // approved in the prior run - do not recreate
const SCRATCH = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--Users-Mason-OneDrive---Innovatum--Inc-Desktop-MsBuild\29776c24-71be-402e-bf8d-8648eb0f1402\scratchpad\uat6589_exec`;
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
const STATUS_FILE = path.join(SCRATCH, 'status.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

function writeStatus(obj: Record<string, unknown>): void {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...obj, at: new Date().toISOString() }, null, 2));
  console.log('[STATUS] ' + JSON.stringify(obj));
}

test('Resume UAT_6589 from step 4 - Campaign Manager item + MDM record', async ({ page }) => {
  test.setTimeout(20 * 60 * 1000);

  const results: Record<string, unknown> = {};

  await page.goto('http://vmsrvtst703/innovatum/WebMenu/');
  writeStatus({ phase: 'resume_awaiting_login', message: 'Browser is on the login page - please log in manually with your test account.' });
  await page.waitForSelector('#logout', { timeout: 10 * 60 * 1000 });
  writeStatus({ phase: 'resume_logged_in' });

  // ---- STEP 4-5: Campaign Manager - create item, associate the already-approved template, save ----
  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000);

  const itemNumber = 'DIT6589' + Date.now().toString().slice(-6);
  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', 'Carton Label');
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  results.step4 = { itemNumber, pass: true };
  writeStatus({ phase: 'step4_done', itemNumber });

  await editFrame.selectOption('select[name="txtTemplateName"]', TEMPLATE_NAME);
  await editFrame.fill('input[name="txtDescription"]', 'DIT #6589 regression UAT item');
  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
    editFrame.click('button:has-text("Save")'),
  ]);
  expect(saveResponse.status()).toBe(200);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step5_item_saved.png'), fullPage: true });
  results.step5 = { pass: saveResponse.status() === 200 };
  writeStatus({ phase: 'step5_done' });

  // ---- STEP 6: Approve Item (browser e-signature - PAUSE for manual entry) ----
  await page.waitForTimeout(1000);
  await editFrame.click('text=Actions');
  await editFrame.click('text=Approve Item');
  await page.waitForTimeout(500);
  writeStatus({ phase: 'awaiting_signature_2', message: 'Approve Item dialog is open in Campaign Manager - please enter User/Password/Reason and click Submit.' });

  // NOTE: findFrame matches on URL SUBSTRING against page.frames() as it currently stands - the
  // pre-approval edit frame already matches this same "items/edit?itemnumber=X" pattern (Approve
  // Item is a modal over the SAME page, URL doesn't change until Submit redirects), so this often
  // returns immediately with the STALE, still-open frame rather than waiting for the real
  // post-approval reload. The actual wait for the human to complete the dialog has to happen in
  // the expect() below (which polls the live DOM of whatever frame this resolved to), not here -
  // give it real human-reaction-time, not the 30s this failed with the first time.
  const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`, { attempts: 300, intervalMs: 2000 });
  const approvedStatus = finalFrame.locator('span[data-bind*="approvedStatus"]');
  writeStatus({ phase: 'awaiting_signature_2_poll', message: 'Waiting up to 8 minutes for the Approved status to change - take your time with the dialog.' });
  await expect(approvedStatus, 'Approved status still shows Unapproved after signature step').not.toHaveText('Unapproved', { timeout: 8 * 60 * 1000 });
  const approvedText = await approvedStatus.textContent();
  await page.screenshot({ path: path.join(SHOT_DIR, 'step6_item_approved.png'), fullPage: true });
  results.step6 = { approvedText, pass: true };
  writeStatus({ phase: 'step6_done', approvedText });

  // ---- STEP 7: Master Data Management - create record associated with the item ----
  await page.getByRole('button', { name: 'Master Data', exact: true }).click();
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  await mdm.selectSchema(mdmFrame, 'RobarMasterData');
  await mdm.openNewRecordAction(mdmFrame);
  await mdm.submitNewItemDialog(page, mdmFrame, itemNumber, 'DIT #6589 regression UAT master data record');
  await expect(mdmFrame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible();

  await mdm.setItemDescription(mdmFrame, 'DIT #6589 regression UAT master data record');
  await mdm.selectDropdownFieldByCaption(mdmFrame, 'Labeler Duns Number', 'Innovatum');
  await mdm.fillFieldByCaption(mdmFrame, 'Primary DI Number', '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await mdm.fillFieldByCaption(mdmFrame, 'Brand Name', 'DIT 6589 Test Brand');

  await mdm.saveRecord(page, mdmFrame);
  await expect(mdmFrame.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.screenshot({ path: path.join(SHOT_DIR, 'step7_mdm_record_saved.png'), fullPage: true });
  results.step7 = { itemNumber, pass: true };
  writeStatus({ phase: 'all_done', results });

  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ templateName: TEMPLATE_NAME, itemNumber, results }, null, 2));
});
