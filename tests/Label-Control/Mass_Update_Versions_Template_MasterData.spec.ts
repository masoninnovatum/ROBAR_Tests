// Mass Update Versions, "Use Latest Version" for the TEMPLATE and MASTER DATA dimensions (the Item dimension is
// Mass_Update_Versions_Use_Latest.spec.ts). Setup is web-only (no BarTender): an UNAPPROVED Master Data record is
// created first (as in Update_Versions.spec.ts), then an approved item on the 'A1SuperTemplate' fixture, then an
// LCN -- Assign Control Number does NOT link an unapproved MD record, so the LC record's Master Data Version is null.
// One LC record, five jobs (MassUpdateVersionsService.cs, template / masterdata switches):
//   J1 Template = Use Latest (approved), others Keep      -> record is already on the latest template version
//                                                            -> Error "Could not update Template version, no latest approved found."
//   J2 Master Data = Use Latest (approved), others Keep   -> the only MD record is unapproved
//                                                            -> Error "Could not update Master Data version, no latest approved found."
//   J3 Template + Master Data = Use Latest (approved)     -> both messages merged into one
//   J4 Template = Use Latest (approved, fails) + Master Data = Use Latest + Allow Unapproved (succeeds)
//                                                         -> PARTIAL: "Successfully updated: Master Data version." followed by
//                                                            the template failure; the row status is still Error
//   J5 Master Data = Use Latest + Allow Unapproved again  -> Error "Could not update Master Data version, no latest version found."

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as mdm from '../support/master-data';

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

async function openLabelControlAndQuery(page: Page, itemNumber: string): Promise<Frame> {
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
  await jobFrame.fill('#sigComments', 'Playwright Mass Update Versions (template / master data) test', { timeout: 5000 });
}

