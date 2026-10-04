// Creates a fresh Campaign Manager item (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns it a Label Control Number, then runs Link to Label Master
// on it with both checkboxes left unticked -- the simplest path, since a brand-new item has no
// Label Master at all yet, so the job is expected to fail per-record with a known error.
//
// Confirmed reliable: 3 consecutive clean runs, ~1.7 minutes each, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Real route: LinkToLabelMaster/JobSubmission -> LinkToLabelMaster/SubmitJob -> JobDetail
//   (project Innovatum.Pages.LabelControl.LinkToLabelMaster.MVC). Standard async Job Submission
//   pattern, same shared signature-component ids as every other action here.
// - Unlike Mass Update Versions, this page's Submit button genuinely IS `#submitBtn`.
// - The two checkboxes ("Update Existing Label Master Link" / "Use Latest If No Exact Match")
//   have NO id at all -- only Knockout data-bind attributes (`checked: updateExistingLabelMaster`
//   / `checked: useLatestNoExactMatch`). Target them via `input[data-bind*="..."]`.
// - A failed per-record link reports job Status "CompletedWithErrors" (not "Completed" -- a new
//   status value not seen on the other actions tested so far, which only ever showed "Completed").
// - Error message matches the formal script / prior UAT review verbatim: "Could not link to
//   master. Matching or latest label master record not found."

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('Link to Label Master reports a clean "not found" error for a brand-new item with no master', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCLM' + Date.now().toString().slice(-7);

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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Link to Label Master test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Link to Label Master test');

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

    await jobFrame.fill('#txtJobDescription', 'Playwright Link to Label Master test -- Assign Control Number');
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
    expect(finalLcn, `Item ${itemNumber} never showed an assigned LCN in the grid`).toBeTruthy();
    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click();
  });

  await test.step('Link to Label Master: both checkboxes left unticked, expect a clean per-record error', async () => {
    const frame = await openLabelControlAndQuery();

    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actLinkToLabelMaster', { force: true });

    const jobFrame = await findFrame(page, 'LinkToLabelMaster/JobSubmission');
    await jobFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    await jobFrame.fill('#txtJobDescription', 'Playwright Link to Label Master test -- no match expected');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Linked by Playwright test');

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('LinkToLabelMaster/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn'),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    let detailFrame = await findFrame(page, 'LinkToLabelMaster/JobDetail');
    await detailFrame.waitForLoadState('networkidle').catch(() => {});

    let detailText = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      detailText = await detailFrame.locator('body').innerText().catch(() => '');
      if (/Status:\s*(Completed|Failed)/.test(detailText) && !/Page\s+of\s+0/.test(detailText)) break;
      await page.waitForTimeout(1500);
      detailFrame = await findFrame(page, 'LinkToLabelMaster/JobDetail');
    }
    expect(detailText, `Job Detail never reported a final status: ${detailText}`).toMatch(/Status:\s*CompletedWithErrors/);
    expect(detailText, `Per-record error message did not match: ${detailText}`).toContain(
      'Could not link to master. Matching or latest label master record not found.'
    );
  });
});
