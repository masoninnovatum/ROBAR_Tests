// Creates a fresh Campaign Manager item (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns it a Label Control Number (Assign_Control_Number.spec.ts's
// own proven flow), then runs Mass Update Versions on it with "Keep Version" selected for all
// three dimensions (Item/Template/Master Data) -- the simplest success path, since nothing needs
// to actually change for a brand-new version-0 item/template with no master data at all.
//
// Confirmed reliable: 3 consecutive clean runs, ~1.5 minutes each, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Real field ids (none of these are documented anywhere else, discovered live): `#drpItemVersion`
//   / `#drpTemplateVersion` / `#drpMDVersion` (Keep Version / Use Latest Version selects),
//   `#itemAllowUnapproved` / `#templateAllowUnapproved` / `#masterDataAllowUnapproved` (checkboxes,
//   only meaningful when the matching dropdown is "Use Latest Version" -- not exercised here).
// - This page's Submit control is `<input type="button" id="SubmitButton">` -- NOT `#submitBtn`
//   like Assign Control Number's and Manage Production Availability's job-submission pages use.
//   Don't assume the shared-signature-component ids (`#txtJobDescription`/`#sigUser`/`#sigPassword`
//   /`#sigReason`/`#sigComments`, all confirmed identical here) extend to the Submit button too --
//   it doesn't. A `.click('#submitBtn')` on this specific page hangs for the full test timeout
//   with no useful error (the locator just never resolves), rather than failing fast.
// - Same async-job pattern as every other bulk action here (Job Detail reports blank Status /
//   "Page of 0" immediately, poll until real).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('mass-update a freshly-assigned Label Control record, keeping all versions', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCMU' + Date.now().toString().slice(-7);

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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Mass Update Versions test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Mass Update Versions test');

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

    await jobFrame.fill('#txtJobDescription', 'Playwright Mass Update Versions test -- Assign Control Number');
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

  await test.step('Mass Update Versions: Keep Version for Item, Template, and Master Data', async () => {
    const frame = await openLabelControlAndQuery();

    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actUpdateVersions', { force: true });

    const jobFrame = await findFrame(page, 'MassUpdateVersions/JobSubmission');
    await jobFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(1000);

    await jobFrame.selectOption('#drpItemVersion', { label: 'Keep Version' });
    await jobFrame.selectOption('#drpTemplateVersion', { label: 'Keep Version' });
    await jobFrame.selectOption('#drpMDVersion', { label: 'Keep Version' });

    await jobFrame.fill('#txtJobDescription', 'Playwright Mass Update Versions test -- Keep Version');
    await jobFrame.fill('#sigUser', USERNAME);
    await jobFrame.fill('#sigPassword', PASSWORD);
    await jobFrame.selectOption('#sigReason', { label: 'General' });
    await jobFrame.fill('#sigComments', 'Mass-updated by Playwright test');

    // This page's Submit control is id="SubmitButton" (plain <input type="button">), not the
    // #submitBtn id used by Assign Control Number / Manage Production Availability's pages.
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassUpdateVersions/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#SubmitButton'),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    let detailFrame = await findFrame(page, 'MassUpdateVersions/JobDetail');
    await detailFrame.waitForLoadState('networkidle').catch(() => {});

    let detailText = '';
    for (let attempt = 0; attempt < 20; attempt++) {
      detailText = await detailFrame.locator('body').innerText().catch(() => '');
      if (/Status:\s*(Completed|Failed)/.test(detailText) && !/Page\s+of\s+0/.test(detailText)) break;
      await page.waitForTimeout(1500);
      detailFrame = await findFrame(page, 'MassUpdateVersions/JobDetail');
    }
    expect(detailText, `Job Detail never showed a completed status: ${detailText}`).toMatch(/Status:\s*Completed/);
    expect(detailText, `Per-record status was not "Updated": ${detailText}`).toContain('Updated');
  });
});
