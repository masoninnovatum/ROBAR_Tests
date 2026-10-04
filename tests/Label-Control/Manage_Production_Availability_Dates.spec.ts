// Manage Production Availability beyond the plain Release run that Manage_Production_Availability.spec.ts covers:
// the Effective Begin / Effective End date fields, un-releasing, multi-field jobs and the validation paths.
// One brand-new item with one LCN (no BarTender). The outcome of each job is read back through the Label Control
// "LCN Status" filter -- "Active Only" = inside the effective window AND released AND allow-print;
// "Unreleased Only" = not released -- so the record's state is observed from outside the job itself.
//
//   stage                              Active Only   Unreleased Only
//   S0 freshly assigned                     0              1
//   S1 Release (box ticked)                 1              0
//   S2 Effective Begin/End in the past      0              0   (still released, window expired)
//   S3 window restored (end 12/31/2099)     1              0
//   S4 Release unticked (un-release)        0              1
//
// Validation paths: Begin >= End in one job (blocked at submit with the "Effective end date must be greater than
// effective begin" dialog), the same field twice (client-side dialog), "Add Field To Update" caps at 3 fields, and an
// End date earlier than the record's EXISTING begin (record-level Error in Job Detail, record unchanged).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';

const LC_TAB_CLOSE = 'li.ui-tabs-tab:has-text("Label Control") .ui-icon-close';

