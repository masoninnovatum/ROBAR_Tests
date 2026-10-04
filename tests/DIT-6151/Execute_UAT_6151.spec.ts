// Executes UAT_6151.doc (DIT #6151: Label Control Redline Compare -- for the Sample master (the label
// on the right), the Master Data Version was being populated with the Template Version) against
// VMSRVVAL703, capturing evidence for each of the UAT's 7 steps.
//
// MUST be run with ROBAR_BASE_URL pointed at VAL703 (the .env default is TST703):
//   ROBAR_BASE_URL=http://vmsrvval703/innovatum/WebMenu/ npx playwright test tests/DIT-6151/Execute_UAT_6151.spec.ts -g "stage 1"
// Stages share identifiers through state.json (template name, item numbers, LCNs) so a failed stage
// can be re-run on its own instead of redoing earlier ones. Headed: steps 1 and 4 drive BarTender
// through FlaUI.
//
// E-signatures are auto-filled from seed.ts per the standing UAT-execution decision (the signature
// mechanism itself is not what this UAT tests).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, openMenuItem, findFrame, BASE_URL, USERNAME, PASSWORD } from '../support/robar';
import * as bartender from '../support/bartender';
import * as flaui from '../../scripts/flaui_bridge';
import * as mdm from '../support/master-data';

const SCRATCH = 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/a480f2e1-948d-42ae-aee0-d197f8c859fc/scratchpad/uat6151_exec';
const SHOT_DIR = path.join(SCRATCH, 'screenshots');
const STATE_FILE = path.join(SCRATCH, 'state.json');
const LOG_FILE = path.join(SCRATCH, 'progress.log');
fs.mkdirSync(SHOT_DIR, { recursive: true });

test.use({ headless: false });

function log(msg: string): void {
  const line = `[${new Date().toISOString()}] ${msg}`;
  console.log(line);
  fs.appendFileSync(LOG_FILE, line + '\n');
}

function readState(): Record<string, any> {
  return fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {};
}
function writeState(patch: Record<string, unknown>): void {
  fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));
}

async function shot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: path.join(SHOT_DIR, name + '.png'), fullPage: true });
  log(`screenshot: ${name}`);
}

function assertVal703(): void {
  if (!BASE_URL.toLowerCase().includes('vmsrvval703')) {
    throw new Error(`Refusing to run: BASE_URL is ${BASE_URL}, not VAL703. Set ROBAR_BASE_URL.`);
  }
}

// Keeps WebMenu's own inactivity timeout from firing while BarTender is being driven (a slow
// BarTender round trip can outlast it, and it only resets on a literal mousemove otherwise).
function startKeepAlive(page: Page): NodeJS.Timeout {
  return setInterval(() => {
    page
      .evaluate(() => {
        const w = window as unknown as { RefreshTimeout?: () => void };
        if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
      })
      .catch(() => {});
  }, 120_000);
}

/** Signs the native BarTender "Signature Required" dialog with seed.ts credentials, then closes the editor. */
async function approveInBarTender(page: Page, bartenderPid: number): Promise<void> {
  await bartender.until(page, 'click Approve', () =>
    flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Approve', automationId: 'btnApprove', method: 'mouse' })
  );
  await page.waitForTimeout(1000);
  await bartender.until(
    page,
    'fill User in the Signature Required dialog',
    () => flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtUser', automationId: 'txtUser', value: USERNAME, retrySeconds: 60, verify: true, method: 'win32' }),
    { attempts: 1 }
  );
  await bartender.until(
    page,
    'fill Password in the Signature Required dialog',
    () => flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtPassword', automationId: 'txtPassword', value: PASSWORD, retrySeconds: 30, verify: true, method: 'win32' }),
    { attempts: 1 }
  );
  await bartender.until(
    page,
    'submit the Signature Required dialog',
    () => flaui.click({ processId: bartenderPid, elementName: 'Signature Required', name: 'Submit', automationId: 'btnSubmit', method: 'mouse' }),
    { attempts: 1 }
  );
}

test.describe.configure({ mode: 'serial' });

