// Creates a fresh Campaign Manager item (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns it a Label Control Number (Assign_Control_Number.spec.ts's
// own proven flow), then uses Manage Production Availability to actually RELEASE that brand-new,
// currently-unreleased LCN -- a genuine success path, confirmed via the module's own "Unreleased
// Only" filter before and after (not just the Job Detail page's own success message).
//
// Confirmed reliable: 3 consecutive clean runs, ~2.0-2.1 minutes each, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - The "Field To Update" dropdown defaults to "Release", so it never needs to be touched for
//   this flow. Its "New Value" control for the Release field specifically is a checkbox literally
//   named `#AllowPrint` (data-bind="checked: allowPrintValue") -- not a generic "new value" input,
//   a field-specific one (Effective Begin/End presumably swap in a date picker instead, not
//   explored here).
// - Like every other bulk action in this module, this is an async job -- Job Detail reports a
//   blank Status / "Page of 0" immediately, so poll until Status is actually populated before
//   trusting it.
// - The cleanest way to confirm a release actually took effect isn't the per-record Job Detail
//   message alone -- it's re-querying with the "Unreleased Only" LCN Status filter before and
//   after: present before, gone after.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('release a freshly-assigned Label Control Number via Manage Production Availability', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCPA' + Date.now().toString().slice(-7);

  await test.step('create and approve a Campaign Manager item (no BarTender needed)', async () => {
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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Manage Production Availability test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Manage Production Availability test');

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  });

  async function openLabelControlAndQuery(lcnStatusLabel: string = 'All (LCN Status)'): Promise<Frame> {
    await openMenuItem(page, 'Label Control');
    let frame = await findFrame(page, 'LabelControl/Management');
    await frame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    await frame.click('#btnReset');
    await page.waitForTimeout(1500);
    frame = await findFrame(page, 'LabelControl/Management');
    await frame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(3000);

    await frame.locator('#drpApproved').selectOption({ label: lcnStatusLabel });
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

  let expectedLcn: string | undefined;

  await test.step('assign a Label Control Number to the new item', async () => {
    const frame = await openLabelControlAndQuery();

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

    const previewText = await jobFrame.locator('body').innerText();
    const previewMatch = previewText.match(/Starting Control Number:\s*(LCN\d+)/);
    expectedLcn = previewMatch?.[1];
    expect(expectedLcn, `Could not parse an LCN out of the preview text: ${previewText}`).toBeTruthy();

    await jobFrame.fill('#txtJobDescription', 'Playwright Manage Production Availability test -- Assign Control Number');
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
      const frame2 = await openLabelControlAndQuery();
      const row2 = frame2.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
      const text2 = await row2.innerText().catch(() => '');
      const match2 = text2.match(/LCN\d+/);
      if (match2) {
        finalLcn = match2[0];
      } else {
        await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
      }
    }
    expect(finalLcn, `Item ${itemNumber} never showed an assigned LCN in the grid`).toBe(expectedLcn);
    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
  });

  await test.step('sanity check: item shows under Unreleased Only before the job runs', async () => {
    const frame = await openLabelControlAndQuery('Unreleased Only');
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, 'Item should show under Unreleased Only before Manage Production Availability runs').toHaveCount(1, { timeout: 10_000 });
    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
  });

  await test.step('Manage Production Availability: release the new LCN', async () => {
    const frame = await openLabelControlAndQuery();

    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actManageProduct', { force: true });

    const jobFrame = await findFrame(page, 'ManageProduction/JobSubmission');
    await jobFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    // Field To Update already defaults to "Release"; its New Value control for that field is the
    // "AllowPrint" checkbox, not a generic input.
    await jobFrame.locator('#AllowPrint').check();

    await jobFrame.fill('#txtJobDescription', 'Playwright Manage Production Availability test -- release this LCN');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Released by Playwright test');

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('ManageProduction/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn'),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    // Async job -- Job Detail reports a blank Status / "Page of 0" immediately, poll until real.
    let detailFrame = await findFrame(page, 'ManageProduction/JobDetail');
    await detailFrame.waitForLoadState('networkidle').catch(() => {});

    let detailText = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      detailText = await detailFrame.locator('body').innerText().catch(() => '');
      if (/Status:\s*(Completed|Failed)/.test(detailText) && !/Page\s+of\s+0/.test(detailText)) break;
      await page.waitForTimeout(1500);
      detailFrame = await findFrame(page, 'ManageProduction/JobDetail');
    }
    expect(detailText, `Job Detail never showed a completed status: ${detailText}`).toMatch(/Status:\s*Completed/);
    expect(detailText, `Per-record status was not "Updated": ${detailText}`).toContain('Updated');

    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
  });

  await test.step('confirm: item no longer shows under Unreleased Only after the job completes', async () => {
    let stillUnreleased = true;
    for (let attempt = 0; attempt < 10 && stillUnreleased; attempt++) {
      await page.waitForTimeout(2000);
      const frame = await openLabelControlAndQuery('Unreleased Only');
      const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
      const count = await row.count();
      stillUnreleased = count > 0;
      if (stillUnreleased) {
        await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
      }
    }
    expect(stillUnreleased, 'Item still shows under Unreleased Only after Manage Production Availability should have released it').toBe(false);
  });
});
