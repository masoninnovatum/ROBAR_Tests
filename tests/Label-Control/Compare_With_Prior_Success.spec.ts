// Compare With Prior, SUCCESS path. Compare_With_Prior.spec.ts only covers the "no prior LCN" error
// path (two brand-new items). A "prior LCN" needs one item with two versions that each have an LCN, which
// Campaign Manager can create entirely in the web UI (no BarTender): create + approve an item, Save As New
// Version (jumps to version 1), approve that too, then ONE Assign Control Number job over both versions.
//
// Compare With Prior is then run over both records at once with "Allow use of Temporary Master" ticked (no
// Label Masters exist). Per-record results are independent: version 1 finds version 0's LCN as its prior and
// succeeds, version 0 has no prior and reports a per-record error, so the job ends CompletedWithErrors.
//
// Findings (details in robar-module-reference.md): the grid lists one row per item VERSION, each getting its
// own LCN from a single Assign Control Number job; the assignment job's detail table carries the version
// column, which is how this spec knows which LCN is which. Same Job Detail parsing note as elsewhere: cells
// are tab-separated in innerText.
//
// Confirmed reliable: 3 consecutive clean runs, ~2.0-2.1 minutes each, entirely headless.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

async function openLabelControlAndQuery(page: Page, itemNumber: string, attachmentsLabel: string = 'Any (Attachments)'): Promise<Frame> {
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

/** Checks every grid row for the item (with settle waits -- the selection count lags the DOM) and opens an action. */
async function selectAllRowsAndOpenAction(page: Page, frame: Frame, itemNumber: string, expectedRows: number, actionId: string): Promise<void> {
  const rows = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
  await expect(rows, `expected ${expectedRows} rows for ${itemNumber}`).toHaveCount(expectedRows, { timeout: 10_000 });
  for (let i = 0; i < expectedRows; i++) {
    await rows.nth(i).locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
  }
  await frame.click('#drpActions');
  await page.waitForTimeout(300);
  await frame.click(actionId, { force: true });
}

/** Polls a job's detail page to a terminal status and returns its text plus parsed per-record rows
 * (cells are tab-separated: LCN, item, label type, version, status, message). */
async function readJobDetail(page: Page, urlPart: string): Promise<{ text: string; status: string; rows: string[][] }> {
  let detailFrame = await findFrame(page, urlPart);
  await detailFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  let text = '';
  for (let attempt = 0; attempt < 40; attempt++) {
    text = await detailFrame.locator('body').innerText({ timeout: 3000 }).catch(() => '');
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

test('Compare With Prior succeeds for an item version whose prior version has an LCN', async ({ page }) => {
  test.setTimeout(600_000);
  // No login() here: cm.openCampaignManager (below) logs in itself, and a second login on an
  // already-logged-in page never finds the login form (and then waits out the whole test timeout).

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
    await selectAllRowsAndOpenAction(page, frame, itemNumber, 2, '#actAssignLabelControl');

    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.fill('#txtJobDescription', 'Playwright Compare With Prior (success) -- Assign Control Number', { timeout: 5000 });
    await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
    await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
    await jobFrame.selectOption('#sigReason', { index: 1 }, { timeout: 5000 });
    await jobFrame.fill('#sigComments', 'Assigned by Playwright test', { timeout: 5000 });
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    const job = await readJobDetail(page, 'MassAssign/JobDetail');
    console.log('assign job detail rows: ' + JSON.stringify(job.rows));
    expect(job.rows, `assign job detail: ${job.text}`).toHaveLength(2);
    for (const cells of job.rows) {
      lcnByVersion[cells[3]] = cells[0];
    }
    expect(Object.keys(lcnByVersion).sort(), `versions seen: ${JSON.stringify(job.rows)}`).toEqual(['0', '1']);
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('Compare With Prior over both versions: v1 finds v0 as its prior, v0 has none', async () => {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    await selectAllRowsAndOpenAction(page, frame, itemNumber, 2, '#actRedlineCompareWithPrior');

    const jobFrame = await findFrame(page, 'Redline/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await expect(jobFrame.locator('body')).toContainText('Selected Records: 2');

    await jobFrame.locator('#allowTempLabelMaster').check({ timeout: 5000 });
    await jobFrame.fill('#txtJobDescription', 'Playwright Compare With Prior (success path)', { timeout: 5000 });
    await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
    await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
    await jobFrame.selectOption('#sigReason', { index: 1 }, { timeout: 5000 });
    await jobFrame.fill('#sigComments', 'Compared by Playwright test', { timeout: 5000 });
    const submitBtn = jobFrame.locator('button[data-bind*="submitClick"]');
    await expect(submitBtn).toBeEnabled({ timeout: 5000 });
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('Redline/SubmitJob'), { timeout: 15_000 }),
      submitBtn.click({ timeout: 5000 }),
    ]);
    const submitBody = await submitResponse.json();
    expect(submitBody.Success, `SubmitJob failed: ${submitBody.ErrorString}`).toBe(true);

    const job = await readJobDetail(page, 'Redline/JobDetail');
    console.log('compare job detail text: ' + job.text.replace(/\s+/g, ' ').slice(0, 900));
    console.log('compare job rows: ' + JSON.stringify(job.rows));
    expect(job.rows, `compare job detail: ${job.text}`).toHaveLength(2);

    const v1 = job.rows.find((c) => c[0] === lcnByVersion['1']);
    const v0 = job.rows.find((c) => c[0] === lcnByVersion['0']);
    expect(v1, `row for the version-1 LCN ${lcnByVersion['1']}`).toBeTruthy();
    expect(v0, `row for the version-0 LCN ${lcnByVersion['0']}`).toBeTruthy();
    expect(v1![4], `v1 status: ${JSON.stringify(v1)}`).toBe('Completed');
    expect(v1![5], `v1 message: ${JSON.stringify(v1)}`).toContain(lcnByVersion['0']);
    expect(v0![4], `v0 status: ${JSON.stringify(v0)}`).toBe('Error');
    expect(v0![5], `v0 message: ${JSON.stringify(v0)}`).toContain('Prior LCN record not found.');
    expect(job.status).toBe('CompletedWithErrors');
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('the successful comparison was saved to ROBAR: only version 1 now has an attachment', async () => {
    // "Do not save to ROBAR" is unchecked by default, so the redline PDF is stored against the record
    // that succeeded. The errored version-0 record produced nothing.
    const frame = await openLabelControlAndQuery(page, itemNumber, 'With Attachments');
    const rows = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(rows).toHaveCount(1, { timeout: 10_000 });
    await expect(rows.first()).toContainText(lcnByVersion['1']);
  });
});
