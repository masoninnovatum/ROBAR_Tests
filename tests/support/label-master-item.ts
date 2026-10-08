// Fixture item WITH a Label Master (live 2026-10-06; flow from Label-Control/Recreate_Master.spec.ts): creates an approved Campaign Manager item on template A1SuperTemplate (Carton Label), assigns
// a Label Control Number and runs Label Control > Bulk Actions > Recreate Master. Items cannot be deleted, so the item number is persisted in test-data/label-master-item.json and REUSED on later runs
// as long as it still shows under "With Label Master" in Label Control.

import { expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from './robar';

const LABEL_TYPE = 'Carton Label';
const DEFAULT_TEMPLATE = 'A1SuperTemplate';

async function openLabelControlAndQuery(page: Page, itemNumber: string, labelMaster: string): Promise<Frame> {
  await openMenuItem(page, 'Label Control');
  let frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await frame.click('#btnReset');
  await page.waitForTimeout(1500);
  frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(3000);
  await frame.locator('#drpApproved').selectOption({ label: 'All (LCN Status)' });
  await frame.locator('#drpAttachments').selectOption({ label: 'Any (Attachments)' });
  await frame.locator('#drpLabelMaster').selectOption({ label: labelMaster });
  await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
  await page.waitForTimeout(500);
  await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
  await frame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
  await frame.locator("input[name$='Value']").first().fill(itemNumber);
  await frame.click('#btnRetrieveData');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return frame;
}

const closeLc = (page: Page) => page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});

/** Returns the item number of an approved item with an assigned LCN AND a Label Master (creating it the first time). */
export interface FixtureOptions {
  /** template of the item (default A1SuperTemplate; must be an approved Carton Label template) */
  template?: string;
  /** json file name under test-data (default label-master-item.json) */
  store?: string;
  /** false = stop after the LCN is assigned (no Recreate Master) */
  master?: boolean;
  prefix?: string;
}

export async function ensureItemWithMaster(page: Page, opts: FixtureOptions = {}): Promise<string> {
  const TEMPLATE = opts.template ?? DEFAULT_TEMPLATE;
  const STORE = path.join(__dirname, '..', '..', 'test-data', opts.store ?? 'label-master-item.json');
  const withMaster = opts.master !== false;
  if (fs.existsSync(STORE)) {
    const saved = JSON.parse(fs.readFileSync(STORE, 'utf8')).item as string;
    const f = await openLabelControlAndQuery(page, saved, withMaster ? 'With Label Master' : 'Any (Label Masters)');
    const found = (await f.locator('#grdLabelControl tr').filter({ hasText: saved }).count()) > 0;
    await closeLc(page);
    if (found) return saved;
  }
  const itemNumber = (opts.prefix ?? 'MBMDPM') + Date.now().toString().slice(-7);

  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000);
  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', LABEL_TYPE);
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');
  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await editFrame.selectOption('select[name="txtTemplateName"]', TEMPLATE);
  await editFrame.fill('input[name="txtDescription"]', 'Playwright item with a Label Master (Multi Document Printing)');
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
  await approveDialog.locator('#sigUser').fill(USERNAME);
  await approveDialog.locator('#sigPassword').fill(PASSWORD);
  await approveDialog.locator('#sigComments').fill('Approved by Playwright (label master fixture)');
  const [approveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
    editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  expect((await approveResponse.json()).Success).toBe(true);
  await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
  await page.waitForTimeout(500);

  // assign LCN
  let frame = await openLabelControlAndQuery(page, itemNumber, 'Any (Label Masters)');
  const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
  await expect(row).toHaveCount(1, { timeout: 10_000 });
  await row.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);
  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  await frame.click('#actAssignLabelControl', { force: true });
  const assign = await findFrame(page, 'MassAssign/JobSubmission');
  await assign.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1000);
  await assign.fill('#txtJobDescription', 'Playwright label master fixture -- Assign Control Number');
  await assign.fill('#sigUser', USERNAME);
  await assign.fill('#sigPassword', PASSWORD);
  await assign.selectOption('#sigReason', { label: 'General' });
  await assign.fill('#sigComments', 'Assigned by Playwright');
  const [assignResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
    assign.click('#submitBtn'),
  ]);
  expect((await assignResponse.json()).Success).toBe(true);
  await closeLc(page);
  let lcn: string | undefined;
  for (let i = 0; i < 10 && !lcn; i++) {
    await page.waitForTimeout(2000);
    frame = await openLabelControlAndQuery(page, itemNumber, 'Any (Label Masters)');
    lcn = (await frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber }).innerText().catch(() => '')).match(/LCN\d+/)?.[0];
    if (!lcn) await closeLc(page);
  }
  expect(lcn, `item ${itemNumber} never got an LCN`).toBeTruthy();
  await closeLc(page);

  if (!withMaster) {
    fs.writeFileSync(STORE, JSON.stringify({ item: itemNumber, lcn, template: TEMPLATE, labelType: LABEL_TYPE, created: new Date().toISOString() }, null, 2));
    return itemNumber;
  }
  // Recreate Master
  frame =await openLabelControlAndQuery(page, itemNumber, 'Without Label Master');
  const row2 = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
  await expect(row2).toHaveCount(1, { timeout: 10_000 });
  await row2.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);
  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  await frame.click('#actRecreateMaster', { force: true });
  const job = await findFrame(page, 'RecreateMaster/JobSubmission');
  await job.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  await job.fill('#txtJobDescription', 'Playwright label master fixture -- Recreate Master');
  await job.fill('#sigUser', USERNAME);
  await job.fill('#sigPassword', PASSWORD);
  await job.selectOption('#sigReason', { label: 'DataLoad' }, { timeout: 5000 });
  await job.fill('#sigComments', 'Recreated by Playwright');
  await page.waitForTimeout(500);
  const [recreateResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('RecreateMaster/SubmitJob'), { timeout: 15_000 }),
    job.click('#btnSubmit', { timeout: 5000 }),
  ]);
  expect((await recreateResponse.json()).Success).toBe(true);
  let detail = await findFrame(page, 'RecreateMaster/JobDetail');
  let text = '';
  for (let i = 0; i < 60; i++) {
    text = await detail.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    if (/Status:?\s*(Completed|Failed)/.test(text) && !/Page\s+of\s+0/.test(text)) break;
    await page.waitForTimeout(2000);
    detail = await findFrame(page, 'RecreateMaster/JobDetail');
  }
  expect(text, `Recreate Master did not complete: ${text}`).toMatch(/Status:?\s*Completed/);
  await closeLc(page);

  const check = await openLabelControlAndQuery(page, itemNumber, 'With Label Master');
  await expect(check.locator('#grdLabelControl tr').filter({ hasText: itemNumber })).toHaveCount(1, { timeout: 10_000 });
  await closeLc(page);
  fs.writeFileSync(STORE, JSON.stringify({ item: itemNumber, lcn, template: TEMPLATE, labelType: LABEL_TYPE, created: new Date().toISOString() }, null, 2));
  return itemNumber;
}
