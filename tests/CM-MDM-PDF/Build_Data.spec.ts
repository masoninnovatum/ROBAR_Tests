// Test data for UAT_CM_MDMIntegrationAndPDF steps 15-17 (TST703). All names are MB-prefixed and undeletable fixtures stay small:
//   template MBPDFT<stamp>  : version 0 APPROVED + effective, version 1 UNAPPROVED (latest)         -> "templates whose latest versions are unapproved"
//   item MBPDF6<stamp>      : approved item on that template                                         ("ITM6")
//   item MBPDF2<stamp>      : approved item on A1SuperTemplate + Master Data record (RobarMasterData) with the same item number:
//                             MD version 0 approved, version 1 UNAPPROVED (latest)                   -> "master data items whose latest versions are unapproved" ("ITM2")
// Stages share their identifiers through state.json (scratchpad), so a failed stage can be re-run alone. HEADED (BarTender through FlaUI). Reuses the proven flows of DIT-6151/Execute_UAT_6151.spec.ts.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, openMenuItem, findFrame, BASE_URL, USERNAME, PASSWORD } from '../support/robar';
import * as bartender from '../support/bartender';
import * as flaui from '../../scripts/flaui_bridge';
import * as mdm from '../support/master-data';
import * as cm from '../support/campaign-manager';

const SCRATCH = 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/a480f2e1-948d-42ae-aee0-d197f8c859fc/scratchpad/cmmdmpdf';
const STATE_FILE = path.join(SCRATCH, 'state.json');
fs.mkdirSync(SCRATCH, { recursive: true });

test.use({ headless: false });
test.describe.configure({ mode: 'serial' });

const readState = (): Record<string, any> => (fs.existsSync(STATE_FILE) ? JSON.parse(fs.readFileSync(STATE_FILE, 'utf8')) : {});
const writeState = (patch: Record<string, unknown>): void => fs.writeFileSync(STATE_FILE, JSON.stringify({ ...readState(), ...patch }, null, 2));
const log = (m: string): void => console.log(`[${new Date().toISOString()}] ${m}`);

function assertTst703(): void {
  if (!BASE_URL.toLowerCase().includes('vmsrvtst703')) throw new Error(`Refusing to run: BASE_URL is ${BASE_URL}, not TST703.`);
}

function startKeepAlive(page: Page): NodeJS.Timeout {
  return setInterval(() => {
    page.evaluate(() => { const w = window as unknown as { RefreshTimeout?: () => void }; if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout(); }).catch(() => {});
  }, 120_000);
}

async function approveInBarTender(page: Page, bartenderPid: number): Promise<void> {
  await bartender.until(page, 'click Approve', () => flaui.click({ processId: bartenderPid, title: 'Template Editor', name: 'Approve', automationId: 'btnApprove', method: 'mouse' }));
  await page.waitForTimeout(1000);
  await bartender.until(page, 'fill User', () => flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtUser', automationId: 'txtUser', value: USERNAME, retrySeconds: 60, verify: true, method: 'win32' }), { attempts: 1 });
  await bartender.until(page, 'fill Password', () => flaui.setText({ processId: bartenderPid, elementName: 'Signature Required', name: 'txtPassword', automationId: 'txtPassword', value: PASSWORD, retrySeconds: 30, verify: true, method: 'win32' }), { attempts: 1 });
  await bartender.until(page, 'submit the Signature Required dialog', () => flaui.click({ processId: bartenderPid, elementName: 'Signature Required', name: 'Submit', automationId: 'btnSubmit', method: 'mouse' }), { attempts: 1 });
}

/** Row-0 query of Template Management by exact name (the page restores saved criteria; extra rows are removed first). */
async function queryTemplate(page: Page, frame: import('@playwright/test').Frame, name: string) {
  for (let i = 0; i < 6; i++) {
    const n = await frame.locator('select[name$="Column"]').count();
    if (n <= 1) break;
    await frame.locator('.criteriaFilter-Filter').nth(n - 1).getByText('Remove').click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(400);
  }
  if (!(await frame.locator('select[name$="Column"]').count())) { await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click(); await page.waitForTimeout(500); }
  await frame.locator('#chkLatestVersion').uncheck().catch(() => {}); // the checkbox is persisted per user
  await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
  await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
  await frame.fill('input[name="dvFilters[0].Value"]', name);
  await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart') && (r.request().postData() || '').includes(name), { timeout: 15_000 }), frame.click('#btnRetrieveData')]);
  const rows = frame.locator('#grdJqGrid tr').filter({ hasText: name });
  await rows.first().waitFor({ state: 'visible', timeout: 10_000 });
  return rows;
}

async function createApprovedItem(page: Page, itemNumber: string, templateName: string): Promise<void> {
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
  await editFrame.fill('input[name="txtDescription"]', 'UAT CM MDM PDF data item');
  const [saveResponse] = await Promise.all([page.waitForResponse((r) => r.url().includes('/items/') && r.request().method() === 'POST', { timeout: 15_000 }), editFrame.click('button:has-text("Save")')]);
  expect(saveResponse.status()).toBe(200);
  await page.waitForTimeout(1000);
  await editFrame.click('text=Actions');
  await editFrame.click('text=Approve Item');
  await page.waitForTimeout(500);
  const approveDialog = editFrame.locator('#approveItemDialog');
  await approveDialog.locator('#sigUser').fill(USERNAME, { timeout: 5000 });
  await approveDialog.locator('#sigPassword').fill(PASSWORD, { timeout: 5000 });
  await approveDialog.locator('#sigComments').fill('Approved for UAT_CM_MDMIntegrationAndPDF test data', { timeout: 5000 });
  const [approveResponse] = await Promise.all([page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }), editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click()]);
  const approveBody = await approveResponse.json();
  expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);
  const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await finalFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await expect(finalFrame.locator('span[data-bind*="approvedStatus"]')).not.toHaveText('Unapproved', { timeout: 15_000 });
  await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

