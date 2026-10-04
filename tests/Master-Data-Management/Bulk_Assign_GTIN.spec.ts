// MDM bulk Assign GTIN on two fresh unapproved records. Web-only.
//   1. Unit of Use DI Number (empty on a new record) + Company Prefix "Innovatum" -> each record gets a generated GTIN
//   2. Primary DI Number (already filled) -> the overwrite confirmation warning appears before the job runs
//   3. An APPROVED record is refused ("Only active, unapproved items can be submitted ...")

import { test, expect } from '@playwright/test';
import * as mdm from '../support/master-data';

test('Assign GTIN generates GTINs, warns before overwriting, and refuses approved records', async ({ page }) => {
  test.setTimeout(480_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDT${stamp}`;
  const [a, b, c] = ['A', 'B', 'C'].map((s) => prefix + s);

  await test.step('create A, B, C; approve C', async () => {
    for (const n of [a, b, c]) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [c]);
    await mdm.openBulkAction(frame, 'actMassApprove');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM approve C', 'General Approval');
    expect((await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassApprove/JobDetail')).status).toBe('Completed');
  });

  const openAssign = async (items: string[]) => {
    frame = await mdm.reopenMasterData(page);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, items);
    await mdm.openBulkAction(frame, 'actAssignGTIN');
    return mdm.openJobPage(page, 'MasterDataAssignGTIN/JobSubmission');
  };

  await test.step('Unit of Use DI Number + Company Prefix: a GTIN is generated for each record', async () => {
    const jobFrame = await openAssign([a, b]);
    await expect(jobFrame.locator('body')).toContainText('Selected Item Count: 2');
    const selects = jobFrame.locator('select:not(#sigReason)');
    console.log(`field options: ${JSON.stringify(await selects.nth(0).locator('option').allInnerTexts())}`);
    console.log(`prefix options: ${JSON.stringify(await selects.nth(1).locator('option').allInnerTexts())}`);
    await selects.nth(0).selectOption({ label: 'Unit of Use DI Number' }, { timeout: 5000 });
    await selects.nth(1).selectOption({ label: 'Innovatum' }, { timeout: 5000 });
    console.log(`packaging code default: "${await jobFrame.locator('input[type="text"]:not(#sigUser):not(#sigComments):not(#txtJobDescription)').first().inputValue()}"`);
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM Assign GTIN');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataAssignGTIN/JobDetail');
    console.log(`assign gtin job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 900)}`);
    expect(job.status).toBe('Completed');
    for (const n of [a, b]) expect(job.text).toContain(n);
    // Each record's generated GTIN is a 14-digit number in the Job Detail grid.
    const gtins = job.text.match(/\b\d{14}\b/g) ?? [];
    console.log(`generated GTINs: ${JSON.stringify(gtins)}`);
    expect(new Set(gtins).size, 'two distinct 14-digit GTINs').toBeGreaterThanOrEqual(2);
  });

  await test.step('Primary DI Number already has a value: the overwrite warning appears', async () => {
    const jobFrame = await openAssign([a, b]);
    const selects = jobFrame.locator('select:not(#sigReason)');
    await selects.nth(1).selectOption({ label: 'Innovatum' }, { timeout: 5000 });
    // The warning fires as soon as a field that already holds a GTIN is chosen (not at submit time), and the
    // page keeps Submit disabled while it is up.
    await selects.nth(0).selectOption({ label: 'Primary DI Number' }, { timeout: 5000 });
    await expect(jobFrame.locator('.ui-dialog:visible').first()).toBeVisible({ timeout: 10_000 });
    const text = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`overwrite dialog (page text): ${text.slice(-260)}`);
    expect(text).toContain('already have a GTIN assigned to this field');
    await jobFrame.locator('.ui-dialog:visible button').filter({ hasText: /Continue|OK|Close|Cancel/i }).first().click({ timeout: 5000 });
  });

  await test.step('an approved record is refused', async () => {
    // The refusal shows as soon as the job page opens for an approved record: the form is not even rendered.
    const jobFrame = await openAssign([c]);
    await page.waitForTimeout(2000);
    const body = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`approved record job page: ${body.slice(0, 400)}`);
    expect(body).toContain('Only active, unapproved items can be submitted to the Assign GTIN');
    expect(await jobFrame.locator('select:not(#sigReason)').count(), 'no Field to Update controls are offered').toBe(0);
  });
});
