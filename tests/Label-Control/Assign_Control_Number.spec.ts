// Creates a fresh Campaign Manager item (no BarTender/Sentinel involved -- reuses the existing
// approved 'A1SuperTemplate' fixture, same pattern as Create_Approved_Item.spec.ts) and assigns
// it a Label Control Number via Label Control's "Assign Control Number" bulk action. This action
// IS the Label Control row's own creation mechanism, not a second step after one exists -- see
// robar-module-reference.md's Label Control section ("Live exploration findings") for the full
// module reference this was built against.
//
// Confirmed reliable: 3 consecutive clean runs, ~52-55s each, entirely headless.
//
// Infrastructure gotchas fixed getting this reliable (full detail in robar-module-reference.md):
// 1. The WebMenu's main-menu module buttons live on the "Home" tab panel and are hidden (present
//    but not visible) while another module's tab is active -- close the previous tab before
//    opening a different module, same as the combined Template+Item spec does between its parts.
// 2. This module's filter dropdowns (#drpApproved/#drpAttachments/#drpLabelMaster) are a genuine,
//    resettable <select> -- but ALSO its Column/Operator/Value filter ROWS are saved server-side
//    as this account's own "default" filter set and persist across page loads *and* across
//    separate runs. A stale blank row left over from an earlier run silently ANDs against a new
//    query and zeroes out every result. Always click #btnReset before adding a fresh filter row,
//    not just reset the scope dropdowns (feedback_filter_scope_reset.md).
// 3. No filter row exists by default -- "Add Filter" has to be clicked to create one, and its
//    click handler is bound only to the inner text <span>, not the outer button container or its
//    sibling icon <span> (both render identical "Add Filter" text).
// 4. This module's own JS crash bug (labelControlField.caption is not a function) needs
//    networkidle + an explicit ~3s settle wait before touching the filter dropdowns/row.
// 5. Assign Control Number is an async job -- Job Detail reports "Submitted"/0% immediately, so
//    re-query the Label Control grid afterward (with a few retries) to confirm the real assigned
//    LCN rather than trusting the Job Detail page alone.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('create a fresh item and assign it a Label Control Number', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLC' + Date.now().toString().slice(-8);

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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Label Control test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Label Control test');

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  });

  async function openLabelControlAndQuery(): Promise<Frame> {
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

    await frame.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
    await frame.locator("select[name$='Operator']").first().selectOption('ExactlyMatches');
    await frame.locator("input[name$='Value']").first().fill(itemNumber);

    await frame.click('#btnRetrieveData');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    return frame;
  }

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
    expect(previewText, 'No "Starting Control Number" preview shown before submit').toContain('Starting Control Number');
    const previewMatch = previewText.match(/Starting Control Number:\s*(LCN\d+)/);
    const expectedLcn = previewMatch?.[1];
    expect(expectedLcn, `Could not parse an LCN out of the preview text: ${previewText}`).toBeTruthy();

    await jobFrame.fill('#txtJobDescription', 'Playwright Label Control test -- Assign Control Number');
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

    const detailFrame = await findFrame(page, 'MassAssign/JobDetail');
    await detailFrame.waitForLoadState('networkidle').catch(() => {});

    // Async job -- re-query the Label Control grid to confirm the real assigned LCN, polling a
    // few times since the job isn't guaranteed complete the instant Job Detail first renders.
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
  });
});
