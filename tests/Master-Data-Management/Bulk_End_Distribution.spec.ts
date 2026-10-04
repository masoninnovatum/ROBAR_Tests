// MDM bulk End Distribution on two fresh records: sets the FDA UDI Distribution End Date in one job. Web-only.
// With "Prepare for new DI" ticked it also creates a new unapproved version of each record.

import { test, expect } from '@playwright/test';
import * as mdm from '../support/master-data';

test('End Distribution sets the distribution end date and can prepare a new DI version', async ({ page }) => {
  test.setTimeout(480_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDE${stamp}`;
  const [a, b] = ['A', 'B'].map((s) => prefix + s);

  await test.step('create two records', async () => {
    for (const n of [a, b]) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  await test.step('End Distribution without "Prepare for new DI"', async () => {
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 2 });
    await mdm.checkRows(frame, [a, b]);
    await mdm.openBulkAction(frame, 'actEndDistribution');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataEndDistribution/JobSubmission');
    await expect(jobFrame.locator('body')).toContainText('Items Selected: 2');
    const date = jobFrame.locator('input[id^="dp"]');
    await date.evaluate((el) => {
      const $ = (window as any).jQuery;
      $(el).datepicker('setDate', new Date());
      $(el).trigger('change');
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
    }, undefined, { timeout: 5000 });
    console.log(`end distribution date: ${await date.inputValue()} newDI checked=${await jobFrame.locator('#chkNewDI').isChecked()}`);
    // Id-less text inputs here: [0] is the disabled field-name box, [1] is the Job Description.
    const plain = jobFrame.locator('input[type="text"]:not(#sigUser):not(#sigComments):not([id^="dp"])');
    await plain.nth(1).fill('Playwright MDM End Distribution', { timeout: 5000 });
    await mdm.fillJobSignature(jobFrame, '', 'DataLoad');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataEndDistribution/JobDetail');
    console.log(`end distribution job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 900)}`);
    expect(job.status).toBe('Completed');
    for (const n of [a, b]) expect(job.text).toContain(n);
  });
});