test('stage 1 - UAT step 1: create an approved template with sharenames S_TVer and m_description', async ({ page }) => {
  test.setTimeout(600_000);
  assertVal703();
  await login(page);
  log('stage 1: logged in to ' + BASE_URL);

  const templateName = 'DIT6151_' + Date.now().toString().slice(-7);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  await frame.click('#drpMainActions');
  await page.waitForTimeout(500);
  await frame.click('#actCreateTemplate', { force: true });
  await page.waitForTimeout(1000);

  await frame.fill('#txtTemplateName', templateName);
  await frame.fill('#txtDescription', 'DIT #6151 UAT - Redline Compare Master Data Version');
  await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
  await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
  await page.waitForTimeout(500);

  const [createResponse, tokenResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
    frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
  ]);
  const createBody = await createResponse.json();
  const tokenBody = await tokenResponse.json();
  expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
  expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();
  writeState({ templateName });
  log(`stage 1: template ${templateName} created, launching BarTender`);

  const keepAlive = startKeepAlive(page);
  try {
    const bartenderPid = await bartender.launchTemplateEditor(page);
    log(`stage 1: BarTender ready (pid ${bartenderPid})`);

    const rect = await flaui.getProperty({ processId: bartenderPid, name: 'Workspace', property: 'BoundingRectangle' });

    await bartender.addTextObjectBoundToSharename(page, bartenderPid, 'S_TVer');
    log('stage 1: S_TVer object added');
    // Placed above the centered object with clear space between the two (the earlier fixed
    // -80 offset left their text overlapping -- see bartender.secondTextObjectOffset).
    await bartender.addTextObjectBoundToSharename(page, bartenderPid, 'm_description', {
      center: false,
      placeAtOffset: bartender.secondTextObjectOffset(rect.value),
    });
    log('stage 1: m_description object added');

    await bartender.saveTemplate(page, bartenderPid);
    await flaui.screenshot({ processId: bartenderPid, title: 'Template Editor', outPath: path.join(SHOT_DIR, 'step1_bartender_two_sharenames.png') });
    log('stage 1: saved, BarTender screenshot taken');

    await approveInBarTender(page, bartenderPid);
    log('stage 1: approval submitted');
    await bartender.closeTemplateEditor(page, bartenderPid);
    log('stage 1: BarTender closed');
  } finally {
    clearInterval(keepAlive);
  }

  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await shot(page, 'step1_template_management_after_approval');
  writeState({ stage1Done: true });
  log('stage 1: done');
});

/** Queries Template Management for exactly one template name (the page persists a stale filter row
 * per account, so set row 0 explicitly rather than assuming a clean slate). */
