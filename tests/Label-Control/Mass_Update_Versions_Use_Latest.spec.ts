// Mass Update Versions, "Use Latest Version" branches for the ITEM dimension (Template and Master Data stay on
// Keep Version). Mass_Update_Versions.spec.ts only covers Keep Version. Setup is web-only (no BarTender):
// one item with three versions -- v0 approved (the ONLY version given an LCN record), v1 approved, v2 unapproved.
// The Label Control grid orders an item's version rows randomly and doesn't show the version, so the LCN is
// assigned while only v0 exists (Label Control tab opened from the still-open Campaign Manager tab), and
// versions 1 and 2 are created afterwards with Save As New Version.
//
// One LC record, four jobs (MassUpdateVersionsService.cs, item switch):
//   J1  Use Latest Version, Allow Unapproved off:  v0 -> v1 (latest APPROVED)     -> Updated
//   J2  same again (record already on latest approved)                             -> Error "no latest approved found"
//   J3  Use Latest Version + Allow Unapproved:     v1 -> v2 (latest, unapproved)  -> Updated
//   J4  same again (record already on latest)                                      -> Error "no latest version found"
// The record's resulting version is read back from each job's Job Detail row and from Update Versions' item select.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';
const CM_TAB = 'li.ui-tabs-tab:has-text("Campaign Manager")';

