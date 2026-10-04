// Link to Label Master, the SUCCESS and option branches. Link_to_Label_Master.spec.ts only covers the
// "no label master exists at all" error path. This one builds a two-version item where ONLY version 0 has a
// Label Master (made with Recreate Master), so each branch of the service's logic gets its own single-record
// job (LinkToLabelMasterService.cs -> GetItemLabelMasterToReplace / LinkToLabelMasterKey):
//
//   exact match = an ItemLabelMaster row with the same item number, label type, item version, template version
//                 and master data version as the LC record; otherwise the LATEST master by item version for the
//                 same item + label type (non-exact).
//   job A: v1, no boxes ticked        -> no key yet, not exact, "Use Latest" off  -> Error (matching master not found)
//   job B: v1, "Use Latest" ticked    -> links to v0's master                      -> Updated
//   job C: v0, no boxes ticked        -> already linked, "Update Existing" off    -> Error (already linked)
//   job D: v0, "Update Existing"      -> already linked but exact match           -> Updated
//
// Setup is web-only (no BarTender): Campaign Manager Save As New Version for the second version, one Assign
// Control Number job over both versions (its Job Detail table carries the version column, which maps LCN ->
// version), Recreate Master on the v0 record only (reason code "DataLoad").

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

async function openLabelControlAndQuery(page: Page, itemNumber: string, labelMasterLabel: string = 'Any (Label Masters)'): Promise<Frame> {
  await page.locator(LC_TAB_CLOSE).click({ timeout: 2000 }).catch(() => {});
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

/** Checks the given rows (settle wait after each -- the selection count lags the DOM) and opens a bulk action. */
async function selectRowsAndOpenAction(page: Page, frame: Frame, rowTexts: string[], actionId: string): Promise<void> {
  for (const text of rowTexts) {
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: text });
    await expect(row, `expected exactly one row containing ${text}`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
  }
  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  await frame.click(actionId, { force: true });
}

/** Polls a job's detail page to a terminal status; returns text, final status and tab-separated record rows. */
async function readJobDetail(page: Page, urlPart: string): Promise<{ text: string; status: string; rows: string[][] }> {
  let detailFrame = await findFrame(page, urlPart);
  await detailFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  let text = '';
  for (let attempt = 0; attempt < 40; attempt++) {
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

async function fillSignature(jobFrame: Frame, reasonLabel: string | { index: number }): Promise<void> {
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  await jobFrame.selectOption('#sigReason', reasonLabel as any, { timeout: 5000 });
  await jobFrame.fill('#sigComments', 'Playwright Link to Label Master (success) test', { timeout: 5000 });
}

test('Link to Label Master: exact match, latest fallback, already-linked and update-existing branches', async ({ page }) => {
  test.setTimeout(900_000);
  // No login() here: cm.openCampaignManager logs in itself (a second login stalls on the missing form).

  let itemNumber = '';
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
    const newVersionBody = await newVersionResponse.json();
    expect(newVersionBody.Success, `SaveAsNewItemVersion failed: ${JSON.stringify(newVersionBody)}`).toBe(true);

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

  const lcnByVersion: Record<string, string> = {};
  await test.step('one Assign Control Number job gives each version its own LCN', async () => {
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
    await jobFrame.fill('#txtJobDescription', 'Playwright Link to Label Master (success) -- Assign Control Number', { timeout: 5000 });
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

  await test.step('Recreate Master on the version-0 record only, so only v0 has a Label Master', async () => {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    await selectRowsAndOpenAction(page, frame, [lcnV0()], '#actRecreateMaster');

    const jobFrame = await findFrame(page, 'RecreateMaster/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await jobFrame.fill('#txtJobDescription', 'Playwright Link to Label Master (success) -- Recreate Master', { timeout: 5000 });
    await fillSignature(jobFrame, { label: 'DataLoad' } as any);
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('RecreateMaster/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#btnSubmit', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);

    const job = await readJobDetail(page, 'RecreateMaster/JobDetail');
    expect(job.status, `recreate master: ${job.text}`).toBe('Completed');
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});

    const withMaster = await openLabelControlAndQuery(page, itemNumber, 'With Label Master');
    const linked = withMaster.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(linked).toHaveCount(1, { timeout: 10_000 });
    await expect(linked.first()).toContainText(lcnV0());
  });

  /** Runs one single-record Link to Label Master job and returns the record's row from its Job Detail. */
  async function runLinkJob(lcn: string, options: { useLatest?: boolean; updateExisting?: boolean }, description: string) {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    await selectRowsAndOpenAction(page, frame, [lcn], '#actLinkToLabelMaster');

    const jobFrame = await findFrame(page, 'LinkToLabelMaster/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    // The two checkboxes have no ids, only Knockout data-bind attributes.
    const updateBox = jobFrame.locator('input[data-bind*="updateExistingLabelMaster"]');
    const latestBox = jobFrame.locator('input[data-bind*="useLatestNoExactMatch"]');
    if (options.updateExisting) await updateBox.check({ timeout: 5000 });
    if (options.useLatest) await latestBox.check({ timeout: 5000 });
    expect(await updateBox.isChecked({ timeout: 3000 })).toBe(!!options.updateExisting);
    expect(await latestBox.isChecked({ timeout: 3000 })).toBe(!!options.useLatest);

    await jobFrame.fill('#txtJobDescription', `Playwright Link to Label Master (success) -- ${description}`, { timeout: 5000 });
    await fillSignature(jobFrame, { index: 1 });
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('LinkToLabelMaster/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);

    const job = await readJobDetail(page, 'LinkToLabelMaster/JobDetail');
    console.log(`link job [${description}]: status=${job.status} rows=${JSON.stringify(job.rows)}`);
    const row = job.rows.find((c) => c[0] === lcn);
    expect(row, `row for ${lcn} in: ${job.text}`).toBeTruthy();
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return { job, row: row! };
  }

  await test.step('A. v1, no options: no exact match and "Use Latest" off -> matching master not found', async () => {
    const { job, row } = await runLinkJob(lcnV1(), {}, 'A v1 no options');
    expect(row[4]).toBe('Error');
    expect(row[5]).toContain('Matching label master record not found');
    expect(job.status).toBe('CompletedWithErrors');
  });

  await test.step('B. v1, "Use Latest If No Exact Match": falls back to the latest master and links', async () => {
    const { job, row } = await runLinkJob(lcnV1(), { useLatest: true }, 'B v1 use latest');
    expect(row[4]).toBe('Updated');
    expect(job.status).toBe('Completed');

    const withMaster = await openLabelControlAndQuery(page, itemNumber, 'With Label Master');
    await expect(withMaster.locator('#grdLabelControl tr').filter({ hasText: itemNumber })).toHaveCount(2, { timeout: 10_000 });
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('C. v0, no options: already linked and "Update Existing" off -> already linked', async () => {
    const { job, row } = await runLinkJob(lcnV0(), {}, 'C v0 no options');
    expect(row[4]).toBe('Error');
    expect(row[5].toLowerCase()).toContain('already linked');
    expect(job.status).toBe('CompletedWithErrors');
  });

  await test.step('D. v0, "Update Existing Label Master Link": exact match, re-links', async () => {
    const { job, row } = await runLinkJob(lcnV0(), { updateExisting: true }, 'D v0 update existing');
    expect(row[4]).toBe('Updated');
    expect(job.status).toBe('Completed');
  });
});
