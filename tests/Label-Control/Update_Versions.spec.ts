// Row-level "Update Versions" action (LC_Update_Versions) on a Label Control record. No BarTender
// needed -- reuses the existing approved 'A1SuperTemplate' fixture.
//
// Two records, set up through the UI:
//   A. an item with NO Master Data record -- the dialog shows the record's current versions, the
//      Master Data Version select is disabled, and Submit is unclickable (nothing to change);
//   B. an item with an UNAPPROVED Master Data record created BEFORE its control number is assigned --
//      Assign Control Number does not link an unapproved MD record (Master Data Version stays "None"),
//      but the dialog offers "0 Unapproved"; choosing it and submitting links it.
//
// Module-specific findings (full detail in robar-module-reference.md, Row Actions):
// - The dialog is a partial loaded into #editDialogDiv with selects #dvItemVersion,
//   #drpTemplateVersion, #drpMasterDataVersion and a jQuery UI button #btnUpdate (labelled "Submit").
// - The page adds `ui-state-disabled` to #btnUpdate when the dialog opens, so Submit stays unclickable
//   until a version actually changes (a click is intercepted by .ui-dialog-buttonset).
// - Opening the dialog shows each record's CURRENT versions as the selected values.
// - #drpMasterDataVersion exists ONLY when the record has Master Data; with none, the dialog renders
//   an id-less disabled <select> inside #dvMDVersion instead (so a locator on the id never resolves).
// - Submit POSTs UpdateLabelControl; an empty ErrorMessage means success and the page reloads.
// Confirmed reliable: 3 consecutive clean runs, ~3.2 minutes each, entirely headless.
// Not covered: changing the Template Version or Item Version (needs a template/item with a second
// approved version -- a template version requires driving BarTender through Save As New > New Version).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as mdm from '../support/master-data';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';
const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

