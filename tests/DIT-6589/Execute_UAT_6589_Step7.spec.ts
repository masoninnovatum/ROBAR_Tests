// Final leg of DIT #6589 UAT execution: step 7 only (Master Data Management record for the
// already-created-and-approved item DIT6589515188). Steps 1-6 all completed successfully in
// prior runs (see status.json/results so far in the scratch folder) - this just needs a fresh
// login (browser session from the prior run closed) and the Main Menu tab explicitly clicked
// before opening Master Data, since the prior run's failure was exactly that: it was still on
// the Campaign Manager tab (no "Master Data" button on that view) when it tried to click it.

import { test, expect } from '@playwright/test';
import { findFrame } from '../support/robar';
import * as mdm from '../support/master-data';
import * as fs from 'fs';
import * as path from 'path';

const ITEM_NUMBER = 'DIT6589515188'; // created, saved, and approved in the prior run
const SCRATCH = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--Users-Mason-OneDrive---Innovatum--Inc-Desktop-MsBuild\29776c24-71be-402e-bf8d-8648eb0f1402\scratchpad\uat6589_exec`;
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
const STATUS_FILE = path.join(SCRATCH, 'status.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

function writeStatus(obj: Record<string, unknown>): void {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...obj, at: new Date().toISOString() }, null, 2));
  console.log('[STATUS] ' + JSON.stringify(obj));
}

test('DIT #6589 step 7 - Master Data Management record', async ({ page }) => {
  test.setTimeout(10 * 60 * 1000);

  await page.goto('http://vmsrvtst703/innovatum/WebMenu/');
  writeStatus({ phase: 'step7_awaiting_login', message: 'Browser is on the login page - please log in manually.' });
  await page.waitForSelector('#logout', { timeout: 10 * 60 * 1000 });
  writeStatus({ phase: 'step7_logged_in' });

  // Explicit fix for the prior failure: make sure Main Menu is the active tab before looking for
  // its "Master Data" button - Main Menu should already be the only/active tab right after a
  // fresh login, but click it explicitly rather than assume.
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click().catch(() => {});
  await page.waitForTimeout(500);

  await page.getByRole('button', { name: 'Master Data', exact: true }).click();
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);

  await mdm.selectSchema(mdmFrame, 'RobarMasterData');
  await mdm.openNewRecordAction(mdmFrame);
  await mdm.submitNewItemDialog(page, mdmFrame, ITEM_NUMBER, 'DIT #6589 regression UAT master data record');
  await expect(mdmFrame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible();

  await mdm.setItemDescription(mdmFrame, 'DIT #6589 regression UAT master data record');
  await mdm.selectDropdownFieldByCaption(mdmFrame, 'Labeler Duns Number', 'Innovatum');
  await mdm.fillFieldByCaption(mdmFrame, 'Primary DI Number', '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await mdm.fillFieldByCaption(mdmFrame, 'Brand Name', 'DIT 6589 Test Brand');

  await mdm.saveRecord(page, mdmFrame);
  await expect(mdmFrame.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.screenshot({ path: path.join(SHOT_DIR, 'step7_mdm_record_saved.png'), fullPage: true });
  writeStatus({ phase: 'all_done', itemNumber: ITEM_NUMBER, pass: true });

  fs.writeFileSync(path.join(SCRATCH, 'results_step7.json'), JSON.stringify({ itemNumber: ITEM_NUMBER, pass: true }, null, 2));
});
