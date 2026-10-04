// Creates a fresh Campaign Manager item (no BarTender needed -- reuses the existing approved
// 'A1SuperTemplate' fixture), assigns it a Label Control Number, runs Recreate Master so it has a
// real Label Master (Export Master needs one), then runs Export Master on it and verifies the
// exported PDF actually landed on the network share and the job's Download link is offered.
//
// Confirmed reliable: 3 consecutive clean runs, entirely headless.
//
// Module-specific findings (full detail in robar-module-reference.md):
// - Route: ExportMaster/JobSubmission -> ExportMaster/SubmitJob -> ExportMaster/JobDetail
//   (project Innovatum.Pages.LabelControl.ExportMaster.MVC). NO e-signature on this action.
//   Fields: #txtJobDescription, #txtPath, #ckbMerge, Submit is #btnSubmit.
// - The Path is a SUBFOLDER name, resolved under //VMSRVTST703/Network/ExportMaster/ (shown on
//   the Job Detail page). The export writes one PDF per record, named
//   "<LCN>_<ItemNumber>_<LabelType>_<ItemVersion>.pdf" (~550KB for a fresh item).
// - Job Detail has NO per-record grid (unlike most actions) -- just job header, the resolved
//   export path, and a Download link (ExportMaster/DownloadFile/<jobId>). `Status` has no colon
//   here, same as Recreate Master.
// - The test uses a unique folder per run and removes ONLY that folder afterwards.
// - Intermittent: right after Recreate Master, the "With Label Master" grid query occasionally
//   returned "No records to view" once, then showed the row on a retry -- so the lookup retries.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as fs from 'fs';
import * as path from 'path';

const LABEL_TYPE = 'Carton Label';
const TEMPLATE = 'A1SuperTemplate';
// UNC share written with forward slashes (path.join normalizes it on Windows) -- avoids the
// backslash-escaping pitfalls that mangled this path twice while authoring the spec.
const EXPORT_ROOT = '//VMSRVTST703/Network/ExportMaster';

test('Export Master writes the master PDF to the export folder and offers a download', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);

  const itemNumber = 'MBLCEM' + Date.now().toString().slice(-7);

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

  const exportFolder = 'PlaywrightExport' + Date.now().toString().slice(-6);

  await test.step('Export Master on the item that now has a Label Master', async () => {
    let frame!: Frame;
    let row = null as unknown as ReturnType<Frame['locator']>;
    for (let attempt = 0; attempt < 5; attempt++) {
      await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
      frame = await openLabelControlAndQuery('With Label Master');
      row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
      if ((await row.count()) === 1) break;
      await page.waitForTimeout(3000);
    }
    await expect(row).toHaveCount(1, { timeout: 5_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);

    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actExportMaster', { force: true });

    const jobFrame = await findFrame(page, 'ExportMaster/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await expect(jobFrame.locator('body')).toContainText('Selected Records: 1');

    await jobFrame.fill('#txtJobDescription', 'Playwright Export Master test', { timeout: 5000 });
    await jobFrame.fill('#txtPath', exportFolder, { timeout: 5000 });
    await page.waitForTimeout(500);

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('ExportMaster/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#btnSubmit', { timeout: 5000 }),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    let detailFrame = await findFrame(page, 'ExportMaster/JobDetail');
    await detailFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    let detailText = '';
    for (let attempt = 0; attempt < 60; attempt++) {
      detailText = await detailFrame.locator('body').innerText({ timeout: 3000 }).catch(() => '');
      // No colon after "Status" on this page.
      if (/Status:?\s*(Completed|Failed)/.test(detailText)) break;
      await page.waitForTimeout(2000);
      detailFrame = await findFrame(page, 'ExportMaster/JobDetail');
    }
    expect(detailText, `Job never reported Completed: ${detailText}`).toMatch(/Status:?\s*Completed/);
    expect(detailText, 'Job Detail should show the resolved export path').toContain(exportFolder);

    const downloadLink = detailFrame.locator('a[href*="ExportMaster/DownloadFile/"]');
    await expect(downloadLink).toHaveCount(1);

    // The real proof: the exported PDF is on the share (a job can report Completed without it).
    const exportDir = path.join(EXPORT_ROOT, exportFolder);
    let files: string[] = [];
    for (let attempt = 0; attempt < 10; attempt++) {
      files = fs.existsSync(exportDir) ? fs.readdirSync(exportDir) : [];
      if (files.length > 0) break;
      await page.waitForTimeout(1000);
    }
    const exported = files.filter((f) => f.includes(itemNumber) && f.toLowerCase().endsWith('.pdf'));
    expect(exported, `No exported PDF for ${itemNumber} in ${exportDir}; found: ${files.join(', ')}`).toHaveLength(1);
    expect(fs.statSync(path.join(exportDir, exported[0])).size, 'Exported PDF is empty').toBeGreaterThan(0);

    // Remove only the unique folder this run created.
    if (exportDir.endsWith(exportFolder) && exportFolder.startsWith('PlaywrightExport')) {
      fs.rmSync(exportDir, { recursive: true, force: true });
    }
  });
});
