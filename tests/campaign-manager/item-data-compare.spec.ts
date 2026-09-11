// Bulk action: Item Data Compare ("ItemCompare" in the #Action dropdown) -- REGRESSION TEST for a
// confirmed bug, not a happy-path test.
//
// Per the module reference (CM_ItemDataCompare-1.24 formal script review + live retest), this
// action fails 100% of the time against fresh/unchanged items with
// "External table is not in the expected format." -- an OLEDB/Excel-provider error, most likely
// because the comparison mechanism has no valid prior-version baseline file to open for a brand
// new item. Confirmed reproducible even with "Include Items without changes" checked and both
// Job Description and File Name filled in (the doc notes File Name looks optional but is actually
// required -- filled in here to isolate the OLEDB failure from that separate gotcha).
//
// Fields: #jobDescription, #fileName, #includeAll ("Include Items without changes"),
// #includeIntermediate. Submit button is #submitBtn (not #SubmitButton). Posts to
// /innovatum/ItemCompare/SubmitJob, then redirects to a Job Detail page showing Status: Error.
//
// If this is ever fixed, this test will FAIL LOUDLY -- replace it with a happy-path assertion
// (job reaches Status: Completed) and remove this comment block.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('BUG: item data compare fails against a fresh item with an OLEDB error', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'ItemCompare');

  await gridFrame.fill('#jobDescription', 'Playwright item data compare job');
  await gridFrame.fill('#fileName', 'PlaywrightItemCompare');
  await gridFrame.check('#includeAll');

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/ItemCompare/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#submitBtn'),
  ]);
  const body = await response.json();

  // Confirmed bug: the job SUBMITS successfully (Success: true) but then fails during processing.
  expect(body.Success, `SubmitJob unexpectedly failed at submission time (bug may have changed shape): ${JSON.stringify(body)}`).toBe(true);

  await page.waitForTimeout(3_000);
  // The Job Details page renders inside the Campaign Manager iframe (gridFrame), not the
  // top-level page.
  await expect(gridFrame.locator('body')).toContainText('External table is not in the expected format.');
});
