// Executes UAT_6589.doc (DIT #6589 regression: Template Management license check, plus the
// downstream Template Management -> Campaign Manager -> Master Data Management workflow) against
// http://vmsrvtst703/innovatum/WebMenu/, capturing evidence for each of the UAT's 7 steps.
//
// Per this project's standing automation-credential-boundary rule, this test deliberately does
// NOT call support/robar.ts's login() (which auto-types the password) and does NOT auto-fill
// either e-signature dialog (BarTender's "Signature Required", Campaign Manager's "Approve Item").
// Both are real pause points: the test writes its current phase to status.json and polls for the
// human-completed state (a page element for login/Approve Item, a FlaUI control disappearing for
// the native Signature Required dialog) rather than proceeding on its own.
//
// One-off UAT-execution run, not a permanent regression spec -- kept in its own DIT-6589 folder
// rather than one of the three module folders since it spans all three. Untracked in git; the
// user can decide whether to keep or discard it afterward.

import { test, expect } from '@playwright/test';
import { openMenuItem, findFrame } from '../support/robar';
import * as mdm from '../support/master-data';
import * as flaui from '../../scripts/flaui_bridge';
import * as fs from 'fs';
import * as path from 'path';

const SCRATCH = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--Users-Mason-OneDrive---Innovatum--Inc-Desktop-MsBuild\29776c24-71be-402e-bf8d-8648eb0f1402\scratchpad\uat6589_exec`;
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
const STATUS_FILE = path.join(SCRATCH, 'status.json');

fs.mkdirSync(SHOT_DIR, { recursive: true });

function writeStatus(obj: Record<string, unknown>): void {
  fs.writeFileSync(STATUS_FILE, JSON.stringify({ ...obj, at: new Date().toISOString() }, null, 2));
  console.log('[STATUS] ' + JSON.stringify(obj));
}

async function untilValue<T extends { error?: string }>(
  description: string,
  action: () => Promise<T>,
  { attempts = 30, delayMs = 1000 }: { attempts?: number; delayMs?: number } = {}
): Promise<T> {
  let lastError: string | undefined;
  for (let i = 0; i < attempts; i++) {
    const result = await action();
    if (!result.error) return result;
    lastError = result.error;
    await new Promise((r) => setTimeout(r, delayMs));
  }
  throw new Error(`Gave up after ${attempts} attempts: ${description}. Last error: ${lastError}`);
}
async function until(
  description: string,
  action: () => Promise<{ error?: string }>,
  opts?: { attempts?: number; delayMs?: number }
): Promise<void> {
  await untilValue(description, action, opts);
}

test('Execute UAT_6589 - DIT #6589 regression across Template Management / Campaign Manager / MDM', async ({ page }) => {
  test.setTimeout(25 * 60 * 1000); // generous ceiling for the two human pauses, not an expectation

  const results: Record<string, unknown> = {};

  // ---- STEP 1: manual login, confirm Template Management loads with no license error ----
  await page.goto('http://vmsrvtst703/innovatum/WebMenu/');
  writeStatus({ phase: 'awaiting_login', message: 'Browser is on the login page - please log in manually with your test account.' });
  await page.waitForSelector('#logout', { timeout: 10 * 60 * 1000 });
  writeStatus({ phase: 'logged_in' });

  await openMenuItem(page, 'Template Management');
  const tmFrame = await findFrame(page, 'TemplateManagement');
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step1_template_management_loaded.png'), fullPage: true });
  const licenseErrorCount = await page.locator('text=Invalid license').count();
  results.step1 = { licenseErrorCount, pass: licenseErrorCount === 0 };
  writeStatus({ phase: 'step1_done', ...results.step1 as object });
  expect(licenseErrorCount, 'Template Management showed a license error on load').toBe(0);

  // ---- STEP 2: create a new template ----
  const templateName = 'DIT6589_' + Date.now().toString().slice(-8);
  await tmFrame.click('#drpMainActions');
  await page.waitForTimeout(500);
  await tmFrame.click('#actCreateTemplate', { force: true });
  await page.waitForTimeout(1000);

  await tmFrame.fill('#txtTemplateName', templateName);
  await tmFrame.fill('#txtDescription', 'DIT #6589 regression UAT - Template Management/Campaign Manager/MDM chain');
  await tmFrame.selectOption('#ddlLabelType', { value: 'Carton Label' });
  await tmFrame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
  await page.waitForTimeout(500);

  const [createResponse, tokenResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
    tmFrame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
  ]);
  const createBody = await createResponse.json();
  const tokenBody = await tokenResponse.json();
  expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
  expect(tokenBody.Token, 'GetFileToken returned no token').toBeTruthy();
  results.step2_create = { templateName, createSuccess: createBody.Success };
  writeStatus({ phase: 'step2_template_created', templateName });

  const beforeLaunch = await flaui.listProcesses();
  const pageTitle = await page.title();
  const browserPid: number = await (async () => {
    const candidates = await flaui.listProcesses('chrom');
    const found = candidates.find(
      (p: { mainWindowTitle: string }) => p.mainWindowTitle.includes(pageTitle) && p.mainWindowTitle.includes('for Testing')
    );
    if (!found) throw new Error(`Could not find Playwright's own browser process (title "${pageTitle}")`);
    return found.pid;
  })();

  let clicked = false;
  for (let attempt = 0; attempt < 20 && !clicked; attempt++) {
    const result = await flaui.clickAt({ processId: browserPid, name: 'Open SentinelLauncher', offsetX: 20, offsetY: 14 });
    if (!result.error) clicked = true;
    else await page.waitForTimeout(500);
  }
  if (!clicked) throw new Error('Never managed to click "Open SentinelLauncher" - prompt may not have appeared.');
  writeStatus({ phase: 'step2_sentinel_launcher_confirmed' });

  let bartenderPid: number | undefined;
  for (let attempt = 0; attempt < 30 && !bartenderPid; attempt++) {
    await page.waitForTimeout(1000);
    const after = await flaui.listProcesses();
    const spawned = flaui.diffNewProcesses(beforeLaunch, after);
    const newMatch = spawned.find((p: { pid: number; name: string }) => /bartend|sentinel/i.test(p.name));
    const anyMatch = after.find((p: { pid: number; name: string }) => /bartend|sentinel/i.test(p.name));
    bartenderPid = newMatch?.pid ?? anyMatch?.pid;
  }
  if (!bartenderPid) throw new Error('BarTender/Sentinel process never appeared.');
  results.step2_bartender = { bartenderPid };
  writeStatus({ phase: 'step2_bartender_launched', bartenderPid });

  await flaui.waitWindow({ processId: bartenderPid, title: 'Template Editor', timeoutSeconds: 60 });
  await until('wait for BarTender toolbar ready', () =>
    flaui.getProperty({ processId: bartenderPid!, name: 'Text', property: 'IsEnabled', controlType: 'MenuItem', retrySeconds: 90, expectValue: 'True' }),
    { attempts: 1 }
  );

  await until('click Text object-creation MenuItem', () =>
    flaui.click({ processId: bartenderPid!, name: 'Text', controlType: 'MenuItem', retrySeconds: 30 }),
    { attempts: 1 }
  );
  await page.waitForTimeout(300);
  await flaui.sendKeys({ keys: ['RETURN'] });

  const workspaceRect = await untilValue('read Workspace BoundingRectangle', () =>
    flaui.getProperty({ processId: bartenderPid!, name: 'Workspace', property: 'BoundingRectangle' })
  );
  const centerX = Math.round(workspaceRect.value.Width / 2);
  const centerY = Math.round(workspaceRect.value.Height / 2);
  await until('drag to place text object', () =>
    flaui.drag({ processId: bartenderPid!, name: 'Workspace', fromOffsetX: centerX, fromOffsetY: centerY, toOffsetX: centerX + 100, toOffsetY: centerY + 30, retrySeconds: 30 }),
    { attempts: 1 }
  );
  await until('center horizontally', () =>
    flaui.click({ processId: bartenderPid!, name: 'Center Horizontally On Template', retrySeconds: 30 }), { attempts: 1 });
  await until('center vertically', () =>
    flaui.click({ processId: bartenderPid!, name: 'Center Vertically On Template', retrySeconds: 30 }), { attempts: 1 });

  await until('right-click placed text object', () =>
    flaui.clickAt({ processId: bartenderPid!, name: 'Workspace', offsetX: centerX, offsetY: centerY, button: 'right', retrySeconds: 30 }), { attempts: 1 });
  await until('click Properties...', () =>
    flaui.click({ processId: bartenderPid!, name: 'Properties...', retrySeconds: 30 }), { attempts: 1 });

  const dataSourceName = 'I_Num';
  await until('open Change Data Source Name Wizard', () =>
    flaui.click({ processId: bartenderPid!, elementName: 'Text Properties', name: '<none>', automationId: '5109', retrySeconds: 30 }), { attempts: 1 });
  await until('type data source name', () =>
    flaui.setText({ processId: bartenderPid!, elementName: 'Change Data Source Name Wizard', name: 'Name:', automationId: '2308', controlType: 'Edit', value: dataSourceName, retrySeconds: 30 }), { attempts: 1 });
  await until('confirm wizard OK', () =>
    flaui.click({ processId: bartenderPid!, elementName: 'Change Data Source Name Wizard', name: 'OK', automationId: '1', retrySeconds: 30 }), { attempts: 1 });
  await until('close Text Properties', () =>
    flaui.click({ processId: bartenderPid!, elementName: 'Text Properties', name: 'Close', automationId: '1', retrySeconds: 30 }), { attempts: 1 });

  await until('click Save', () =>
    flaui.click({ processId: bartenderPid!, title: 'Template Editor', name: 'Save', automationId: 'btnSave', retrySeconds: 30 }), { attempts: 1 });

  await flaui.screenshot({ processId: bartenderPid, title: 'Template Editor', outPath: path.join(SHOT_DIR, 'step2_bartender_saved.png') });
  results.step2 = { templateName, dataSourceName, pass: true };
  writeStatus({ phase: 'step2_done' });

  // ---- STEP 3: Approve (native e-signature - PAUSE for manual entry) ----
  await until('click Approve', () =>
    flaui.click({ processId: bartenderPid!, title: 'Template Editor', name: 'Approve', automationId: 'btnApprove', method: 'mouse' }));
  await page.waitForTimeout(1000);
  writeStatus({ phase: 'awaiting_signature_1', message: 'Signature Required dialog is open in BarTender - please enter your own credentials and click Submit.' });

  let dialogGone = false;
  for (let i = 0; i < 300 && !dialogGone; i++) { // up to 10 min
    await new Promise((r) => setTimeout(r, 2000));
    const check = await flaui.getProperty({ processId: bartenderPid!, elementName: 'Signature Required', name: 'txtUser', automationId: 'txtUser', property: 'Value' });
    if (check.error) dialogGone = true;
  }
  if (!dialogGone) throw new Error('Signature Required dialog never closed - was the approval submitted?');
  writeStatus({ phase: 'step3_signature_submitted' });

  await until('click Close Tab', () =>
    flaui.click({ processId: bartenderPid!, title: 'Template Editor', name: 'Close Tab', automationId: 'btnCloseTab', method: 'mouse' }));
  results.step3 = { pass: true };
  writeStatus({ phase: 'step3_done' });

  await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click().catch(() => {});
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(SHOT_DIR, 'step3_back_in_webmenu.png'), fullPage: true });

  // ---- STEP 4-5: Campaign Manager - create item, associate template, save ----
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

  await editFrame.selectOption('select[name="txtTemplateName"]', templateName);
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

  const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`, { attempts: 300, intervalMs: 2000 }); // up to 10 min
  await finalFrame.waitForLoadState('networkidle').catch(() => {});
  const approvedStatus = finalFrame.locator('span[data-bind*="approvedStatus"]');
  await expect(approvedStatus, 'Approved status still shows Unapproved after signature step').not.toHaveText('Unapproved', { timeout: 30_000 });
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
  // Known, unrelated bug (see robar-module-reference.md): RobarMasterData's default Labeler Duns
  // Number fails its own validity check - change it before Save, per UAT step 7's own note.
  await mdm.selectDropdownFieldByCaption(mdmFrame, 'Labeler Duns Number', 'Innovatum');
  await mdm.fillFieldByCaption(mdmFrame, 'Primary DI Number', '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await mdm.fillFieldByCaption(mdmFrame, 'Brand Name', 'DIT 6589 Test Brand');

  await mdm.saveRecord(page, mdmFrame);
  await expect(mdmFrame.getByRole('button', { name: 'Save' })).toBeDisabled();
  await page.screenshot({ path: path.join(SHOT_DIR, 'step7_mdm_record_saved.png'), fullPage: true });
  results.step7 = { itemNumber, pass: true };
  writeStatus({ phase: 'all_done', results });

  fs.writeFileSync(path.join(SCRATCH, 'results.json'), JSON.stringify({ templateName, itemNumber, results }, null, 2));
});
