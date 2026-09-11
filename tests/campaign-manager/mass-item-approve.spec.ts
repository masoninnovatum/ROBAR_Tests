// Bulk action: Mass Item Approve ("massitemapprove" in the #Action dropdown).
// Creates an item, selects it in the grid, runs Mass Item Approve, and confirms the item is
// actually approved afterward (not just that the job POST reported success).

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { USERNAME } from '../support/robar';

test('mass item approve approves the selected item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'massitemapprove');

  const jobResult = await cm.submitJob(page, gridFrame, {
    jobDescription: 'Playwright mass approve job',
    comment: 'Mass approved by Playwright test',
  });
  expect(jobResult.Success, `SubmitJob failed: ${JSON.stringify(jobResult)}`).toBe(true);

  const status = await cm.getApprovedStatus(page, itemNumber);
  expect(status).not.toBe('Unapproved');
  expect(status.toLowerCase()).toContain(USERNAME.toLowerCase());
});