test('stage T1 - template MBPDFT<stamp> version 0, approved', async ({ page }) => {
  test.setTimeout(600_000);
  assertTst703();
  await login(page);
  const templateName = 'MBPDFT' + Date.now().toString().slice(-6);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');
  await frame.click('#drpMainActions');
  await page.waitForTimeout(500);
  await frame.click('#actCreateTemplate', { force: true });
  await page.waitForTimeout(1000);
  await frame.fill('#txtTemplateName', templateName);
  await frame.fill('#txtDescription', 'UAT CM MDM PDF test data template');
  await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
  await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
  await page.waitForTimeout(500);
  const [createResponse, tokenResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
    frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
  ]);
  expect((await createResponse.json()).Success).toBe(true);
  expect((await tokenResponse.json()).Token).toBeTruthy();
  writeState({ templateName });
  const keepAlive = startKeepAlive(page);
  try {
    const pid = await bartender.launchTemplateEditor(page);
    await bartender.saveTemplate(page, pid);
    await approveInBarTender(page, pid);
    await bartender.closeTemplateEditor(page, pid);
  } finally {
    clearInterval(keepAlive);
  }
  writeState({ stageT1Done: true });
  log(`T1 done: ${templateName}`);
});

test('stage T2 - template version 1 (Save As New > New Version), left UNAPPROVED', async ({ page }) => {
  test.setTimeout(600_000);
  assertTst703();
  const { templateName } = readState();
  expect(templateName, 'run T1 first').toBeTruthy();
  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(2000);
  const rows = await queryTemplate(page, frame, templateName);
  await expect(rows).toHaveCount(1);
  await rows.first().getByText('Actions', { exact: true }).click();
  await page.waitForTimeout(500);
  await rows.first().getByText('Save As New', { exact: true }).click();
  await page.waitForTimeout(500);
  const dialog = frame.locator('#saveAsNewDialog');
  await expect(dialog).toBeVisible({ timeout: 10_000 });
  await expect(dialog.locator('#rbNewVersion')).toBeEnabled();
  await dialog.locator('#rbNewVersion').check();
  const [saveAsNewResponse, tokenResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/SaveAsNew'), { timeout: 15_000 }),
    page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
    frame.locator('#btnSaveAsNewSubmit').click(),
  ]);
  expect((await saveAsNewResponse.json()).Success).toBe(true);
  expect((await tokenResponse.json()).Token).toBeTruthy();
  const keepAlive = startKeepAlive(page);
  try {
    const pid = await bartender.launchTemplateEditor(page);
    await bartender.saveTemplate(page, pid);
    // NO approval: version 1 stays unapproved
    await bartender.closeTemplateEditor(page, pid);
  } finally {
    clearInterval(keepAlive);
  }
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  const after = await queryTemplate(page, frame, templateName);
  const texts = (await after.allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
  log('T2 template rows: ' + JSON.stringify(texts));
  expect(texts.length, 'versions 0 and 1').toBeGreaterThanOrEqual(2);
  writeState({ stageT2Done: true, templateRows: texts });
});

test('stage I6 - approved item MBPDF6<stamp> on the template (latest template version unapproved)', async ({ page }) => {
  test.setTimeout(300_000);
  assertTst703();
  const { templateName } = readState();
  expect(templateName, 'run T1/T2 first').toBeTruthy();
  await login(page);
  const item6 = 'MBPDF6' + Date.now().toString().slice(-6);
  await createApprovedItem(page, item6, templateName);
  writeState({ item6 });
  log(`I6 done: ${item6}`);
});

test('stage I2 - approved item MBPDF2<stamp> on A1SuperTemplate + Master Data record (v0 approved, v1 unapproved)', async ({ page }) => {
  test.setTimeout(420_000);
  assertTst703();
  await login(page);
  const item2 = 'MBPDF2' + Date.now().toString().slice(-6);
  await createApprovedItem(page, item2, cm.TEMPLATE);
  // Master Data record with the same item number, approved, then a new (unapproved) version
  writeState({ item2 });
  let frame = await mdm.reopenMasterData(page);
  await mdm.createValidRecord(page, frame, { itemNumber: item2, brandName: 'PDF Brand v0' });
  await mdm.clickEditAction(page, frame, 'menuApprove');
  await mdm.signAndSubmit(frame, '#approveDialog', 'btnApproveSubmit', 'General Approval');
  await expect(frame.getByText(new RegExp(`Approved By:\\s*${USERNAME}`, 'i'))).toBeVisible({ timeout: 15_000 });
  await mdm.clickEditAction(page, frame, 'menuSaveAsNewVersion');
  await page.waitForTimeout(1000);
  await mdm.confirmDialog(frame);
  await page.waitForTimeout(3500);
  frame = await findFrame(page, 'MasterData/Edit');
  await expect(frame.getByText('Approved By: Unapproved')).toBeVisible({ timeout: 10_000 });
  await mdm.fillFieldByCaption(frame, 'Brand Name', 'PDF Brand v1 UNAPPROVED');
  await mdm.saveRecord(page, frame);
  await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  await mdm.backToGrid(page, frame);
  writeState({ item2 });
  log(`I2 done: ${item2}`);
});

