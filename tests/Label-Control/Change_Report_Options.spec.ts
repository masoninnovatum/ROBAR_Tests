// Change Report (Change Document Report) options beyond the default "CDR Only" run that Change_Report.spec.ts covers.
// Setup is web-only (no BarTender): a two-version item (v0, v1 both approved), one Assign Control Number job over
// both (its Job Detail table maps LCN -> version), and Recreate Master on v1 only. Every job runs on v1; after each,
// the record's linked files are listed through the row-level Attachments action (Link Management grid).
//
//   1. CDR Only (default)                            -> ChangeDocumentReport_<LCN>.pdf linked
//   2. CDR Only + "Do Not Recreate If Already Exists" -> job Completed, NO new attachment
//   3. CDR Only again (box off)                       -> a second file with the same name is added (not replaced)
//   4. Grouped Master Only                            -> GroupedMaster_<item>.pdf linked
//   5. Both                                           -> GroupedMasterWithCDR_<item>.pdf linked
//   6. Save to Folder + sub folder + "Do Not Save CDR to ROBAR" -> file lands on //<server>/Network/CDR/<sub folder>,
//      nothing new linked; and Save to Folder with an empty sub folder is blocked client-side
//   7. Link to Prior                                  -> the new file is ALSO linked to the v0 record
//
// "Link to Prior" and "Save to Folder" are hidden unless the user holds LC_CDR_LinkToPrior / LC_CDR_SaveToFolder;
// mbuser1 holds both, so no security changes are needed.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';
// Default CDRFileLocation is \\<server>\Network\CDR\ ; forward slashes + path.join (see Export_Master.spec.ts).
const CDR_SHARE = '//VMSRVTST703/Network/CDR';

