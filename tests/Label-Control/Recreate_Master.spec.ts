// Creates a fresh Campaign Manager item (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns it a Label Control Number, then runs Recreate Master on it
// and confirms the item moves from "Without Label Master" to "With Label Master".
//
// This is the action that actually CREATES a Label Master for a record -- the setup step that
// unlocks the Label Master dependent actions (Export Master, Change Report, and the success
// branches of Link to Label Master / Compare With Prior).
//
// Confirmed reliable: 3 consecutive clean runs, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Route: RecreateMaster/JobSubmission -> RecreateMaster/SubmitJob -> RecreateMaster/JobDetail
//   (project Innovatum.Pages.LabelControl.RecreateMaster.MVC). No option fields at all -- just job
//   description, signature, and Submit.
// - Submit is `#btnSubmit` (a fourth Submit-id pattern: #submitBtn, #SubmitButton, a data-bind
//   button with no id, and this one). Always verify per action.
// - The signature Reason Code dropdown here offers ONLY "DataLoad" -- NOT "General" like every
//   other Label Control action. Selecting "General" silently waits forever (no such option).
// - This page's Job Detail prints `Status<tab>Completed` with NO colon, unlike the other actions'
//   `Status:<tab>Completed`. Poll with /Status:?\s*(Completed|Failed)/.
// - Only approved item/template/master data can be recreated; unapproved data is blocked with a
//   warning and a Details link (documented from the formal script, not live-exercised here).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('Recreate Master creates a Label Master for a freshly-assigned Label Control record', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCRM' + Date.now().toString().slice(-7);

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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Recreate Master test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Recreate Master test');

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  });

  async function openLabelControlAndQuery(labelMasterLabel: string = 'Any (Label Masters)'): Promise<Frame> {
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
    await frame.locator('#drpLabelMaster').selectOption({ label: labelMasterLabel });

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

    await jobFrame.fill('#txtJobDescription', 'Playwright Recreate Master test -- Assign Control Number');
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

  await test.step('before: the item shows under "Without Label Master"', async () => {
    const frame = await openLabelControlAndQuery('Without Label Master');
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, `Item ${itemNumber} should have no Label Master yet`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actRecreateMaster', { force: true });

    const jobFrame = await findFrame(page, 'RecreateMaster/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await expect(jobFrame.locator('body')).toContainText('Selected Records: 1');

    await jobFrame.fill('#txtJobDescription', 'Playwright Recreate Master test');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    // This action's Reason Code list contains only "DataLoad" (not "General").
    await jobFrame.selectOption('#sigReason', { label: 'DataLoad' }, { timeout: 5000 });
    await jobFrame.fill('#sigComments', 'Recreated by Playwright test');
    await page.waitForTimeout(500);

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('RecreateMaster/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#btnSubmit', { timeout: 5000 }),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    let detailFrame = await findFrame(page, 'RecreateMaster/JobDetail');
    await detailFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    let detailText = '';
    for (let attempt = 0; attempt < 60; attempt++) {
      detailText = await detailFrame.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      // No colon after "Status" on this page, unlike the other actions' Job Detail pages.
      if (/Status:?\s*(Completed|Failed)/.test(detailText) && !/Page\s+of\s+0/.test(detailText)) break;
      await page.waitForTimeout(2000);
      detailFrame = await findFrame(page, 'RecreateMaster/JobDetail');
    }
    expect(detailText, `Job never reported Completed: ${detailText}`).toMatch(/Status:?\s*Completed/);
    const rowIndex = detailText.indexOf(itemNumber);
    expect(rowIndex, `Row for ${itemNumber} missing from Job Detail: ${detailText}`).toBeGreaterThan(-1);
    expect(detailText.slice(rowIndex), `Row for ${itemNumber} did not complete: ${detailText}`).toContain('Completed');

    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('after: the item now shows under "With Label Master"', async () => {
    const frame = await openLabelControlAndQuery('With Label Master');
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, `Item ${itemNumber} never gained a Label Master`).toHaveCount(1, { timeout: 10_000 });
  });
});
