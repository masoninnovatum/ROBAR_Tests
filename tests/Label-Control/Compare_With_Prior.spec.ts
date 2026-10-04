// Creates two fresh Campaign Manager items (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns each a Label Control Number, then runs the Compare With
// Prior bulk action on both. Neither item has a prior LCN, so each record is expected to fail
// with a clean per-record error -- the simplest path, needing no pre-existing prior data.
//
// Confirmed reliable: 3 consecutive clean runs, ~2.6 minutes each, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Despite the similar name, this is NOT Redline Compare's synchronous dialog flow. It is a
//   standard async Job Submission (#actRedlineCompareWithPrior), but served by the same
//   Innovatum.Pages.LabelControl.Redline.MVC project: Redline/JobSubmission -> Redline/SubmitJob
//   -> Redline/JobDetail. Page header reads "Job Submission - Compare With Prior".
// - Real ids: #allowTempLabelMaster ("Allow use of Temporary Master"), #saveToFolder ("Save
//   Redline to Folder", reveals #saveSubfolder and #doNotSaveToDb), #txtJobDescription, and the
//   shared signature ids (#sigUser/#sigPassword/#sigReason/#sigComments).
// - The Submit control is a plain <button> with NO id (data-bind="click: submitClick, disabled:
//   !viewModel.isValid()") -- a third pattern, after #submitBtn and #SubmitButton. Target it by
//   its data-bind. It stays disabled until description and signature are filled.
// - Failed records report job Status "CompletedWithErrors" with per-record message "Could not
//   complete comparison. Prior LCN record not found." (matches the formal script).
// - Test-data gotcha: the Label Control grid pages at 10 rows. Filtering on a bare "Contains
//   MBLCRC" prefix eventually matched more than 10 leftover items from earlier runs and pushed
//   this run's items onto page 2, so rows "vanished". Filter on a per-run stamp instead.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('Compare With Prior reports a clean per-record error for items with no prior LCN', async ({ page }) => {
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
  await test.step('Compare With Prior with both records selected', async () => {
    const frame = await openLabelControlAndQuery();

    const rowA = frame.locator('#grdLabelControl tr').filter({ hasText: itemA });
    const rowB = frame.locator('#grdLabelControl tr').filter({ hasText: itemB });
    await expect(rowA).toHaveCount(1, { timeout: 10_000 });
    await expect(rowB).toHaveCount(1, { timeout: 10_000 });
    await rowA.locator('input[type="checkbox"]').first().check();
    // Settle wait: checking two rows back-to-back can race the grid's selection-tracking
    // observable (same race confirmed in Redline Compare).
    await page.waitForTimeout(500);
    await rowB.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actRedlineCompareWithPrior', { force: true });

    const jobFrame = await findFrame(page, 'Redline/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await expect(jobFrame.locator('body')).toContainText('Selected Records: 2');

    await jobFrame.fill('#txtJobDescription', 'Playwright Compare With Prior test');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Compared by Playwright test');

    // The Submit button has no id; it is disabled until the form is valid.
    const submitBtn = jobFrame.locator('button[data-bind*="submitClick"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('Redline/SubmitJob'), { timeout: 15_000 }),
      submitBtn.click({ timeout: 5000 }),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    let detailFrame = await findFrame(page, 'Redline/JobDetail');
    await detailFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});

    let detailText = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      detailText = await detailFrame.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      if (/Status:\s*(Completed|Failed)/.test(detailText) && !/Page\s+of\s+0/.test(detailText)) break;
      await page.waitForTimeout(1500);
      detailFrame = await findFrame(page, 'Redline/JobDetail');
    }
    expect(detailText, `Job Detail never reported a final status: ${detailText}`).toMatch(/Status:\s*CompletedWithErrors/);
    for (const [lcn, item] of [[lcnA, itemA], [lcnB, itemB]]) {
      expect(detailText, `Row for ${item} missing`).toMatch(new RegExp(`${lcn}\\s+${item}`));
    }
    const errorCount = (detailText.match(/Could not complete comparison\. Prior LCN record not found\./g) ?? []).length;
    expect(errorCount, `Expected both records to report "Prior LCN record not found": ${detailText}`).toBe(2);
  });
});
