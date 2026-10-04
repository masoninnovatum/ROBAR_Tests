// Campaign Manager's own "Job Inquiry" page -- previously only doc-reviewed (CM_JobInquriy-1.9.doc
// in robar-module-reference.md's Campaign Manager section: "Campaign Manager's own equivalent of
// MDM's Job Inquiry... Retrieve Jobs -> Job Detail. No new gotchas beyond confirming it exists"),
// never actually driven live. Confirmed via source
// (Innovatum.CampaignManager.MVC/Views/CampaignManager/JobInquiry.aspx, classic Web Forms):
// - NOT reachable from any visible in-app link, confirmed via a full source grep across every
//   Campaign Manager view: JobDetail.aspx's own "Job Inquiry" header button only ever shows when
//   that Job Detail page was itself reached FROM Job Inquiry in the first place (a `fromJobInquiry`
//   query flag its own JS checks) -- a fresh job's own Job Detail page (reached by submitting, not
//   searching) always hides it, and Index.aspx (the main grid) never renders it at all. This looks
//   like a direct-URL/bookmark-only page in real product use; reached here the same way, by
//   navigating the grid iframe straight to CampaignManager/JobInquiry.
// - Same CriteriaFilter widget (#Filters) as the main grid; #btnRetrieveItems fires ShowResultGrid(),
//   which POSTs GetCMJobData and renders a jqGrid (#gridResults) with a formatter-generated "Link"
//   column -- each row's cell is a real <a> reading "View Detail", pointing either at JobDetail
//   (ActionType == "CM") or an arbitrary ActionUrl otherwise.
// - **The default filter (when nothing was saved from a prior visit) is `PercentComplete LessThan
//   100`** -- confirmed via source (JobInquiry.aspx's own inline script) -- i.e. it shows only
//   INCOMPLETE jobs by default. A job that already finished (100%, Status "Completed") by the time
//   you query -- true almost immediately for a fast synchronous-feeling job like Export to XLS --
//   is silently excluded by that default filter, not a bug. Replace it with an explicit filter
//   (e.g. Description Contains/ExactlyMatches) rather than trusting the default to find a specific
//   known job.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('Job Inquiry finds and links back to a just-submitted job', async ({ page }) => {
  test.setTimeout(120_000);

  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'SaveToXLS');

  const jobDescription = 'PWJobInquiry' + Date.now().toString().slice(-8);
  await gridFrame.fill('#Description', jobDescription);
  await gridFrame.fill('#Filename', 'PlaywrightJobInquiryExport');

  const [submitResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/SaveToXLS/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#SubmitButton'),
  ]);
  const submitBody = await submitResponse.json();
  expect(submitBody.Success, `SubmitJob failed: ${JSON.stringify(submitBody)}`).toBe(true);
  await page.waitForTimeout(1000);

  await test.step('navigate to Job Inquiry', async () => {
    // Confirmed via source (JobDetail.aspx): the "Job Inquiry" header link on a Job Detail page is
    // ONLY shown when that Job Detail page was itself reached FROM Job Inquiry in the first place
    // (`fromJobInquiry` query flag) -- a fresh job's own Job Detail page (reached by submitting,
    // not searching) always hides it. Neither Index.aspx (the main grid) nor anywhere else in this
    // module renders a visible link INTO Job Inquiry at all -- confirmed via a full source grep
    // across every Campaign Manager view. This looks like a direct-URL/bookmark-only page in
    // practice; navigate the grid iframe there directly, the same way goToItem() does for Item Edit.
    const currentUrl = gridFrame.url();
    console.log('current grid frame URL:', currentUrl);
    const origin = new URL(currentUrl).origin;
    await gridFrame.evaluate((url) => {
      window.location.href = url;
    }, `${origin}/innovatum/CampaignManager/JobInquiry`);
    await gridFrame.locator('#btnRetrieveItems').waitFor({ state: 'visible', timeout: 15_000 });
  });

  await test.step('retrieve and find the just-submitted job', async () => {
    // Replace the default "PercentComplete LessThan 100" filter (which would exclude our
    // already-completed job) with an explicit Description match.
    await gridFrame.selectOption('select[name="Filters[0].Column"]', 'Description');
    await gridFrame.selectOption('select[name="Filters[0].Operator"]', 'ExactlyMatches');
    await gridFrame.fill('input[name="Filters[0].Value"]', jobDescription);

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/CampaignManager/GetCMJobData'), { timeout: 15_000 }),
      gridFrame.click('#btnRetrieveItems'),
    ]);
    expect(response.status()).toBe(200);

    const row = gridFrame.locator('#gridResults tr').filter({ hasText: jobDescription });
    await expect(row).toBeVisible({ timeout: 10_000 });

    const detailLink = row.getByRole('link', { name: /View Detail/i });
    await expect(detailLink).toBeVisible();
    await detailLink.click();

    // Following the link navigates back to a Job Detail page for this same job -- confirm we
    // actually land somewhere showing this job's own description again.
    await page.waitForTimeout(1000);
    await expect(gridFrame.locator('body')).toContainText(jobDescription, { timeout: 10_000 });
  });
});
