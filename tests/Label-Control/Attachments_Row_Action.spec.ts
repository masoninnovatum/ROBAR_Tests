// Row-level "Attachments" action on a Label Control record (LM_View_LinkManagement) -- the
// single-record Link Management view. Self-contained: creates and approves a Campaign Manager item
// (A1SuperTemplate, no BarTender), assigns it an LCN, uploads a brand-new attachment through the
// Attachment Upload tile and links it with the bulk Link Attachments action (Link_Attachments.spec.ts's
// proven setup), then:
//   1. opens the row-level Attachments action and checks the Link Management view it lands on
//      (pre-filtered to the record's LCN, showing the linked file, with the five association scopes);
//   2. detaches the file from that view and confirms the record loses its attachment.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Row menu items are "Update Versions" and "Attachments" (both live in the row's own Actions menu).
// - The action opens LinkAttachmentManagement/LinkManagement?controlId=<id>&previousSession=<id>, whose grid
//   (#grdControl) is already filtered by a pre-applied row dvFilters[0]: Column LCN, Operator
//   ExactlyMatches, Value <the record's LCN>, and auto-loads.
// - Mode dropdown #ddlLinkType: "Associate Attachments" (value -1, selected) / By LCN / By Item / By Item
//   Version / By Template / By Template Version. Detach is #btnDetach, disabled until a grid row is checked.
// - Detach has NO confirmation dialog: it runs immediately and lands on
//   LinkAttachmentManagement/AttachmentDetails?jobId=...&isVersionPage=true -- the same job-details page
//   linking uses ("Job completed successfully", a Status/File Name/LCN/Item table).
// - The grid row's own Actions menu offers View, Download, Edit.
// Confirmed reliable: 3 consecutive clean runs, ~2.5-2.6 minutes each, entirely headless.
// Same Playwright gotcha as Link_Attachments.spec.ts: give every call an explicit timeout (none by default).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';
const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

test('Attachments row action opens Link Management for the record and Detach removes the file', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCAR' + Date.now().toString().slice(-7);
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

  let lcn = '';
  await test.step('row action: Attachments opens Link Management pre-filtered to the record', async () => {
    const frame = await openLabelControlAndQuery();
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    lcn = ((await row.innerText({ timeout: 5000 })).match(/LCN\d+/) ?? [''])[0];
    expect(lcn, 'record should have an LCN').toBeTruthy();

    await row.getByText('Actions', { exact: true }).click({ timeout: 5000 });
    await page.waitForTimeout(500);
    const menu = (await row.locator('li').allInnerTexts()).map((t) => t.trim());
    expect(menu).toEqual(expect.arrayContaining(['Update Versions', 'Attachments']));
    await row.getByText('Attachments', { exact: true }).click({ timeout: 5000 });

    const lm = await findFrame(page, 'LinkAttachmentManagement/LinkManagement');
    expect(lm.url()).toContain('controlId=');
    await lm.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3000);

    await expect(lm.locator('body')).toContainText('Link Management');
    const modes = (await lm.locator('#ddlLinkType option').allTextContents()).map((t) => t.trim());
    expect(modes).toEqual(['Associate Attachments', 'By LCN', 'By Item', 'By Item Version', 'By Template', 'By Template Version']);
    expect(await lm.locator('#ddlLinkType').evaluate((e) => (e as HTMLSelectElement).value, undefined, { timeout: 3000 })).toBe('-1');

    // Pre-applied filter: the record's own LCN.
    expect(await lm.locator('select[name="dvFilters[0].Column"]').evaluate((e) => (e as HTMLSelectElement).value, undefined, { timeout: 3000 })).toBe('LCN');
    expect(await lm.locator('select[name="dvFilters[0].Operator"]').evaluate((e) => (e as HTMLSelectElement).value, undefined, { timeout: 3000 })).toBe('ExactlyMatches');
    expect(await lm.locator('input[name="dvFilters[0].Value"]').inputValue({ timeout: 3000 })).toBe(lcn);

    // The grid auto-loads exactly the record's linked file.
    const gridRow = lm.locator('#grdControl tr').filter({ hasText: uploadedFileName });
    await expect(gridRow).toHaveCount(1, { timeout: 10_000 });
    const gridText = (await gridRow.innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    expect(gridText).toContain(lcn);
    expect(gridText).toContain(itemNumber);
    expect(gridText).toContain(TEMPLATE);

    // Detach stays disabled until a row is checked.
    await expect(lm.locator('#btnDetach')).toBeDisabled({ timeout: 5000 });
    await gridRow.locator('input[type="checkbox"]').first().check({ timeout: 5000 });
    await page.waitForTimeout(800);
    await expect(lm.locator('#btnDetach')).toBeEnabled({ timeout: 5000 });
  });

  await test.step('Detach: unlinks the file immediately (no confirmation) and shows a completed job', async () => {
    const lm = await findFrame(page, 'LinkAttachmentManagement/LinkManagement');
    await lm.click('#btnDetach', { timeout: 5000 });

    const details = await findFrame(page, 'LinkAttachmentManagement/AttachmentDetails');
    await details.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3000);
    const detailsText = (await details.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    expect(detailsText).toContain('Job completed successfully');
    expect(detailsText).toContain('Completed');
    expect(detailsText).toContain(uploadedFileName);
    expect(detailsText).toContain(lcn);

    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('the record no longer shows under "With Attachments"', async () => {
    const frame = await openLabelControlAndQuery('With Attachments');
    await expect(frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber })).toHaveCount(0, { timeout: 10_000 });
  });
});
