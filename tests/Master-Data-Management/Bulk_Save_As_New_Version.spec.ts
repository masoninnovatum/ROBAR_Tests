// MDM bulk "Save as New Version": unapproved records are refused ("not eligible"); approved ones get a Version 1.
// Web-only. A (unapproved) is selected alone first, then B + C (approved via a Mass Approve job) are versioned together.

import { test, expect } from '@playwright/test';
import * as mdm from '../support/master-data';

test('bulk Save as New Version refuses unapproved records and versions approved ones', async ({ page }) => {
  test.setTimeout(480_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDV${stamp}`;
  const [a, b, c] = ['A', 'B', 'C'].map((s) => prefix + s);

  await test.step('create A, B, C; approve B and C with a Mass Approve job', async () => {
    for (const n of [a, b, c]) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [b, c]);
    await mdm.openBulkAction(frame, 'actMassApprove');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM approve for versioning', 'General Approval');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassApprove/JobDetail');
    expect(job.status).toBe('Completed');
  });

  await test.step('an unapproved record is not eligible for a new version', async () => {
    frame = await mdm.reopenMasterData(page);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [a]);
    await mdm.openBulkAction(frame, 'actSaveAsNew');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataSaveAsNew/JobSubmission');
    const text = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`save as new (unapproved): ${text.slice(0, 300)}`);
    expect(text).toContain('Items not eligible for new version: 1');
  });

  await test.step('approved B + C: the job page, then Version 1 appears for both', async () => {
    frame = await mdm.reopenMasterData(page);
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 3 });
    await mdm.checkRows(frame, [b, c]);
    await mdm.openBulkAction(frame, 'actSaveAsNew');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataSaveAsNew/JobSubmission');
    const text = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`save as new (approved): ${text.slice(0, 400)}`);
    const controls = await jobFrame.evaluate(() =>
      Array.from(document.querySelectorAll('input, select, button')).filter((e) => (e as HTMLElement).offsetParent).map((e) => `${e.tagName.toLowerCase()}#${(e as HTMLElement).id}[${(e as HTMLInputElement).type ?? ''}]:${(e as HTMLElement).innerText?.slice(0, 15) ?? ''}`)
    );
    console.log(`save as new (approved) controls: ${JSON.stringify(controls)}`);
    expect(text).not.toContain('not eligible');
    if ((await jobFrame.locator('#sigUser').count()) > 0) {
      await mdm.fillJobSignature(jobFrame, 'Playwright MDM bulk new version');
    }
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataSaveAsNew/JobDetail');
    console.log(`save as new job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 800)}`);
    expect(job.status).toBe('Completed');

    frame = await mdm.reopenMasterData(page);
    // Latest Version Only is unchecked by default, so both versions of each record are listed.
    const rows = await mdm.retrieve(page, frame, { value: prefix, expectRows: 5 });
    await expect(rows).toHaveCount(5);
    for (const n of [b, c]) await expect(rows.filter({ hasText: n })).toHaveCount(2);
    await expect(rows.filter({ hasText: a })).toHaveCount(1);
  });
});
