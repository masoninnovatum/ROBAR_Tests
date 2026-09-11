// Bulk action: Save as New ("SaveAsNew" in the #Action dropdown).
// Job Submission form defaults to a "New Version" radio (#new_version, name "save_as", vs
// #new_label_type) plus the usual Description + Signature block, posting to
// /innovatum/campaignmanager/plugin/SaveAsNew/SubmitJob. Requires an APPROVED item -- confirmed
// live: submitting against a fresh unapproved item (which shows an "Items already editable: N"
// notice on this very form) fails with "Some items are already editable", the same precondition
// as the single-item Save As New Version action.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('bulk save as new creates a new version of an approved item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  await cm.openItemAction(editFrame, 'Approve Item');
  const approveResult = await cm.submitSignatureDialog(page, editFrame, '#approveItemDialog', 'ApproveItem');
  expect(approveResult.Success, `Setup approve failed: ${JSON.stringify(approveResult)}`).toBe(true);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'SaveAsNew');

  await expect(gridFrame.locator('#new_version')).toBeChecked();

  const jobResult = await cm.submitJob(page, gridFrame, {
    jobDescription: 'Playwright bulk save-as-new job',
    comment: 'Saved as new by Playwright test',
  });
  expect(jobResult.Success, `SubmitJob failed: ${JSON.stringify(jobResult)}`).toBe(true);
});