async function openLabelControlAndQuery(page: Page, itemNumber: string, labelMasterLabel = 'Any (Label Masters)'): Promise<Frame> {
  await page.locator(LC_TAB_CLOSE).click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await page.locator('button.menuIcon:has-text("Label Control")').waitFor({ state: 'visible', timeout: 10_000 });
  await openMenuItem(page, 'Label Control');
  let frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  await frame.click('#btnReset');
  await page.waitForTimeout(1500);
  frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
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

async function readJobDetail(page: Page, urlPart: string): Promise<{ text: string; status: string; rows: string[][] }> {
  let detailFrame = await findFrame(page, urlPart);
  await detailFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  let text = '';
  for (let attempt = 0; attempt < 60; attempt++) {
    text = await detailFrame.locator('body').innerText({ timeout: 3000 }).catch(() => '');
    // Some Job Detail pages print "Status:" and others "Status" with no colon.
    if (/Status:?\s*(Completed|Failed)/.test(text) && !/Page\s+of\s+0/.test(text)) break;
    await page.waitForTimeout(2000);
    detailFrame = await findFrame(page, urlPart);
  }
  const status = (text.match(/Status:?\s*(\w+)/) ?? [])[1] ?? '';
  const rows = text
    .split('\n')
    .filter((l) => l.startsWith('LCN') && l.includes('\t'))
    .map((l) => l.split('\t').map((c) => c.trim()));
  return { text, status, rows };
}

async function fillSignature(jobFrame: Frame, reason: string | { index: number } | { label: string }): Promise<void> {
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  await jobFrame.selectOption('#sigReason', reason as any, { timeout: 5000 });
  await jobFrame.fill('#sigComments', 'Playwright Change Report options test', { timeout: 5000 });
}

/** Selects one record by LCN text, opens a bulk action, and returns nothing (caller finds the job frame). */
async function selectRecordAndOpenAction(page: Page, frame: Frame, lcn: string, actionId: string): Promise<void> {
  const row = frame.locator('#grdLabelControl tr').filter({ hasText: lcn });
  await expect(row, `expected one row for ${lcn}`).toHaveCount(1, { timeout: 10_000 });
  await row.locator('input[type="checkbox"]').first().check();
  await page.waitForTimeout(500);
  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  await frame.click(actionId, { force: true });
}

test('Change Report options: Do Not Recreate, Grouped Master, Both, Save to Folder and Link to Prior', async ({ page }) => {
  test.setTimeout(1_500_000);
  // No login() here: cm.openCampaignManager logs in itself.

  let itemNumber = '';
  const lcnByVersion: Record<string, string> = {};

  await test.step('create an item with two approved versions (Save As New Version)', async () => {
    const cmFrame = await cm.openCampaignManager(page);
    const created = await cm.createItem(page, cmFrame);
    itemNumber = created.itemNumber;
    await cm.openItemAction(created.editFrame, 'Approve Item');
    const approve0 = await cm.submitSignatureDialog(page, created.editFrame, '#approveItemDialog', 'ApproveItem');
    expect(approve0.Success, `approve v0 failed: ${JSON.stringify(approve0)}`).toBe(true);

    const v0Frame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
    await v0Frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    const [newVersionResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/SaveAsNewItemVersion'), { timeout: 15_000 }),
      cm.openItemAction(v0Frame, 'Save As New Version'),
    ]);
    expect((await newVersionResponse.json()).Success).toBe(true);

    const v1Frame = await findFrame(
      page,
      `items/edit?itemnumber=${itemNumber.toLowerCase()}&labeltype=${encodeURIComponent(cm.LABEL_TYPE.toLowerCase())}&versionnumber=1`
    );
    await v1Frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await cm.openItemAction(v1Frame, 'Approve Item');
    const approve1 = await cm.submitSignatureDialog(page, v1Frame, '#approveItemDialog', 'ApproveItem');
    expect(approve1.Success, `approve v1 failed: ${JSON.stringify(approve1)}`).toBe(true);
    await page.waitForTimeout(1500);
    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  });

  await test.step('one Assign Control Number job gives each version its LCN', async () => {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    const rows = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(rows).toHaveCount(2, { timeout: 10_000 });
    for (let i = 0; i < 2; i++) {
      await rows.nth(i).locator('input[type="checkbox"]').first().check();
      await page.waitForTimeout(500);
    }
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actAssignLabelControl', { force: true });
    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.fill('#txtJobDescription', 'Playwright Change Report options -- Assign Control Number', { timeout: 5000 });
    await fillSignature(jobFrame, { index: 1 });
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);
    const job = await readJobDetail(page, 'MassAssign/JobDetail');
    expect(job.rows, `assign job detail: ${job.text}`).toHaveLength(2);
    for (const cells of job.rows) lcnByVersion[cells[3]] = cells[0];
    expect(Object.keys(lcnByVersion).sort()).toEqual(['0', '1']);
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });
  const lcnV0 = () => lcnByVersion['0'];
  const lcnV1 = () => lcnByVersion['1'];

  await test.step('Recreate Master on v1 only, so v1 has the Label Master Change Report needs', async () => {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    await selectRecordAndOpenAction(page, frame, lcnV1(), '#actRecreateMaster');
    const jobFrame = await findFrame(page, 'RecreateMaster/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await jobFrame.fill('#txtJobDescription', 'Playwright Change Report options -- Recreate Master', { timeout: 5000 });
    await fillSignature(jobFrame, { label: 'DataLoad' });
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('RecreateMaster/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#btnSubmit', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);
    const job = await readJobDetail(page, 'RecreateMaster/JobDetail');
    expect(job.status, `recreate master: ${job.text}`).toBe('Completed');
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  /** Names of the files linked to a record, read from its row-level Attachments action (Link Management grid). */
  async function listFiles(lcn: string): Promise<string[]> {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: lcn });
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.getByText('Actions', { exact: true }).click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await row.getByText('Attachments', { exact: true }).click({ timeout: 5000 });
    const lm = await findFrame(page, 'LinkAttachmentManagement/LinkManagement');
    await lm.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3500);
    const rows = await lm.locator('#grdControl tr').allInnerTexts();
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return rows
      .map((t) => t.replace(/\s+/g, ' ').trim())
      .filter((t) => t.includes('.pdf'))
      .map((t) => (t.match(/\S+\.pdf/) ?? [''])[0])
      .sort();
  }

  /** One Change Report job on `lcn`. Returns the Job Detail row for the record (or the client-side error text). */
  async function runChangeReport(
    lcn: string,
    description: string,
    opts: { radio?: string; doNotRecreate?: boolean; linkToPrior?: boolean; saveToFolder?: string; doNotSaveToDb?: boolean } = {}
  ) {
    const frame = await openLabelControlAndQuery(page, itemNumber, 'Any (Label Masters)');
    await selectRecordAndOpenAction(page, frame, lcn, '#actChangeDocumentReport');
    const jobFrame = await findFrame(page, 'CDR/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    if (opts.radio) await jobFrame.locator('#' + opts.radio).check({ timeout: 5000 });
    if (opts.doNotRecreate) await jobFrame.locator('#recreateIfAlreadyExistsCheckbox').check({ timeout: 5000 });
    if (opts.linkToPrior) await jobFrame.locator('#linkToPrior').check({ timeout: 5000 });
    if (opts.saveToFolder !== undefined) {
      await jobFrame.locator('#saveToFolder').check({ timeout: 5000 });
      await expect(jobFrame.locator('#folderSelectDiv')).toBeVisible({ timeout: 5000 });
      if (opts.saveToFolder) await jobFrame.locator('#saveSubfolder').fill(opts.saveToFolder, { timeout: 5000 });
      if (opts.doNotSaveToDb) await jobFrame.locator('#doNotSaveToDb').check({ timeout: 5000 });
    }
    await jobFrame.fill('#txtJobDescription', `Playwright Change Report options -- ${description}`, { timeout: 5000 });
    await fillSignature(jobFrame, { label: 'General' });
    await page.waitForTimeout(500);

    if (opts.saveToFolder === '') {
      // Client-side validation: no request goes out.
      await jobFrame.click('#submitBtn', { timeout: 5000 });
      await page.waitForTimeout(1000);
      const message = (await jobFrame.locator('#subFolderError').innerText({ timeout: 3000 })).trim();
      await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
      return { clientError: message };
    }

    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('CDR/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    const body = await submitResponse.json();
    expect(body.Success, `SubmitJob failed: ${body.ErrorString}`).toBe(true);
    const job = await readJobDetail(page, 'CDR/JobDetail');
    console.log(`change report [${description}]: status=${job.status}`);
    // Surface the per-record message when a job does not complete (a bare status told us nothing).
    expect(job.status, `Change Report "${description}" did not complete: ${job.text.replace(/\s+/g, ' ').slice(0, 600)}`).toBe('Completed');
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return { job };
  }

  const cdrName = () => `ChangeDocumentReport_${lcnV1()}.pdf`;

  await test.step('1. CDR Only (default) links one ChangeDocumentReport file; 2. Do Not Recreate adds nothing', async () => {
    const first = await runChangeReport(lcnV1(), '1 cdr only');
    expect(first.job!.status).toBe('Completed');
    expect(await listFiles(lcnV1())).toEqual([cdrName()]);

    const second = await runChangeReport(lcnV1(), '2 do not recreate', { doNotRecreate: true });
    expect(second.job!.status).toBe('Completed');
    expect(await listFiles(lcnV1())).toEqual([cdrName()]);
  });

  await test.step('3. running CDR Only again (box off) ADDS a second same-named file', async () => {
    const job = await runChangeReport(lcnV1(), '3 cdr only again');
    expect(job.job!.status).toBe('Completed');
    expect(await listFiles(lcnV1())).toEqual([cdrName(), cdrName()]);
  });

  await test.step('4. Grouped Master Only links GroupedMaster_<item>.pdf', async () => {
    const job = await runChangeReport(lcnV1(), '4 grouped master only', { radio: 'groupMasterOnlyRadio' });
    expect(job.job!.status).toBe('Completed');
    expect(await listFiles(lcnV1())).toEqual([cdrName(), cdrName(), `GroupedMaster_${itemNumber}.pdf`].sort());
  });

  await test.step('5. Both links GroupedMasterWithCDR_<item>.pdf', async () => {
    const job = await runChangeReport(lcnV1(), '5 both', { radio: 'bothRadio' });
    expect(job.job!.status).toBe('Completed');
    expect(await listFiles(lcnV1())).toEqual(
      [cdrName(), cdrName(), `GroupedMaster_${itemNumber}.pdf`, `GroupedMasterWithCDR_${itemNumber}.pdf`].sort()
    );
  });

  await test.step('6. Save to Folder: empty sub folder is blocked; with one the file lands on the CDR share, nothing new is linked', async () => {
    const blocked = await runChangeReport(lcnV1(), '6a empty subfolder', { saveToFolder: '' });
    console.log(`empty sub folder message: "${blocked.clientError}"`);
    expect(blocked.clientError).toBeTruthy();

    const subFolder = 'PW' + Date.now().toString().slice(-8);
    const folder = path.join(CDR_SHARE, subFolder);
    try {
      const job = await runChangeReport(lcnV1(), '6b save to folder', { saveToFolder: subFolder, doNotSaveToDb: true });
      expect(job.job!.status).toBe('Completed');
      const files = fs.existsSync(folder) ? fs.readdirSync(folder) : [];
      expect(files, `expected the report in ${folder}`).toEqual([cdrName()]);
      expect(fs.statSync(path.join(folder, cdrName())).size).toBeGreaterThan(1000);
      // "Do Not Save CDR to ROBAR" was ticked: the linked files are unchanged from step 5.
      expect(await listFiles(lcnV1())).toHaveLength(4);
    } finally {
      // Delete only the folder this run created.
      fs.rmSync(folder, { recursive: true, force: true });
    }
  });

  await test.step('7. Link to Prior also links the new file to the version-0 record', async () => {
    expect(await listFiles(lcnV0()), 'v0 starts with no linked files').toEqual([]);
    const job = await runChangeReport(lcnV1(), '7 link to prior', { linkToPrior: true });
    expect(job.job!.status).toBe('Completed');
    expect(await listFiles(lcnV1())).toHaveLength(5);
    expect(await listFiles(lcnV0())).toEqual([cdrName()]);
  });
});
