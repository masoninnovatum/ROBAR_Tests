// Creates a fresh Campaign Manager item (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns it a Label Control Number, uploads a brand-new attachment
// file via the separate "Attachment Upload" Document Control tile, then runs the Label Control
// grid's Link Attachments bulk action to associate that file with the item -- confirmed via a
// final "With Attachments" re-query of the Label Control grid.
//
// Confirmed reliable: 3 consecutive clean runs, ~1.9-2.3 minutes each, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Link Attachments is NOT its own async Job Submission flow -- it's a direct POST
//   (LinkAttachmentManagement/AttachmentTransition) + full-page redirect to
//   LinkAttachmentManagement/AttachmentManagement, a page that only LINKS already-uploaded
//   attachment files. Uploading a brand-new file is a separate Main Menu tile entirely,
//   "Attachment Upload" (Document Control group), route
//   LinkAttachmentManagement/UploadAttachments -> LinkAttachmentManagement/UploadAction.
// - Upload page gotcha: selecting a File Purpose pops a modal "Confirm File Purpose" dialog
//   ("Apply to all records?") that blocks everything behind it, including the Upload button --
//   must be dismissed (click OK) before anything else on the page is clickable.
// - Upload page gotcha: EVERY Playwright call around the post-upload confirmation needs its own
//   explicit bounded timeout. Playwright actions have no default per-call timeout (only the
//   unset config actionTimeout, or the overall test timeout, bound them) -- an unbounded call
//   that never resolves silently eats the ENTIRE remaining test budget instead of failing fast.
//   This caused a confusing ~660s "mystery stall" across several iterations before realizing it
//   was simply unbounded calls blind-retrying, not a real server delay (the true round trip is
//   under 10 seconds once every call is bounded).
// - AttachmentManagement page gotcha: unlike Label Control's own grid, this page's single filter
//   row already EXISTS by default (no "Add Filter" click needed) -- but an unfiltered Retrieve
//   Data does NOT show a just-uploaded file; it must be searched for explicitly (e.g. by
//   FileName) or it won't appear in the linkable list at all.
// - A unique filename per run avoids accumulating ambiguous duplicate attachment records in the
//   shared environment (confirmed live: 8 identically-named uploads piled up from earlier
//   iterations before this was fixed).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';

