// MDM bulk Mass Update on two fresh records: set one schema field ("Brand Name") to a new value in one job, then confirm
// through the grid filter (Brand Name Exactly Matches the new value) that BOTH records changed. Web-only.

import { test, expect } from '@playwright/test';
import * as mdm from '../support/master-data';

test('Mass Update sets a field on every selected record', async ({ page }) => {
  test.setTimeout(420_000);
  let frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDU${stamp}`;
  const nums = ['A', 'B'].map((s) => prefix + s);
  const newBrand = `MassUpdated${stamp}`;

  await test.step('create two records with a different Brand Name', async () => {
    for (const n of nums) {
      await mdm.createValidRecord(page, frame, { itemNumber: n, brandName: 'Original Brand' });
      frame = await mdm.backToGrid(page, frame);
    }
  });

  await test.step('Mass Update job page: validation, then set Brand Name on both', async () => {
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 2 });
    await mdm.checkRows(frame, nums);
    await mdm.openBulkAction(frame, 'actMassUpdate');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassUpdate/JobSubmission');
    const text = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`mass update page: ${text.slice(0, 120)}`);

    // Pick the field, then find the New Value control that appears for a text field.
    await jobFrame.locator('select').first().selectOption({ label: 'Brand Name' }, { timeout: 5000 });
    await page.waitForTimeout(800);
    const controls = await jobFrame.evaluate(() =>
      Array.from(document.querySelectorAll('input, select, textarea')).filter((e) => (e as HTMLElement).offsetParent).map((e) => `${e.tagName.toLowerCase()}#${(e as HTMLElement).id}[${(e as HTMLInputElement).type ?? ''}]`)
    );
    console.log(`mass update controls after choosing Brand Name: ${JSON.stringify(controls)}`);

    // Empty submit is refused with field-level "required" messages.
    await jobFrame.getByRole('button', { name: /^Submit/ }).click({ timeout: 5000, noWaitAfter: true });
    await page.waitForTimeout(1200);
    const afterEmpty = (await jobFrame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`after empty submit: ${afterEmpty.slice(0, 400)}`);
    expect(afterEmpty).toContain('This field is required.');

    // The New Value text box is the first plain text input that isn't one of the signature fields.
    // On this page BOTH the New Value box and the Job Description box are id-less text inputs (in that order).
    const plainTexts = jobFrame.locator('input[type="text"]:not(#sigUser):not(#sigComments)');
    await plainTexts.nth(0).fill(newBrand, { timeout: 5000 });
    await plainTexts.nth(1).fill('Playwright MDM Mass Update', { timeout: 5000 });
    await mdm.fillJobSignature(jobFrame, '');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassUpdate/JobDetail');
    console.log(`mass update job detail: ${job.text.replace(/\s+/g, ' ').slice(0, 900)}`);
    expect(job.status).toBe('Completed');
    for (const n of nums) expect(job.text).toContain(n);
  });

  await test.step('both records now carry the new Brand Name (grid filter)', async () => {
    frame = await mdm.reopenMasterData(page);
    const rows = await mdm.retrieve(page, frame, { column: 'Brand_Name', operator: 'ExactlyMatches', value: newBrand, expectRows: 2 });
    await expect(rows).toHaveCount(2);
    for (const n of nums) await expect(rows.filter({ hasText: n })).toHaveCount(1);
  });
});
