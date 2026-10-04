// MDM bulk Mass Approve on three fresh unapproved records (RobarMasterData). Web-only. Read back through the grid's
// "For Items" filter (Approved / Unapproved) so the outcome is observed from outside the job page itself.
//
//   - job page: "Mass Approve", "Items Selected: 3", Job Description + shared signature block, "Submit Job"
//   - validation: submitting with the form empty is refused client-side (no Job Detail page)
//   - success: Job Detail reaches Completed, all three records leave "Unapproved" and appear under "Approved"

import { test, expect } from '@playwright/test';
import { findFrame } from '../support/robar';
import * as mdm from '../support/master-data';

test('Mass Approve approves three unapproved records in one job', async ({ page }) => {
  test.setTimeout(420_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDA${stamp}`;
  const nums = ['A', 'B', 'C'].map((s) => prefix + s);

  await test.step('create three unapproved records', async () => {
    for (const n of nums) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  await test.step('all three show as Unapproved, none as Approved', async () => {
    const unapproved = await mdm.retrieve(page, frame, { value: prefix, forItems: 'Unapproved', expectRows: 3 });
    await expect(unapproved).toHaveCount(3);
    const approved = await mdm.retrieve(page, frame, { value: prefix, forItems: 'Approved', expectRows: 0 });
    await expect(approved).toHaveCount(0);
  });

  await test.step('Mass Approve job page: count and an empty submit is refused client-side', async () => {
    await mdm.retrieve(page, frame, { value: prefix, forItems: 'Unapproved', expectRows: 3 });
    await mdm.checkRows(frame, nums);
    await mdm.openBulkAction(frame, 'actMassApprove');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
    await expect(jobFrame.locator('body')).toContainText('Items Selected: 3');
    await jobFrame.getByRole('button', { name: /^Submit/ }).click({ timeout: 5000, noWaitAfter: true });
    await page.waitForTimeout(1500);
    const text = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`empty submit page text: ${text.slice(0, 500)}`);
    // Still on the job page: no Job Detail frame appeared.
    expect(page.frames().some((f) => /MasterDataMassApprove\/JobDetail/.test(f.url()))).toBe(false);
  });

  await test.step('submit the job: Completed, and the records are now Approved', async () => {
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
    await mdm.fillJobSignature(jobFrame, 'Playwright MDM Mass Approve', 'General Approval');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassApprove/JobDetail');
    console.log(`mass approve job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 900)}`);
    expect(job.status).toBe('Completed');
    for (const n of nums) expect(job.text).toContain(n);

    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: 'Master Data', exact: true }).click({ timeout: 10_000 });
    frame = await findFrame(page, 'MasterData');
    await page.waitForTimeout(1500);
    const approved = await mdm.retrieve(page, frame, { value: prefix, forItems: 'Approved', expectRows: 3 });
    await expect(approved).toHaveCount(3);
    const unapproved = await mdm.retrieve(page, frame, { value: prefix, forItems: 'Unapproved', expectRows: 0 });
    await expect(unapproved).toHaveCount(0);
  });
});