test('Link Attachments uploads a new file and links it to a Label Control record', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCLA' + Date.now().toString().slice(-7);
  const uploadedFileName = `MBAttach${Date.now().toString().slice(-7)}.txt`;
  const uploadFilePath = path.join(os.tmpdir(), uploadedFileName);
  fs.writeFileSync(uploadFilePath, 'Playwright Link Attachments test fixture file.');

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
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Link Attachments test item');

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
    await approveDialog.locator('#sigComments').fill('Approved by Playwright Link Attachments test');

    const [approveResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/ApproveItem'), { timeout: 15_000 }),
      editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
    ]);
    const approveBody = await approveResponse.json();
    expect(approveBody.Success, `ApproveItem failed: ${approveBody.ErrorMessage}`).toBe(true);

    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click();
    await page.waitForTimeout(500);
  });

  async function openLabelControlAndQuery(attachmentsLabel: string = 'Any (Attachments)'): Promise<Frame> {
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
    await frame.locator('#drpAttachments').selectOption({ label: attachmentsLabel });
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

    await jobFrame.fill('#txtJobDescription', 'Playwright Link Attachments test -- Assign Control Number');
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

  await test.step('upload a new attachment file via the Attachment Upload tile', async () => {
    await openMenuItem(page, 'Attachment Upload');
    const uploadFrame = await findFrame(page, 'LinkAttachmentManagement/UploadAttachments');
    await uploadFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);

    await uploadFrame.setInputFiles('#fileToUpload0', uploadFilePath);
    await page.waitForTimeout(1000);

    const purposeSelect = uploadFrame.locator('select.ddlist').first();
    const realOptionValue = await purposeSelect.locator('option').nth(1).getAttribute('value');
    expect(realOptionValue, 'Could not find a real File Purpose option to select').toBeTruthy();
    await purposeSelect.selectOption(realOptionValue!);
    await page.waitForTimeout(500);

    // Changing File Purpose pops a modal "Confirm File Purpose" dialog that blocks everything
    // behind it, including the Upload button, until dismissed.
    const confirmPurposeDialog = uploadFrame.locator('.ui-dialog:has-text("Confirm File Purpose")');
    if (await confirmPurposeDialog.count()) {
      await confirmPurposeDialog.locator('button:has-text("OK")').click();
    }

    await uploadFrame.locator('.chkFiles').first().check();
    await uploadFrame.locator('#description').first().fill(`Playwright Link Attachments test -- ${itemNumber}`);

    await uploadFrame.locator('#btnUpload').first().click({ force: true, timeout: 5000 });

    let returnMsg = '';
    let errorMsg = '';
    for (let attempt = 0; attempt < 30; attempt++) {
      await page.waitForTimeout(2000);
      const uploadFrame2 = await findFrame(page, 'LinkAttachmentManagement/UploadAttachments');
      await uploadFrame2.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
      returnMsg = await uploadFrame2.locator('#returnMessage').innerText({ timeout: 2000 }).catch(() => '');
      errorMsg = await uploadFrame2.locator('#errorMessage').innerText({ timeout: 2000 }).catch(() => '');
      if (returnMsg || errorMsg) break;
    }
    expect(errorMsg, `Upload reported an error: ${errorMsg}`).toBe('');
    expect(returnMsg, 'Upload never reported a success message').toContain('uploaded successfully');

    await page.locator('li.ui-tabs-tab:has-text("Attachment Upload") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});

    fs.unlinkSync(uploadFilePath);
  });

  await test.step('Link Attachments: associate the uploaded file with the Label Control record', async () => {
    const frame = await openLabelControlAndQuery();

    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actLinkAttachments', { force: true });

    const mgmtFrame = await findFrame(page, 'AttachmentManagement');
    await mgmtFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    // This page's single filter row exists by default (no "Add Filter" click needed, unlike
    // Label Control) -- but an unfiltered retrieve does NOT surface a just-uploaded file.
    await mgmtFrame.locator("select[name='dvFilters[0].Column']").selectOption('FileName');
    await mgmtFrame.locator("select[name='dvFilters[0].Operator']").selectOption('Contains');
    await mgmtFrame.locator("input[name='dvFilters[0].Value']").fill(uploadedFileName);

    await mgmtFrame.click('#btnRetrieveData');
    await mgmtFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    const fileRow = mgmtFrame.locator('#grdControl tr').filter({ hasText: uploadedFileName });
    await expect(fileRow, `Uploaded file ${uploadedFileName} never appeared in the linkable grid`).toHaveCount(1, { timeout: 10_000 });
    await fileRow.locator('input[type="checkbox"]').first().check();
    // Settle wait: the Knockout-tracked selection observable backing #btLink's own enable/click
    // binding can lag a raw DOM checkbox click (the same race confirmed in Redline Compare).
    await page.waitForTimeout(500);

    await mgmtFrame.click('#btLink', { force: true });
    // linkFiles() navigates to LinkAttachmentManagement/AttachmentDetails?jobId=... -- NOT
    // another AttachmentTransition POST (confirmed live; an earlier attempt to wait on that URL
    // pattern just timed out watching for a request that was never going to happen).
    await findFrame(page, 'AttachmentDetails');

    // #actLinkAttachments navigates the EXISTING Label Control tab's own iframe (not a new tab),
    // so the tab is still titled "Label Control" throughout this whole step. Close it so the
    // Home tab's menu tiles become visible again for the next openMenuItem call -- otherwise
    // openMenuItem hangs retrying a tile that exists in the DOM but isn't visible.
    await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('verify the item now shows under "With Attachments"', async () => {
    const frame = await openLabelControlAndQuery('With Attachments');
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row, `Item ${itemNumber} did not show under "With Attachments" after linking`).toHaveCount(1, { timeout: 10_000 });
  });
});