async function queryTemplateByName(page: Page, frame: Frame, name: string) {
  if ((await frame.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
  }
  await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
  await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
  await frame.fill('input[name="dvFilters[0].Value"]', name);
  await Promise.all([
    page.waitForResponse(
      (r) => r.url().includes('/TemplateManagement/GridSessionStart') && r.request().method() === 'POST' && (r.request().postData() || '').includes(name),
      { timeout: 15_000 }
    ),
    frame.click('#btnRetrieveData'),
  ]);
  const rows = frame.locator('#grdJqGrid tr').filter({ hasText: name });
  await rows.first().waitFor({ state: 'visible', timeout: 10_000 });
  return rows;
}

test('stage 1b - verify the UAT step 1 template: approved, with both sharenames', async ({ page }) => {
  test.setTimeout(180_000);
  assertVal703();
  const { templateName } = readState();
  expect(templateName, 'run stage 1 first').toBeTruthy();
  await login(page);

  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const rows = await queryTemplateByName(page, frame, templateName);
  const rowText = (await rows.first().innerText()).replace(/\s+/g, ' ');
  log(`stage 1b: grid row text: ${rowText}`);
  await shot(page, 'step1_template_row');

  await rows.first().getByText('Actions', { exact: true }).click();
  await page.waitForTimeout(500);
  await frame.getByText('View Label Characteristics', { exact: true }).click();
  await page.waitForTimeout(1000);
  const dialog = frame.locator('#labelCharsDialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog).toContainText(templateName);
  await expect(dialog).toContainText('S_TVer');
  await expect(dialog).toContainText('m_description');
  log('stage 1b: label characteristics: ' + (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 400));
  await shot(page, 'step1_label_characteristics');
  await frame.click('#btnViewLabelCharsClose');
  writeState({ stage1bDone: true, templateRowText: rowText });
});

/** Creates and approves a Campaign Manager item on `templateName`, leaving the Campaign Manager tab closed. */
async function createApprovedItem(page: Page, itemNumber: string, templateName: string, shotPrefix?: string): Promise<void> {
  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000);

  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible', timeout: 10_000 });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', 'Carton Label');
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  const options = await editFrame.locator('select[name="txtTemplateName"] option').allTextContents();
  expect(options, `Template ${templateName} not offered in the item's Template dropdown`).toContain(templateName);
  await editFrame.selectOption('select[name="txtTemplateName"]', templateName);
  await editFrame.fill('input[name="txtDescription"]', 'DIT #6151 UAT item');

  const [saveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }),
    editFrame.click('button:has-text("Save")'),
  ]);
  expect(saveResponse.status()).toBe(200);
  await page.waitForTimeout(1000);

  await editFrame.click('text=Actions');
  await editFrame.click('text=Approve Item');
  await page.waitForTimeout(500);
  const approveDialog = editFrame.locator('#approveItemDialog');
  await approveDialog.locator('#sigUser').fill(USERNAME, { timeout: 5000 });
  await approveDialog.locator('#sigPassword').fill(PASSWORD, { timeout: 5000 });
  await approveDialog.locator('#sigComments').fill('Approved by UAT_6151 execution', { timeout: 5000 });
  const [approveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
    editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  const approveBody = await approveResponse.json();
  expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

  const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await finalFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  const approvedStatus = finalFrame.locator('span[data-bind*="approvedStatus"]');
  await expect(approvedStatus).not.toHaveText('Unapproved', { timeout: 15_000 });
  log(`item ${itemNumber}: approved status "${await approvedStatus.textContent()}"`);
  if (shotPrefix) await shot(page, shotPrefix);

  await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test('stage 2 - UAT steps 2-3: approved item on the template, then a Master Data record for it', async ({ page }) => {
  test.setTimeout(300_000);
  assertVal703();
  const { templateName } = readState();
  expect(templateName, 'run stage 1 first').toBeTruthy();
  await login(page);

  const itemNumber = 'DIT6151' + Date.now().toString().slice(-6);
  await createApprovedItem(page, itemNumber, templateName, 'step2_item_approved');
  writeState({ itemNumber });
  log(`stage 2: item ${itemNumber} created and approved`);

  // ---- UAT step 3: Master Data Management record with the same item number ----
  await openMenuItem(page, 'Master Data');
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);
  await mdm.selectSchema(mdmFrame, 'RobarMasterData');
  await mdm.openNewRecordAction(mdmFrame);
  await mdm.submitNewItemDialog(page, mdmFrame, itemNumber, 'DIT #6151 UAT master data record');
  await expect(mdmFrame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 15_000 });

  await mdm.setItemDescription(mdmFrame, 'DIT #6151 UAT master data record');
  await mdm.selectDropdownFieldByCaption(mdmFrame, 'Labeler Duns Number', 'Innovatum');
  await mdm.fillFieldByCaption(mdmFrame, 'Primary DI Number', '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await mdm.fillFieldByCaption(mdmFrame, 'Brand Name', 'DIT 6151 Test Brand');

  const saveBody = await mdm.saveRecord(page, mdmFrame);
  log('stage 2: MDM save response: ' + JSON.stringify(saveBody).slice(0, 300));
  await expect(mdmFrame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  await shot(page, 'step3_mdm_record_saved');
  writeState({ stage2Done: true });
  log('stage 2: done');
});

test('stage 4 - UAT step 4: new approved and effective version of the template (Save As New > New Version)', async ({ page }) => {
  test.setTimeout(600_000);
  assertVal703();
  const { templateName } = readState();
  expect(templateName, 'run stage 1 first').toBeTruthy();
  await login(page);

  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2000);

  const rows = await queryTemplateByName(page, frame, templateName);
  await expect(rows).toHaveCount(1);
  await rows.first().getByText('Actions', { exact: true }).click();
  await page.waitForTimeout(500);
  await rows.first().getByText('Save As New', { exact: true }).click();
  await page.waitForTimeout(500);

  const dialog = frame.locator('#saveAsNewDialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  const newVersionRadio = dialog.locator('#rbNewVersion');
  await expect(newVersionRadio, 'New Version should be enabled for an approved, latest-version template').toBeEnabled();
  await newVersionRadio.check();
  await page.waitForTimeout(500);
  log('stage 4: Save As New dialog text: ' + (await dialog.innerText()).replace(/\s+/g, ' ').slice(0, 400));
  await shot(page, 'step4_save_as_new_version_dialog');

  const [saveAsNewResponse, tokenResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/SaveAsNew'), { timeout: 15_000 }),
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
    frame.locator('#btnSaveAsNewSubmit').click(),
  ]);
  const saveAsNewBody = await saveAsNewResponse.json();
  const tokenBody = await tokenResponse.json();
  log('stage 4: SaveAsNew response: ' + JSON.stringify(saveAsNewBody).slice(0, 300));
  expect(saveAsNewBody.Success, `SaveAsNew failed: ${JSON.stringify(saveAsNewBody)}`).toBe(true);
  expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

  const keepAlive = startKeepAlive(page);
  try {
    const bartenderPid = await bartender.launchTemplateEditor(page);
    log(`stage 4: BarTender ready (pid ${bartenderPid})`);
    await bartender.saveTemplate(page, bartenderPid);
    await flaui.screenshot({ processId: bartenderPid, title: 'Template Editor', outPath: path.join(SHOT_DIR, 'step4_bartender_new_version.png') });
    await approveInBarTender(page, bartenderPid);
    log('stage 4: approval submitted');
    await bartender.closeTemplateEditor(page, bartenderPid);
    log('stage 4: BarTender closed');
  } finally {
    clearInterval(keepAlive);
  }

  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const after = await queryTemplateByName(page, frame, templateName);
  const texts = (await after.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  log('stage 4: template rows after: ' + JSON.stringify(texts));
  await shot(page, 'step4_template_versions');
  expect(texts.length, 'expected both version 0 and the new version in the grid').toBeGreaterThanOrEqual(2);
  writeState({ stage4Done: true, templateRowsAfter: texts });
  log('stage 4: done');
});

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

/** Opens Label Control fresh, resets all saved filter state, and queries by item number. */
async function openLabelControlAndQuery(page: Page, itemFilter: string, operator: string = 'ExactlyMatches'): Promise<Frame> {
  await page.locator(LC_TAB_CLOSE).click({ timeout: 2000 }).catch(() => {});
  await openMenuItem(page, 'Label Control');
  let frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await frame.click('#btnReset');
  await page.waitForTimeout(1500);
  frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);

  await frame.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
  await frame.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
  await frame.locator('#drpLabelMaster').selectOption({ label: 'Any (Label Masters)' });
  await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
  await page.waitForTimeout(500);
  await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
  await frame.locator("select[name$='Operator']").first().selectOption(operator);
  await frame.locator("input[name$='Value']").first().fill(itemFilter);
  await frame.click('#btnRetrieveData');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return frame;
}