async function openLabelControlAndQuery(page: Page, itemNumber: string): Promise<Frame> {
  await page.locator(LC_TAB_CLOSE).click({ timeout: 2000 }).catch(() => {});
  // The menu buttons only exist on the Main Menu tab; with the Campaign Manager tab still open and active
  // the click would otherwise wait (unbounded) for an invisible button.
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(500);
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

async function fillSignature(jobFrame: Frame): Promise<void> {
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  await jobFrame.selectOption('#sigReason', { index: 1 }, { timeout: 5000 });
  await jobFrame.fill('#sigComments', 'Playwright Mass Update Versions (use latest) test', { timeout: 5000 });
}

test('Mass Update Versions: Use Latest Version, with and without Allow Unapproved, for the Item dimension', async ({ page }) => {
  test.setTimeout(900_000);
  // No login() here: cm.openCampaignManager logs in itself.

  let itemNumber = '';
  let lcn = '';
  let editFrameV0: Frame;

  await test.step('create and approve item v0 (Campaign Manager tab stays open)', async () => {
    const cmFrame = await cm.openCampaignManager(page);
    const created = await cm.createItem(page, cmFrame);
    itemNumber = created.itemNumber;
    await cm.openItemAction(created.editFrame, 'Approve Item');
    const approve0 = await cm.submitSignatureDialog(page, created.editFrame, '#approveItemDialog', 'ApproveItem');
    expect(approve0.Success, `approve v0 failed: ${JSON.stringify(approve0)}`).toBe(true);
    editFrameV0 = created.editFrame;
  });

  await test.step('assign an LCN to v0 while it is the only version', async () => {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    const rows = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    await expect(rows).toHaveCount(1, { timeout: 10_000 });
    await rows.first().locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actAssignLabelControl', { force: true });

    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.fill('#txtJobDescription', 'Playwright Mass Update Versions (use latest) -- Assign Control Number', { timeout: 5000 });
    await fillSignature(jobFrame);
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);
    const job = await readJobDetail(page, 'MassAssign/JobDetail');
    expect(job.rows, `assign job detail: ${job.text}`).toHaveLength(1);
    expect(job.rows[0][3]).toBe('0');
    lcn = job.rows[0][0];
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('back on the Campaign Manager tab: v1 (approved) and v2 (unapproved) via Save As New Version', async () => {
    await page.locator(CM_TAB).click({ timeout: 5000 });
    await page.waitForTimeout(1000);
    let frame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
    let [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/SaveAsNewItemVersion'), { timeout: 15_000 }),
      cm.openItemAction(frame, 'Save As New Version'),
    ]);
    expect((await resp.json()).Success).toBe(true);

    const v1Url = `items/edit?itemnumber=${itemNumber.toLowerCase()}&labeltype=${encodeURIComponent(cm.LABEL_TYPE.toLowerCase())}&versionnumber=1`;
    frame = await findFrame(page, v1Url);
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await cm.openItemAction(frame, 'Approve Item');
    const approve1 = await cm.submitSignatureDialog(page, frame, '#approveItemDialog', 'ApproveItem');
    expect(approve1.Success, `approve v1 failed: ${JSON.stringify(approve1)}`).toBe(true);
    await page.waitForTimeout(1500);

    frame = await findFrame(page, v1Url);
    [resp] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/items/SaveAsNewItemVersion'), { timeout: 15_000 }),
      cm.openItemAction(frame, 'Save As New Version'),
    ]);
    expect((await resp.json()).Success).toBe(true);
    await page.waitForTimeout(1500);
    await page.locator(`${CM_TAB} .ui-icon-close`).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
  });

  /** One Mass Update Versions job on the LC record: Item = Use Latest Version (optionally Allow Unapproved). */
  async function runMassUpdate(allowUnapproved: boolean, description: string) {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    const row = frame.locator('#grdLabelControl tr').filter({ hasText: lcn });
    await expect(row, `expected one row for ${lcn}`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actUpdateVersions', { force: true });

    const jobFrame = await findFrame(page, 'MassUpdateVersions/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.selectOption('#drpItemVersion', { label: 'Use Latest Version' }, { timeout: 5000 });
    await jobFrame.selectOption('#drpTemplateVersion', { label: 'Keep Version' }, { timeout: 5000 });
    await jobFrame.selectOption('#drpMDVersion', { label: 'Keep Version' }, { timeout: 5000 });
    // Allow Unapproved only appears when the dropdown is on Use Latest Version.
    const allowBox = jobFrame.locator('#itemAllowUnapproved');
    await expect(allowBox).toBeVisible({ timeout: 5000 });
    if (allowUnapproved) {
      await allowBox.check({ timeout: 5000 });
    } else {
      await allowBox.uncheck({ timeout: 5000 });
    }
    await jobFrame.fill('#txtJobDescription', `Playwright Mass Update Versions (use latest) -- ${description}`, { timeout: 5000 });
    await fillSignature(jobFrame);
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassUpdateVersions/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#SubmitButton', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);

    const job = await readJobDetail(page, 'MassUpdateVersions/JobDetail');
    console.log(`mass update [${description}]: status=${job.status} rows=${JSON.stringify(job.rows)}`);
    const row2 = job.rows.find((c) => c[0] === lcn);
    expect(row2, `row for ${lcn} in: ${job.text}`).toBeTruthy();
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return { job, row: row2! };
  }

  await test.step('J1: Use Latest Version -> latest approved (v1), Updated', async () => {
    const { job, row } = await runMassUpdate(false, 'J1 latest approved');
    expect(row[4]).toBe('Updated');
    expect(row[5]).toContain('Successfully updated: Item version');
    expect(job.status).toBe('Completed');
  });

  await test.step('J2: again -> already on latest approved, Error', async () => {
    const { job, row } = await runMassUpdate(false, 'J2 latest approved again');
    expect(row[4]).toBe('Error');
    expect(row[5]).toContain('no latest approved found');
    expect(job.status).toBe('CompletedWithErrors');
  });

  await test.step('J3: Use Latest Version + Allow Unapproved -> v2, Updated', async () => {
    const { job, row } = await runMassUpdate(true, 'J3 allow unapproved');
    expect(row[4]).toBe('Updated');
    expect(row[5]).toContain('Successfully updated: Item version');
    expect(job.status).toBe('Completed');
  });

  await test.step('J4: again with Allow Unapproved -> already on latest, Error', async () => {
    const { job, row } = await runMassUpdate(true, 'J4 allow unapproved again');
    expect(row[4]).toBe('Error');
    expect(row[5]).toContain('no latest version found');
    expect(job.status).toBe('CompletedWithErrors');
  });
});