async function openLabelControlAndQuery(page: Page, itemNumber: string, statusLabel = 'All (LCN Status)'): Promise<Frame> {
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
  await frame.locator('#drpApproved').selectOption({ label: statusLabel });
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

async function fillSignature(jobFrame: Frame, reason: string | { index: number }): Promise<void> {
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  await jobFrame.selectOption('#sigReason', reason as any, { timeout: 5000 });
  await jobFrame.fill('#sigComments', 'Playwright Manage Production Availability dates test', { timeout: 5000 });
}

type FieldUpdate = { field: 'Release' | 'Effective Begin' | 'Effective End'; value?: string | boolean };

test('Manage Production Availability: effective dates, un-release, multi-field and validation paths', async ({ page }) => {
  test.setTimeout(900_000);
  // No login() here: cm.openCampaignManager logs in itself.

  let itemNumber = '';
  let lcn = '';

  await test.step('create and approve an item, assign it an LCN', async () => {
    const cmFrame = await cm.openCampaignManager(page);
    const created = await cm.createItem(page, cmFrame);
    itemNumber = created.itemNumber;
    await cm.openItemAction(created.editFrame, 'Approve Item');
    const approve = await cm.submitSignatureDialog(page, created.editFrame, '#approveItemDialog', 'ApproveItem');
    expect(approve.Success, `approve failed: ${JSON.stringify(approve)}`).toBe(true);
    await page.waitForTimeout(1000);
    await page.locator('li.ui-tabs-tab:has-text("Campaign Manager") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);

    // A just-created item can be missing from the first grid query (grid still loading / not yet indexed): re-query.
    let frame!: Frame;
    let rows = null as unknown as ReturnType<Frame['locator']>;
    for (let attempt = 0; attempt < 3; attempt++) {
      frame = await openLabelControlAndQuery(page, itemNumber);
      rows = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
      if ((await rows.count().catch(() => 0)) === 1) break;
      await page.waitForTimeout(4000);
      if ((await rows.count().catch(() => 0)) === 1) break;
    }
    await expect(rows).toHaveCount(1, { timeout: 10_000 });
    await rows.first().locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actAssignLabelControl', { force: true });
    const jobFrame = await findFrame(page, 'MassAssign/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1000);
    await jobFrame.fill('#txtJobDescription', 'Playwright Manage Production Availability dates -- Assign Control Number', { timeout: 5000 });
    await fillSignature(jobFrame, { index: 1 });
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('MassAssign/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    expect((await submitResponse.json()).Success).toBe(true);
    const job = await readJobDetail(page, 'MassAssign/JobDetail');
    expect(job.rows, `assign job detail: ${job.text}`).toHaveLength(1);
    lcn = job.rows[0][0];
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
  });

  /** Row count (0 or 1) for the item under one LCN Status filter option. */
  async function countUnder(frame: Frame, statusLabel: string, expected: number): Promise<number> {
    // Same open Label Control tab and item filter: only the LCN Status dropdown changes, then Retrieve again.
    await frame.locator('#drpApproved').selectOption({ label: statusLabel });
    await frame.click('#btnRetrieveData');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(800);
    const rows = frame.locator('#grdLabelControl tr').filter({ hasText: itemNumber });
    // The grid can still be loading when the settle wait ends (a first read of 0 for a record that exists was
    // seen): when a row is expected, poll for it; when none is expected, require two zero reads 2s apart.
    let n = await rows.count();
    for (let attempt = 0; attempt < 10; attempt++) {
      if (expected > 0 && n === expected) break;
      if (expected === 0 && n === 0 && attempt >= 1) break;
      await page.waitForTimeout(expected === 0 ? 2000 : 1000);
      n = await rows.count();
    }
    return n;
  }
  async function expectState(label: string, active: number, unreleased: number) {
    const frame = await openLabelControlAndQuery(page, itemNumber);
    const actual = {
      all: await countUnder(frame, 'All (LCN Status)', 1),
      active: await countUnder(frame, 'Active Only', active),
      unreleased: await countUnder(frame, 'Unreleased Only', unreleased),
    };
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    console.log(`state [${label}]: ${JSON.stringify(actual)}`);
    expect(actual, `state after ${label}`).toEqual({ all: 1, active, unreleased });
  }

  /** Opens the Manage Production Availability job page for the record and fills the field rows (not yet submitted). */
  async function openJobAndFill(fields: FieldUpdate[], description: string): Promise<Frame> {
    // The grid can still be loading when the fixed settle wait ends, so re-run the query if the row isn't there.
    let frame!: Frame;
    let row = null as unknown as ReturnType<Frame['locator']>;
    for (let attempt = 0; attempt < 3; attempt++) {
      frame = await openLabelControlAndQuery(page, itemNumber);
      row = frame.locator('#grdLabelControl tr').filter({ hasText: lcn });
      if ((await row.count().catch(() => 0)) === 1) break;
      await page.waitForTimeout(4000);
      if ((await row.count().catch(() => 0)) === 1) break;
    }
    await expect(row).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check();
    await page.waitForTimeout(500);
    await frame.click('#drpActions');
    await page.waitForTimeout(300);
    await frame.click('#actManageProduct', { force: true });

    const jobFrame = await findFrame(page, 'ManageProduction/JobSubmission');
    await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(1500);

    for (let i = 0; i < fields.length; i++) {
      if (i > 0) {
        await jobFrame.getByText('Add Field To Update', { exact: true }).click({ timeout: 5000 });
        await page.waitForTimeout(500);
      }
      const block = jobFrame.locator('#controlBlock').nth(i);
      await block.locator('select').selectOption({ label: fields[i].field }, { timeout: 5000 });
      await page.waitForTimeout(500);
      const value = fields[i].value;
      if (fields[i].field === 'Release') {
        if (typeof value === 'boolean') {
          const box = block.locator('#AllowPrint');
          if (value) await box.check({ timeout: 5000 }); else await box.uncheck({ timeout: 5000 });
        }
      } else if (typeof value === 'string') {
        // The date inputs are readonly jQuery UI datepickers (default today, shown as M/d/yyyy), so they can't be
        // typed into; drive the widget's own setDate API, which updates the input value the submit handler reads.
        const input = block.locator(fields[i].field === 'Effective Begin' ? '#EffectiveBegin' : '#EffectiveEnd');
        const [mm, dd, yyyy] = value.split('/').map((p) => parseInt(p, 10));
        await input.evaluate(
          (el, [y, m, d]) => {
            (window as any).jQuery(el).datepicker('setDate', new Date(y, m - 1, d));
          },
          [yyyy, mm, dd],
          { timeout: 5000 }
        );
        console.log(`${fields[i].field} input now shows: ${await input.inputValue({ timeout: 3000 })}`);
      }
    }
    await jobFrame.fill('#txtJobDescription', `Playwright Manage Production Availability dates -- ${description}`, { timeout: 5000 });
    await fillSignature(jobFrame, { label: 'General' } as any);
    await page.waitForTimeout(500);
    return jobFrame;
  }

  /** Submits the filled job and returns the Job Detail row for the record. */
  async function submitJob(jobFrame: Frame) {
    const [submitResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('ManageProduction/SubmitJob'), { timeout: 15_000 }),
      jobFrame.click('#submitBtn', { timeout: 5000 }),
    ]);
    const body = await submitResponse.json();
    expect(body.Success, `SubmitJob failed: ${body.ErrorString}`).toBe(true);
    const job = await readJobDetail(page, 'ManageProduction/JobDetail');
    console.log(`manage production: status=${job.status} rows=${JSON.stringify(job.rows)}`);
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return job;
  }

  /** Submits expecting a client-side/server-side rejection shown as an error dialog; returns the dialog text. */
  async function submitExpectingDialog(jobFrame: Frame): Promise<string> {
    await jobFrame.click('#submitBtn', { timeout: 5000 });
    const dialog = jobFrame.locator('.ui-dialog:visible');
    await expect(dialog.first()).toBeVisible({ timeout: 10_000 });
    const text = (await dialog.first().innerText({ timeout: 3000 })).replace(/\s+/g, ' ').trim();
    console.log(`dialog: ${text}`);
    await page.locator(LC_TAB_CLOSE).click({ timeout: 5000 }).catch(() => {});
    return text;
  }

  await test.step('S0: freshly assigned record is unreleased', async () => {
    await expectState('S0 assigned', 0, 1);
  });

  await test.step('S1: Release (default field, box ticked) -> Active', async () => {
    const jobFrame = await openJobAndFill([{ field: 'Release', value: true }], 'S1 release');
    const job = await submitJob(jobFrame);
    expect(job.status).toBe('Completed');
    expect(job.text).toContain('Updated');
    await expectState('S1 released', 1, 0);
  });

  await test.step('S2: Effective Begin + End set to a past window -> released but no longer Active', async () => {
    const jobFrame = await openJobAndFill(
      [{ field: 'Effective Begin', value: '01/01/2020' }, { field: 'Effective End', value: '01/02/2020' }],
      'S2 past window'
    );
    const job = await submitJob(jobFrame);
    expect(job.status).toBe('Completed');
    expect(job.text).toContain('Updated');
    await expectState('S2 past window', 0, 0);
  });

  await test.step('S3: window restored (end 12/31/2099) -> Active again', async () => {
    const jobFrame = await openJobAndFill(
      [{ field: 'Effective Begin', value: '01/01/2020' }, { field: 'Effective End', value: '12/31/2099' }],
      'S3 restore window'
    );
    const job = await submitJob(jobFrame);
    expect(job.status).toBe('Completed');
    await expectState('S3 restored', 1, 0);
  });

  await test.step('record-level validation: an End date earlier than the existing Begin is an Error row, record unchanged', async () => {
    const jobFrame = await openJobAndFill([{ field: 'Effective End', value: '01/01/2000' }], 'record-level end before begin');
    const job = await submitJob(jobFrame);
    expect(job.status).toBe('CompletedWithErrors');
    expect(job.text).toContain('Effective end date must be greater than effective begin');
    await expectState('after rejected end date', 1, 0);
  });

  await test.step('submit-level validation: Begin >= End in the same job shows the error dialog and nothing is sent', async () => {
    const jobFrame = await openJobAndFill(
      [{ field: 'Effective Begin', value: '06/01/2030' }, { field: 'Effective End', value: '06/01/2030' }],
      'begin equals end'
    );
    const text = await submitExpectingDialog(jobFrame);
    expect(text).toContain('Effective end date must be greater than effective begin');
  });

  await test.step('client-side validation: the same field twice is rejected; Add Field To Update caps at three', async () => {
    const jobFrame = await openJobAndFill(
      [{ field: 'Release', value: true }, { field: 'Release', value: true }, { field: 'Release', value: true }],
      'duplicate fields'
    );
    await expect(jobFrame.locator('#controlBlock')).toHaveCount(3);
    await expect(jobFrame.getByText('Add Field To Update', { exact: true })).toBeHidden({ timeout: 5000 });
    const text = await submitExpectingDialog(jobFrame);
    expect(text).toContain('Field To Update cannot be set to same value more than once');
  });

  await test.step('S4: Release unticked (un-release) in a multi-field job -> unreleased again', async () => {
    const jobFrame = await openJobAndFill(
      [{ field: 'Release', value: false }, { field: 'Effective End', value: '12/31/2098' }],
      'S4 un-release + end date'
    );
    const job = await submitJob(jobFrame);
    expect(job.status).toBe('Completed');
    expect(job.text).toContain('Updated');
    await expectState('S4 un-released', 0, 1);
  });
});