async function createApprovedItem(page: Page, itemNumber: string): Promise<void> {
  await openMenuItem(page, 'Campaign Manager');
  const cmFrame = await findFrame(page, 'campaignmanager');
  await page.waitForTimeout(1000);

  await cmFrame.click('#btnCreateNew');
  await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible', timeout: 10_000 });
  await cmFrame.fill('#txtItemNumber', itemNumber);
  await cmFrame.selectOption('#ddlLabelType', LABEL_TYPE);
  await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');

  const editFrame = await findFrame(page, 'items/edit');
  await editFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1000);

  await editFrame.selectOption('select[name="txtTemplateName"]', TEMPLATE);
  await editFrame.fill('input[name="txtDescription"]', 'Playwright Update Versions test item');
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
  await approveDialog.locator('#sigComments').fill('Approved by Playwright Update Versions test', { timeout: 5000 });
  const [approveResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
    editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  const approveBody = await approveResponse.json();
  expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

  await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function createUnapprovedMasterData(page: Page, itemNumber: string): Promise<void> {
  await openMenuItem(page, 'Master Data');
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);
  await mdm.selectSchema(mdmFrame, 'RobarMasterData');
  await mdm.openNewRecordAction(mdmFrame);
  await mdm.submitNewItemDialog(page, mdmFrame, itemNumber, 'Playwright Update Versions master data');
  await expect(mdmFrame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 15_000 });
  await mdm.setItemDescription(mdmFrame, 'Playwright Update Versions master data');
  await mdm.selectDropdownFieldByCaption(mdmFrame, 'Labeler Duns Number', 'Innovatum');
  await mdm.fillFieldByCaption(mdmFrame, 'Primary DI Number', '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await mdm.fillFieldByCaption(mdmFrame, 'Brand Name', 'Update Versions Test Brand');
  await mdm.saveRecord(page, mdmFrame);
  await expect(mdmFrame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

async function openLabelControlAndQuery(page: Page, itemNumber: string): Promise<Frame> {
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
  await frame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
  await frame.locator("input[name$='Value']").first().fill(itemNumber);
  await frame.click('#btnRetrieveData');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return frame;
}

async function assignLcn(page: Page, itemNumber: string): Promise<string> {
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
  await jobFrame.fill('#txtJobDescription', 'Playwright Update Versions test -- Assign Control Number', { timeout: 5000 });
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  await jobFrame.selectOption('#sigReason', { index: 1 }, { timeout: 5000 });
  await jobFrame.fill('#sigComments', 'Assigned by Playwright test', { timeout: 5000 });
  const [submitResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
    jobFrame.click('#submitBtn', { timeout: 5000 }),
  ]);
  const submitBody = await submitResponse.json();
  expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

  let lcn: string | undefined;
  for (let attempt = 0; attempt < 10 && !lcn; attempt++) {
    await page.waitForTimeout(2000);
    const f2 = await openLabelControlAndQuery(page, itemNumber);
    const text = await f2.locator('#grdLabelControl tr').filter({ hasText: itemNumber }).innerText().catch(() => '');
    lcn = text.match(/LCN\d+/)?.[0];
  }
  expect(lcn, `Item ${itemNumber} never showed an assigned LCN`).toBeTruthy();
  return lcn!;
}

/** Opens the row-level Update Versions dialog for the (single) matching row and waits for it to populate. */
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

/** Reads a select's options / selected text / disabled flag in-page. Deliberately not
 * `locator('option:checked').textContent()`: a select with no options (the Master Data Version
 * select when the record has no MD link) has no checked option, and a locator action with no
 * explicit timeout then waits for the WHOLE test timeout instead of failing. */
async function readSelect(frame: Frame, sel: string): Promise<{ options: string[]; selected: string; disabled: boolean }> {
  return frame.locator(sel).evaluate((el) => {
    // #dvItemVersion is a wrapper around the <select>; the other two ids sit on the select itself.
    const s = (el.tagName === 'SELECT' ? el : el.querySelector('select')) as HTMLSelectElement;
    return {
      options: Array.from(s.options).map((o) => (o.textContent ?? '').trim()),
      selected: (s.selectedOptions[0]?.textContent ?? '').trim(),
      disabled: s.disabled,
    };
  }, undefined, { timeout: 5000 });
}

test('Update Versions: shows current versions, blocks Submit until a change, and links an unapproved Master Data version', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);

  const stamp = Date.now().toString().slice(-6);
  const itemNoMd = 'MBLCUV' + stamp + 'A';
  const itemWithMd = 'MBLCUV' + stamp + 'B';

  await test.step('set up two approved items with control numbers (the second with an unapproved Master Data record)', async () => {
    await createApprovedItem(page, itemNoMd);
    await createApprovedItem(page, itemWithMd);
    await createUnapprovedMasterData(page, itemWithMd);
    await assignLcn(page, itemNoMd);
    await assignLcn(page, itemWithMd);
  });

  await test.step('A. record with no Master Data: current versions shown, MD select disabled, Submit unclickable', async () => {
    const frame = await openLabelControlAndQuery(page, itemNoMd);
    await openUpdateVersionsDialog(page, frame, itemNoMd);

    const item = await readSelect(frame, '#dvItemVersion');
    const template = await readSelect(frame, '#drpTemplateVersion');
    expect(item.selected, `item version: ${JSON.stringify(item)}`).toBe('0');
    expect(template.options.length, `template versions: ${JSON.stringify(template)}`).toBeGreaterThan(0);
    expect(template.selected, 'a template version should be selected').not.toBe('');
    // Source (EditLabelControlDialog.cshtml): #drpMasterDataVersion is only rendered when the record has
    // Master Data (Model.MDExists); otherwise the view emits a plain id-less <select disabled>.
    await expect(frame.locator('#drpMasterDataVersion')).toHaveCount(0);
    const mdPlaceholder = frame.locator('#dvMDVersion select');
    await expect(mdPlaceholder).toBeDisabled({ timeout: 5000 });
    await expect(frame.locator('#btnUpdate')).toHaveClass(/ui-state-disabled/);

    // Cancel closes it. The page's close handler only destroys the jQuery UI dialog and leaves the
    // #editDialogDiv element in the DOM (hidden), so assert on visibility, not on the element's absence.
    await frame.locator('.ui-dialog-buttonpane button:has-text("Cancel")').click({ timeout: 5000 });
    await expect(frame.locator('#drpTemplateVersion')).toBeHidden({ timeout: 5000 });
  });

  await test.step('B. record with an unapproved Master Data record: starts on None, offers 0 Unapproved, Submit links it', async () => {
    let frame = await openLabelControlAndQuery(page, itemWithMd);
    await openUpdateVersionsDialog(page, frame, itemWithMd);

    const before = await readSelect(frame, '#drpMasterDataVersion');
    expect(before.options, `MD options: ${JSON.stringify(before)}`).toContain('None');
    expect(before.options.some((o) => o.startsWith('0')), `MD options: ${JSON.stringify(before)}`).toBe(true);
    expect(before.selected, 'Assign Control Number should not link an unapproved MD record').toBe('None');
    await expect(frame.locator('#btnUpdate')).toHaveClass(/ui-state-disabled/);

    const target = before.options.find((o) => o.startsWith('0'))!;
    await frame.locator('#drpMasterDataVersion').selectOption({ label: target }, { timeout: 5000 });
    await page.waitForTimeout(500);
    await expect(frame.locator('#btnUpdate'), 'Submit should enable once a version changes').not.toHaveClass(/ui-state-disabled/);

    const [updateResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('UpdateLabelControl'), { timeout: 15_000 }),
      frame.click('#btnUpdate', { timeout: 5000 }),
    ]);
    const updateBody = await updateResponse.json();
    expect(updateBody.ErrorMessage ?? '', `UpdateLabelControl reported: ${JSON.stringify(updateBody)}`).toBe('');
    await page.waitForTimeout(3000);

    frame = await openLabelControlAndQuery(page, itemWithMd);
    await openUpdateVersionsDialog(page, frame, itemWithMd);
    const after = await readSelect(frame, '#drpMasterDataVersion');
    expect(after.selected.startsWith('0'), `MD version should now be linked: ${JSON.stringify(after)}`).toBe(true);
    await page.keyboard.press('Escape');
  });
});
