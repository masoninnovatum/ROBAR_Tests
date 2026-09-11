// Bulk action: Export to XLS ("SaveToXLS" in the #Action dropdown).
// Simplest Job Submission form of the bunch: no signature block, just #Description and
// #Filename, posting to /innovatum/SaveToXLS/SubmitJob. Async job (per the module reference,
// completes in ~1 minute) -- this test only confirms submission succeeds, not job completion.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('export to xls submits a job for the selected item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'SaveToXLS');

  await gridFrame.fill('#Description', 'Playwright export to XLS job');
  await gridFrame.fill('#Filename', 'PlaywrightExport');

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/SaveToXLS/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#SubmitButton'),
  ]);
  const body = await response.json();
  expect(body.Success, `SubmitJob failed: ${JSON.stringify(body)}`).toBe(true);
});