/** Assigns an LCN to one item via the Assign Control Number bulk action; returns the LCN and the job's detail text. */
async function assignLcn(page: Page, itemNumber: string): Promise<{ lcn: string; detailText: string }> {
  const frame = await openLabelControlAndQuery(page, itemNumber);
  const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
  await expect(row, `Item ${itemNumber} not found in Label Control grid`).toHaveCount(1, { timeout: 10_000 });
  await row.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);
  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  await frame.click('#actAssignLabelControl', { force: true });

  const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
  await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await jobFrame.fill('#txtJobDescription', 'UAT_6151 - Assign Control Number', { timeout: 5000 });
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  await jobFrame.selectOption('#sigReason', { index: 1 }, { timeout: 5000 });
  await jobFrame.fill('#sigComments', 'Assigned by UAT_6151 execution', { timeout: 5000 });
  const [submitResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
    jobFrame.click('#submitBtn', { timeout: 5000 }),
  ]);
  const submitBody = await submitResponse.json();
  expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

  let detailFrame = await findFrame(page, 'MassAssign/JobDetail');
  let detailText = '';
  for (let attempt = 0; attempt < 30; attempt++) {
    detailText = await detailFrame.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (/Status:?\s*(Completed|Failed)/.test(detailText) && !/Page\s+of\s+0/.test(detailText)) break;
    await page.waitForTimeout(2000);
    detailFrame = await findFrame(page, 'MassAssign/JobDetail');
  }
  log(`assignLcn(${itemNumber}) job detail: ` + detailText.replace(/\s+/g, ' ').slice(0, 700));

  let lcn: string | undefined;
  for (let attempt = 0; attempt < 10 && !lcn; attempt++) {
    await page.waitForTimeout(2000);
    const f2 = await openLabelControlAndQuery(page, itemNumber);
    const text = await f2.locator('#grdLabelControl tr').filter({ hasText: itemNumber }).innerText().catch(() => '');
    lcn = text.match(/LCN\d+/)?.[0];
  }
  expect(lcn, `Item ${itemNumber} never showed an assigned LCN`).toBeTruthy();
  return { lcn: lcn!, detailText };
}

