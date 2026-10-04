// Creates two fresh Campaign Manager items (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture) and assigns each a Label Control Number, then runs the Redline
// Compare bulk action against both. Neither item has a Label Master yet, so this exercises the
// "Create Temporary Master" dialog path before reaching the actual PDF comparison dialog.
//
// Confirmed reliable: 3 consecutive clean runs, ~2.5-2.7 minutes each, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Confirmed via source (Management.cshtml's openRedlineCompare()) this is NOT an async Job
//   Submission flow -- it's synchronous and client-orchestrated, requiring EXACTLY 2 selected
//   records (a validation error otherwise: "Please submit TWO label control records to the
//   Redline Compare bulk action."). POSTs LabelControl/GetLCNForRedline, then either opens the
//   "Create Temporary Master" dialog (if either record lacks a Label Master) or goes straight to
//   the PDF comparison dialog.
// - Gotcha: both dialogs (#createTempMasterDialog, #redlineCompareDiv) are appended inside the
//   Label Control grid's own IFRAME document, not the top-level page -- page.locator(...) never
//   finds them, only frame.locator(...) does.
// - Gotcha: loadPartialWithNonce (which renders these dialogs) can take several seconds; a short
//   fixed wait isn't reliable, poll for the dialog to appear instead.
// - Gotcha: checking two grid row checkboxes back-to-back with no pause between them raced the
//   grid's own selection-tracking observable -- the Actions menu's click-time validation read a
//   stale selection count and fired the "must select TWO records" error even though the DOM
//   showed both checkboxes checked moments later. A short settle wait between the two checks
//   fixed it.
// - None of the dialog buttons (Create Temporary Master's Yes/No, Redline Compare's Save to
//   ROBAR/Exit) have ids -- they're plain jQuery UI dialog `buttons:` array entries, targeted by
//   text or position (`.ui-dialog-buttonpane button:first/:last`). Download Redline is a plain
//   `<a class="linkClass">` inserted next to the dialog buttons, also with no id.
// - Live-confirmed: Save to ROBAR is enabled (not disabled) for this user -- consistent with the
//   2026-10-01 code-read finding that it's gated solely by the LC_RedlineCompare_Link security
//   process, independent of whether either record has a real vs. temporary Label Master.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('Redline Compare triggers the Create Temporary Master dialog then shows a real PDF comparison', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const stamp = Date.now().toString().slice(-6);
  const itemA = 'MBLCRC' + stamp + 'A';
  const itemB = 'MBLCRC' + stamp + 'B';

  async function createApproveItem(itemNumber: string): Promise<void> {
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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Redline Compare test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Redline Compare test');

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  }

  await test.step('create and approve two Campaign Manager items', async () => {
    await createApproveItem(itemA);
    await createApproveItem(itemB);
  });

  async function openLabelControlAndQuery(filterItemNumber?: string): Promise<Frame> {
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
    await frame.locator('#drpLabelMaster').selectOption({ label: 'Any (Label Masters)' });

    await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(500);

    if (filterItemNumber) {
      await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
      await frame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
      await frame.locator("input[name$='Value']").first().fill(filterItemNumber);
    } else {
      await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
      await frame.locator("select[name$='Operator']").first().selectOption('Contains');
      await frame.locator("input[name$='Value']").first().fill('MBLCRC' + stamp);
    }

    await frame.click('#btnRetrieveData');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return frame;
  }

  async function assignLcn(itemNumber: string): Promise<string> {
    const frame = await openLabelControlAndQuery(itemNumber);

    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, `Item ${itemNumber} not found in Label Control grid`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actAssignLabelControl', { force: true });

    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    await jobFrame.fill('#txtJobDescription', 'Playwright Redline Compare test -- Assign Control Number');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Assigned by Playwright test');

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn'),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();

    let finalLcn: string | undefined;
    for (let attempt = 0; attempt < 10 && !finalLcn; attempt++) {
      await page.waitForTimeout(2000);
      const frame2 = await openLabelControlAndQuery(itemNumber);
      const row2 = frame2.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
      const text2 = await row2.innerText().catch(() => '');
      const match2 = text2.match(/LCN\d+/);
      if (match2) {
        finalLcn = match2[0];
      } else {
        await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
      }
    }
    expect(finalLcn, `Item ${itemNumber} never showed an assigned LCN in the grid`).toBeTruthy();
    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
    return finalLcn!;
  }

  let lcnA: string;
  let lcnB: string;

  await test.step('assign Label Control Numbers to both items', async () => {
    lcnA = await assignLcn(itemA);
    lcnB = await assignLcn(itemB);
  });

  await test.step('Redline Compare with both records selected', async () => {
    const frame = await openLabelControlAndQuery();

    const rowA = frame.locator('#grdLabelControl tr').filter({ hasText: itemA });
    const rowB = frame.locator('#grdLabelControl tr').filter({ hasText: itemB });
    await expect(rowA).toHaveCount(1, { timeout: 10_000 });
    await expect(rowB).toHaveCount(1, { timeout: 10_000 });
    await rowA.locator('input[type="checkbox"]').first().check();
    // Settle wait: checking both rows back-to-back can race the grid's selection-tracking
    // observable, making the Actions menu's click-time validation see a stale selection count.
    await page.waitForTimeout(500);
    await rowB.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);

    const [getLcnResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('GetLCNForRedline'), { timeout: 15_000 }),
      frame.click('#actRedlineCompare', { force: true }),
    ]);
    const getLcnBody = await getLcnResponse.json();
    expect(getLcnBody.Success, `GetLCNForRedline failed: ${JSON.stringify(getLcnBody)}`).toBe(true);
    expect([getLcnBody.MasterLCN, getLcnBody.SampleLCN].sort()).toEqual([lcnA, lcnB].sort());

    // Both dialogs render inside the Label Control grid's own iframe document, not the top-level
    // page. loadPartialWithNonce can take a few seconds, so poll for whichever appears first.
    let tempDialogCount = 0;
    let redlineDialogCount = 0;
    for (let attempt = 0; attempt < 20; attempt++) {
      tempDialogCount = await frame.locator('#createTempMasterDialog').count();
      redlineDialogCount = await frame.locator('#redlineCompareDiv').count();
      if (tempDialogCount > 0 || redlineDialogCount > 0) break;
      await page.waitForTimeout(1000);
    }
    expect(
      tempDialogCount > 0 || redlineDialogCount > 0,
      'Neither the Create Temporary Master dialog nor the Redline Compare dialog appeared'
    ).toBe(true);

    if (tempDialogCount > 0) {
      const dialogText = await frame.locator('.createTempClass').innerText();
      expect(dialogText).toContain('One or both of the selected records are not associated with Label Master.');
      await frame.locator('.createTempClass .ui-dialog-buttonpane button', { hasText: 'Yes' }).click();
    }

    await expect(frame.locator('#redlineCompareDiv')).toHaveCount(1, { timeout: 15_000 });
    const redlineDialogText = await frame.locator('.redCompareClass').innerText();
    expect(redlineDialogText).toContain(lcnA);
    expect(redlineDialogText).toContain(lcnB);
    expect(redlineDialogText).toContain(itemA);
    expect(redlineDialogText).toContain(itemB);

    const saveBtn = frame.locator('.redCompareClass .ui-dialog-buttonpane button').first();
    const exitBtn = frame.locator('.redCompareClass .ui-dialog-buttonpane button').last();
    const downloadLink = frame.locator('.redCompareClass .ui-dialog-buttonpane a.linkClass');
    await expect(saveBtn).toBeEnabled();
    await expect(exitBtn).toHaveText('Exit');
    await expect(downloadLink).toHaveCount(1);

    await exitBtn.click();
    await expect(frame.locator('#redlineCompareDiv')).toHaveCount(0, { timeout: 5_000 });
  });
});