async function createUnapprovedMasterData(page: Page, itemNumber: string): Promise<void> {
  await openMenuItem(page, 'Master Data');
  const mdmFrame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1000);
  await mdm.selectSchema(mdmFrame, 'RobarMasterData');
  await mdm.openNewRecordAction(mdmFrame);
  await mdm.submitNewItemDialog(page, mdmFrame, itemNumber, 'Playwright Mass Update Versions master data');
  await expect(mdmFrame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 15_000 });
  await mdm.setItemDescription(mdmFrame, 'Playwright Mass Update Versions master data');
  await mdm.selectDropdownFieldByCaption(mdmFrame, 'Labeler Duns Number', 'Innovatum');
  await mdm.fillFieldByCaption(mdmFrame, 'Primary DI Number', '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await mdm.fillFieldByCaption(mdmFrame, 'Brand Name', 'Mass Update Versions Test Brand');
  await mdm.saveRecord(page, mdmFrame);
  await expect(mdmFrame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
}

type Dimension = 'Keep Version' | 'Use Latest Version';
type Options = { template?: Dimension; templateAllow?: boolean; masterData?: Dimension; masterDataAllow?: boolean };

test('Mass Update Versions: Use Latest for the Template and Master Data dimensions, incl. a partial success', async ({ page }) => {
  test.setTimeout(900_000);

  const itemNumber = 'MBLCMD' + Date.now().toString().slice(-7);
  let lcn = '';

  await test.step('unapproved Master Data record, approved item, then an LCN', async () => {
    await login(page);
    // Master Data first (as Update_Versions.spec.ts does) so it exists, but unapproved, when the LCN is assigned.
    await createUnapprovedMasterData(page, itemNumber);
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.locator('button.menuIcon:has-text("Campaign Manager")').waitFor({ state: 'visible', timeout: 10_000 });
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame2 = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1000);
    await cmFrame2.click('#btnCreateNew');
    await cmFrame2.waitForSelector('#txtItemNumber', { state: 'visible', timeout: 10_000 });
    await cmFrame2.fill('#txtItemNumber', itemNumber);
    await cmFrame2.selectOption('#ddlLabelType', cm.LABEL_TYPE);
    await cmFrame2.click('.ui-dialog-buttonpane button:has-text("Submit")');
    const editFrame = await findFrame(page, 'items/edit');
    await editFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(500);
    await editFrame.selectOption('select[name="txtTemplateName"]', cm.TEMPLATE);
    await editFrame.fill('input[name="txtDescription"]', 'Playwright Mass Update Versions template/MD item');
    await editFrame.click('button:has-text("Save")');
    await page.waitForTimeout(1500);
    await cm.openItemAction(editFrame, 'Approve Item');
    const approve = await cm.submitSignatureDialog(page, editFrame, '#approveItemDialog', 'ApproveItem');
    expect(approve.Success, `approve failed: ${JSON.stringify(approve)}`).toBe(true);
    await page.waitForTimeout(1000);
    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    let frame!: Frame;
    let row = null as unknown as ReturnType<Frame['locator']>;
    for (let attempt = 0; attempt < 3; attempt++) {
      frame = await openLabelControlAndQuery(page, itemNumber);
      row = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
      if ((await row.count().catch(() => 0)) === 1) break;
      await page.waitForTimeout(4000);
      if ((await row.count().catch(() => 0)) === 1) break;
    }
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actAssignLabelControl', { force: true });
    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.fill('#txtJobDescription', 'Playwright Mass Update Versions (template / MD) -- Assign Control Number', { timeout: 5000 });
    await fillSignature(jobFrame);
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);
    const job = await readJobDetail(page, 'MassAssign/JobDetail');
    expect(job.rows, `assign job detail: ${job.text}`).toHaveLength(1);
    expect(job.rows[0][4], `assign: ${job.text}`).toBe('Completed');
    lcn = job.rows[0][0];
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  /** One Mass Update Versions job on the record; Item is always Keep Version here. */
  async function runMassUpdate(options: Options, description: string) {
    let frame!: Frame;
    let row = null as unknown as ReturnType<Frame['locator']>;
    for (let attempt = 0; attempt < 3; attempt++) {
      frame = await openLabelControlAndQuery(page, itemNumber);
      row = frame.locator('#grdLabelControl tr').filter({ hasText: lcn });
      if ((await row.count().catch(() => 0)) === 1) break;
      await page.waitForTimeout(4000);
      if ((await row.count().catch(() => 0)) === 1) break;
    }
    await expect(row, `expected one row for ${lcn}`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actUpdateVersions', { force: true });

    const jobFrame = await findFrame(page, 'MassUpdateVersions/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.selectOption('#drpItemVersion', { label: 'Keep Version' }, { timeout: 5000 });
    await jobFrame.selectOption('#drpTemplateVersion', { label: options.template ?? 'Keep Version' }, { timeout: 5000 });
    await jobFrame.selectOption('#drpMDVersion', { label: options.masterData ?? 'Keep Version' }, { timeout: 5000 });
    // The Allow Unapproved boxes only show while their dropdown is on Use Latest Version.
    if (options.template === 'Use Latest Version') {
      const box = jobFrame.locator('#templateAllowUnapproved');
      if (options.templateAllow) await box.check({ timeout: 5000 }); else await box.uncheck({ timeout: 5000 });
    }
    if (options.masterData === 'Use Latest Version') {
      const box = jobFrame.locator('#masterDataAllowUnapproved');
      if (options.masterDataAllow) await box.check({ timeout: 5000 }); else await box.uncheck({ timeout: 5000 });
    }
    await jobFrame.fill('#txtJobDescription', `Playwright Mass Update Versions (template / MD) -- ${description}`, { timeout: 5000 });
    await fillSignature(jobFrame);
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassUpdateVersions/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#SubmitButton', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);
    const job = await readJobDetail(page, 'MassUpdateVersions/JobDetail');
    console.log(`mass update [${description}]: status=${job.status} rows=${JSON.stringify(job.rows)}`);
    const found = job.rows.find((c) => c[0] === lcn);
    expect(found, `row for ${lcn} in: ${job.text}`).toBeTruthy();
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return { job, row: found! };
  }

  await test.step('J1: Template = Use Latest -> already on the latest approved template version', async () => {
    const { job, row } = await runMassUpdate({ template: 'Use Latest Version' }, 'J1 template latest');
    expect(row[4]).toBe('Error');
    expect(row[5]).toContain('Could not update Template version, no latest approved found.');
    expect(job.status).toBe('CompletedWithErrors');
  });

  await test.step('J2: Master Data = Use Latest -> the only MD record is unapproved', async () => {
    const { job, row } = await runMassUpdate({ masterData: 'Use Latest Version' }, 'J2 md latest approved');
    expect(row[4]).toBe('Error');
    expect(row[5]).toContain('Could not update Master Data version, no latest approved found.');
    expect(job.status).toBe('CompletedWithErrors');
  });

  await test.step('J3: Template + Master Data = Use Latest -> both failures reported in one message', async () => {
    const { row } = await runMassUpdate({ template: 'Use Latest Version', masterData: 'Use Latest Version' }, 'J3 both');
    expect(row[4]).toBe('Error');
    expect(row[5]).toMatch(/Template.*Master Data.*no latest approved found/);
  });

  await test.step('J4: Master Data = Use Latest + Allow Unapproved succeeds while Template = Use Latest fails (partial)', async () => {
    const { job, row } = await runMassUpdate(
      { template: 'Use Latest Version', masterData: 'Use Latest Version', masterDataAllow: true },
      'J4 partial'
    );
    expect(row[4], 'a partial success is still an Error row').toBe('Error');
    // The message cell can wrap onto a second line, so read the whole Job Detail text.
    const flat = job.text.replace(/\s+/g, ' ');
    console.log(`J4 full job detail text: ${flat.slice(0, 700)}`);
    expect(flat).toContain('Successfully updated: Master Data version.');
    expect(flat).toContain('Could not update Template version, no latest approved found.');
    expect(job.status).toBe('CompletedWithErrors');
  });

  await test.step('J5: Master Data = Use Latest + Allow Unapproved again -> already on the latest MD version', async () => {
    const { row } = await runMassUpdate({ masterData: 'Use Latest Version', masterDataAllow: true }, 'J5 md again');
    expect(row[4]).toBe('Error');
    expect(row[5]).toContain('Could not update Master Data version, no latest version found.');
  });
});
