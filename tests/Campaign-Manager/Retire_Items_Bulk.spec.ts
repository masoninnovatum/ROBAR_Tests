// Bulk action: Retire Items ("RetireItems" in the #Action dropdown).
// Job Submission form defaults its Retire/Unretire radio (#retireItems / #unretireItems, name
// "retireOptions") to whichever matches the selection -- Retire pre-selected + Unretire disabled
// for an all-active selection (confirmed live), matching the single-item Retire/UnRetire mutual
// exclusivity. Posts to /innovatum/campaignmanager/plugin/RetireItems/SubmitJob.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('bulk retire items retires the selected item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'RetireItems');

  await expect(gridFrame.locator('#retireItems')).toBeChecked();
  await expect(gridFrame.locator('#unretireItems')).toBeDisabled();

  const jobResult = await cm.submitJob(page, gridFrame, {
    jobDescription: 'Playwright bulk retire job',
    comment: 'Retired by Playwright test',
  });
  expect(jobResult.Success, `SubmitJob failed: ${JSON.stringify(jobResult)}`).toBe(true);

  // Unlike single-item Retire Item, the bulk action's SubmitJob redirects to a Job Detail page
  // (not the item edit page), so confirm the retire actually took effect by navigating directly.
  await cm.goToItem(page, itemNumber);
  await expect(page.locator('span.retired')).toHaveText('Retired');
});