test('stage 5 - UAT step 5: assign control numbers (other record first so the UAT item is the Sample)', async ({ page }) => {
  test.setTimeout(480_000);
  assertVal703();
  const { templateName, itemNumber } = readState();
  expect(itemNumber, 'run stage 2 first').toBeTruthy();
  await login(page);

  // The Redline Compare Sample master is the record with the LARGER LCN, so the other record gets
  // its LCN first.
  const itemNumberB = itemNumber + 'B';
  await createApprovedItem(page, itemNumberB, templateName);
  const b = await assignLcn(page, itemNumberB);
  log(`stage 5: other record ${itemNumberB} -> ${b.lcn}`);

  const main = await assignLcn(page, itemNumber);
  log(`stage 5: UAT item ${itemNumber} -> ${main.lcn}`);
  writeState({ itemNumberB, lcnB: b.lcn, lcnMain: main.lcn });

  const frame = await openLabelControlAndQuery(page, itemNumber);
  await shot(page, 'step5_label_control_lcn_assigned');
  await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  writeState({ stage5Done: true });
  log('stage 5: done');
});

/** Opens the row-level Update Versions dialog for the (single) matching row and waits for its selects to populate. */
async function openUpdateVersionsDialog(page: Page, frame: Frame, itemNumber: string): Promise<void> {
  const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await row.getByText('Actions', { exact: true }).click();
  await page.waitForTimeout(500);
  await row.getByText('Update Versions', { exact: true }).click();
  await frame.locator('#drpTemplateVersion').waitFor({ state: 'visible', timeout: 15_000 });
  await expect(frame.locator('#drpTemplateVersion option').first()).toBeAttached({ timeout: 10_000 });
  await page.waitForTimeout(1000);
}

async function readVersionSelects(frame: Frame): Promise<Record<string, unknown>> {
  const read = async (sel: string) => ({
    options: await frame.locator(`${sel} option`).allTextContents(),
    selected: (await frame.locator(`${sel} option:checked`).textContent().catch(() => null))?.trim() ?? null,
    disabled: await frame.locator(sel).isDisabled().catch(() => null),
  });
  return { item: await read('#dvItemVersion'), template: await read('#drpTemplateVersion'), masterData: await read('#drpMasterDataVersion') };
}

test('stage 6 - UAT step 6: Update Versions row action moves the record to Template Version 1', async ({ page }) => {
  test.setTimeout(300_000);
  assertVal703();
  const { itemNumber } = readState();
  expect(itemNumber, 'run stage 5 first').toBeTruthy();
  await login(page);

  let frame = await openLabelControlAndQuery(page, itemNumber);
  await openUpdateVersionsDialog(page, frame, itemNumber);
  const before = await readVersionSelects(frame);
  log('stage 6: dialog BEFORE: ' + JSON.stringify(before));
  await shot(page, 'step6_update_versions_dialog_before');

  // Observed on VAL703: the LCN was assigned AFTER the new template version existed (step 4), so it
  // was already on Template Version 1 and Update Versions' button stays disabled (nothing to change).
  // The UAT's expected result -- "Record is associated with Template Version 1" -- is checked here
  // from the dialog's own selected value rather than by clicking Update.
  expect((before.template as { selected: string | null }).selected, 'record should be on Template Version 1').toBe('1');
  await page.keyboard.press('Escape');
  await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  writeState({ stage6Done: true, updateVersionsBefore: before });
  log('stage 6: done');
});

test('stage 6b - link the record to Master Data Version 0 through Update Versions (data prerequisite for step 7)', async ({ page }) => {
  test.setTimeout(300_000);
  assertVal703();
  const { itemNumber } = readState();
  expect(itemNumber, 'run stage 5 first').toBeTruthy();
  await login(page);

  let frame = await openLabelControlAndQuery(page, itemNumber);
  await openUpdateVersionsDialog(page, frame, itemNumber);
  // Step 3's Master Data record is still Unapproved, so Assign Control Number left the record's
  // Master Data Version at "None". Step 7 expects Master Data Version 0, so link it here.
  const md = frame.locator('#drpMasterDataVersion');
  const mdOptions = await md.locator('option').allTextContents();
  const target = mdOptions.find((o) => o.trim().startsWith('0'));
  expect(target, `no Master Data version 0 option in ${JSON.stringify(mdOptions)}`).toBeTruthy();
  await md.selectOption({ label: target! }, { timeout: 5000 });
  await page.waitForTimeout(500);
  log('stage 6b: dialog with MD version chosen: ' + JSON.stringify(await readVersionSelects(frame)));
  await shot(page, 'step6b_update_versions_master_data_selected');

  const [updateResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('UpdateLabelControl'), { timeout: 15_000 }),
    frame.click('#btnUpdate', { timeout: 5000 }),
  ]);
  const updateBody = await updateResponse.json().catch(() => ({}));
  log('stage 6b: UpdateLabelControl response: ' + JSON.stringify(updateBody).slice(0, 400));
  expect(updateBody.ErrorMessage ?? '', `Update Versions reported: ${JSON.stringify(updateBody)}`).toBe('');
  await page.waitForTimeout(3000);

  frame = await openLabelControlAndQuery(page, itemNumber);
  await openUpdateVersionsDialog(page, frame, itemNumber);
  const after = await readVersionSelects(frame);
  log('stage 6b: dialog AFTER: ' + JSON.stringify(after));
  await shot(page, 'step6b_update_versions_after');
  expect((after.masterData as { selected: string | null }).selected?.trim().startsWith('0'), 'record should now be linked to MD version 0').toBe(true);
  expect((after.template as { selected: string | null }).selected, 'template version should still be 1').toBe('1');
  await page.keyboard.press('Escape');
  await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  writeState({ stage6bDone: true, updateVersionsAfterMd: after });
  log('stage 6b: done');
});

