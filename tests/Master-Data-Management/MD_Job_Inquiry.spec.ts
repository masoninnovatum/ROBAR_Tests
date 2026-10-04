// MD Job Inquiry (Main Menu tile "MD Job Inquiry", `InnovatumMDM/MasterData/JobInquiry`): finds the MDM BULK-ACTION jobs
// (Mass Approve / Update / Retire / Assign GTIN ... -- not Excel Import jobs). Web-only: run a Mass Approve job on two fresh
// records, take its Job Id from the Job Detail page, then find the job through the inquiry's filter (Display Id Exactly Matches
// the id), check the row, and open the job's detail from it.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { openMenuItem, findFrame } from '../support/robar';
import * as mdm from '../support/master-data';

test('MD Job Inquiry finds a Mass Approve job by its Job Id and opens its detail', async ({ page }) => {
  test.setTimeout(420_000);
  let frame: Frame = await mdm.openMasterData(page);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `MBMDJ${stamp}`;
  const nums = ['A', 'B'].map((s) => prefix + s);
  let jobId = '';

  await test.step('run a Mass Approve job and read its Job Id', async () => {
    for (const n of nums) {
      await mdm.createValidRecord(page, frame, { itemNumber: n });
      frame = await mdm.backToGrid(page, frame);
    }
    await mdm.retrieve(page, frame, { value: prefix, expectRows: 2 });
    await mdm.checkRows(frame, nums);
    await mdm.openBulkAction(frame, 'actMassApprove');
    const jobFrame = await mdm.openJobPage(page, 'MasterDataMassApprove/JobSubmission');
    await mdm.fillJobSignature(jobFrame, `Playwright MD Job Inquiry ${stamp}`, 'General Approval');
    const job = await mdm.submitJobAndRead(page, jobFrame, 'MasterDataMassApprove/JobDetail');
    expect(job.status).toBe('Completed');
    jobId = (job.text.match(/Job Id\s+(\d+)/) ?? [])[1];
    console.log(`Mass Approve job id: ${jobId}`);
    expect(jobId, 'a numeric Job Id on the Job Detail page').toMatch(/^\d{6,}$/);
  });

  await test.step('MD Job Inquiry: filter Display Id = the job id, Retrieve, open the detail', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'MD Job Inquiry');
    const inq = await findFrame(page, 'JobInquiry');
    await inq.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2000);

    const columns = await inq.locator('select[name="dvFilters[0].Column"] option').evaluateAll((os) => os.map((o) => `${(o as HTMLOptionElement).value}=${(o as HTMLOptionElement).text}`));
    console.log(`inquiry filter columns: ${JSON.stringify(columns)}`);
    if ((await inq.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
      await inq.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    await inq.locator('select[name="dvFilters[0].Column"]').selectOption({ label: 'Display Id' }, { timeout: 5000 });
    await inq.locator('select[name="dvFilters[0].Operator"]').selectOption('ExactlyMatches', { timeout: 5000 });
    await inq.locator('input[name="dvFilters[0].Value"]').fill(jobId, { timeout: 5000 });
    await inq.click('#btnRetrieveJobs', { timeout: 5000 });
    await page.waitForTimeout(3500);

    const rows = inq.locator('tr.jqgrow');
    await expect(rows).toHaveCount(1, { timeout: 15_000 });
    const rowText = (await rows.first().innerText()).replace(/\s+/g, ' ');
    console.log(`inquiry row: ${rowText}`);
    expect(rowText).toContain(jobId);
    const headers = (await inq.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    console.log(`inquiry grid headers: ${JSON.stringify(headers)}`);

    const link = rows.first().locator('a').first();
    console.log(`row link text: "${(await link.innerText()).trim()}"`);
    await link.click({ timeout: 5000 });
    await page.waitForTimeout(3500);
    const detail = page.frames().find((f) => /JobDetail|MasterDataMassApprove/.test(f.url())) ?? inq;
    const detailText = (await detail.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`job detail from inquiry: ${detailText.slice(0, 300)}`);
    expect(detailText).toContain(jobId);
    for (const n of nums) expect(detailText).toContain(n);
  });

  await test.step('the same job is also found by one of its ITEM numbers', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'MD Job Inquiry');
    const inq = await findFrame(page, 'JobInquiry');
    await inq.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(2000);
    if ((await inq.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
      await inq.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await page.waitForTimeout(500);
    }
    await inq.locator('select[name="dvFilters[0].Column"]').selectOption({ label: 'Item Number' }, { timeout: 5000 });
    await inq.locator('select[name="dvFilters[0].Operator"]').selectOption('ExactlyMatches', { timeout: 5000 });
    await inq.locator('input[name="dvFilters[0].Value"]').fill(nums[0], { timeout: 5000 });
    await inq.click('#btnRetrieveJobs', { timeout: 5000 });
    await page.waitForTimeout(3500);
    const rows = inq.locator('tr.jqgrow').filter({ hasText: jobId });
    await expect(rows, 'the Mass Approve job is listed for its item').toHaveCount(1, { timeout: 15_000 });
    expect((await rows.first().innerText()).replace(/\s+/g, ' ')).toContain('MassApprove');
  });
});
