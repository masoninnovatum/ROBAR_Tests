// Bulk action: Mass Item Update ("massitemupdate" in the #Action dropdown).
// Creates an item, selects it in the grid, runs Mass Item Update to set its Item Group to a known
// value, and confirms the item's ItemGroup value actually changed afterward (not just that the job
// POST reported success).
//
// This replaces an earlier version of this test, which was a deliberate REGRESSION test asserting
// the opposite: a confirmed bug where the Job Submission - Mass Update Submit button (#SubmitButton)
// never actually fired a SubmitJob request, even against a fully valid form (Column + New Value +
// full signature) on a genuinely unapproved, editable item. That test was written to fail loudly
// the moment the bug was fixed, which is what happened -- Mason confirmed live (2026-09-11) that
// Submit now works. See git history for the old regression-test version if this ever regresses.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('mass item update changes the selected item\'s Item Group', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'massitemupdate');

  const jobResult = await cm.submitJob(page, gridFrame, {
    jobDescription: 'Playwright mass update job',
    comment: 'Updated by Playwright test',
    extraFields: async (frame) => {
      await frame.selectOption('#UpdateField0', 'ItemGroup');
      await frame.fill('#NewValue0', 'PlaywrightGroup');
    },
  });
  expect(jobResult.Success, `SubmitJob failed: ${JSON.stringify(jobResult)}`).toBe(true);

  await cm.goToItem(page, itemNumber);
  await expect(page.locator('input[name="ItemGroup"]')).toHaveValue('PlaywrightGroup');
});