test('stage 7 - UAT step 7: Redline Compare shows Master Data Ver 0 and Template Ver 1 for the Sample master', async ({ page }) => {
  test.setTimeout(300_000);
  assertVal703();
  const { itemNumber, itemNumberB, lcnMain, lcnB } = readState();
  expect(itemNumberB, 'run stage 5 first').toBeTruthy();
  await login(page);

  // Both records share the main item number as a prefix (the other one ends in "B").
  const frame = await openLabelControlAndQuery(page, itemNumber, 'Contains');
  const rowA = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber + ' ' });
  const rowMain = frame.locator('#grdLabelControl tr').filter({ hasText: lcnMain });
  const rowB = frame.locator('#grdLabelControl tr').filter({ hasText: lcnB });
  await expect(rowMain).toHaveCount(1, { timeout: 10_000 });
  await expect(rowB).toHaveCount(1, { timeout: 10_000 });
  // Observed on VAL703: the FIRST-checked row becomes the Master and the SECOND-checked row the
  // Sample (not decided by LCN size), so check the other record first to make the UAT item the Sample.
  await rowB.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);
  await rowMain.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);

  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  const [getLcnResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('GetLCNForRedline'), { timeout: 15_000 }),
    frame.click('#actRedlineCompare', { force: true }),
  ]);
  const getLcn = await getLcnResponse.json();
  log('stage 7: GetLCNForRedline: ' + JSON.stringify(getLcn));
  expect(getLcn.Success).toBe(true);
  expect(getLcn.SampleLCN, 'the UAT item (larger LCN) should be the Sample master on the right').toBe(lcnMain);

  let tempDialog = 0;
  let compareDialog = 0;
  for (let attempt = 0; attempt < 20; attempt++) {
    tempDialog = await frame.locator('#createTempMasterDialog').count();
    compareDialog = await frame.locator('#redlineCompareDiv').count();
    if (tempDialog > 0 || compareDialog > 0) break;
    await page.waitForTimeout(1000);
  }
  if (tempDialog > 0) {
    await shot(page, 'step7_create_temporary_master_prompt');
    await frame.locator('.createTempClass .ui-dialog-buttonpane button', { hasText: 'Yes' }).click();
  }
  await expect(frame.locator('#redlineCompareDiv')).toHaveCount(1, { timeout: 20_000 });
  await page.waitForTimeout(5000);

  const norm = (s: string) => s.replace(/\s+/g, ' ').trim();
  const sampleText = norm(await frame.locator('#divLabelSample').innerText());
  const masterText = norm(await frame.locator('#divLabelMaster').innerText());
  log('stage 7: LEFT (master) panel: ' + masterText);
  log('stage 7: RIGHT (sample) panel: ' + sampleText);
  await shot(page, 'step7_redline_compare');
  writeState({ redlineLeft: masterText, redlineRight: sampleText });

  expect(sampleText, 'Sample panel should be the UAT item').toContain(itemNumber);
  expect(sampleText, 'Sample Master Data Version').toMatch(/Master Data Ver:\s*0/);
  expect(sampleText, 'Sample Template Version').toMatch(/Template Ver:\s*1/);

  await frame.locator('.redCompareClass .ui-dialog-buttonpane button').last().click();
  await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  writeState({ stage7Done: true });
  log('stage 7: done');
});
