// Bulk action: Mass Item Update ("massitemupdate" in the #Action dropdown) -- REGRESSION TEST for
// a confirmed bug, not a happy-path test.
//
// The Job Submission - Mass Update Submit button (#SubmitButton) does not actually submit: no
// SubmitJob request ever fires when clicked, even with a fully valid form (Column + New Value +
// full signature) against a genuinely unapproved, editable item. This was independently
// reproduced here (confirming an earlier exploratory session's suspicion that couldn't be tested
// at the time because no unapproved item was on hand) -- ruled out button-disabled-pending-
// validation (checked #SubmitButton.disabled before and after an explicit blur on #NewValue0:
// false both times) and ruled out a timing issue (same result across repeated runs).
//
// If this bug is ever fixed, this test will FAIL LOUDLY (the response-wait will start resolving
// instead of timing out) -- when that happens, replace this with a normal happy-path assertion
// (job Success + ItemGroup actually updated) and remove this comment block.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { USERNAME, PASSWORD } from '../support/robar';

test('BUG: mass item update Submit button does not submit the job', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'massitemupdate');

  await gridFrame.selectOption('#UpdateField0', 'ItemGroup');
  await gridFrame.fill('#NewValue0', 'PlaywrightGroup');
  await gridFrame.fill('#Description', 'Playwright mass update job');
  await gridFrame.fill('#Signature_UserName', USERNAME);
  await gridFrame.fill('#Signature_Password', PASSWORD);
  await gridFrame.fill('#Signature_Comment', 'Updated by Playwright test');

  let submitJobFired = false;
  page.on('request', (r) => {
    if (r.url().includes('/MassItemUpdate/SubmitJob')) submitJobFired = true;
  });

  await gridFrame.click('#SubmitButton');
  await page.waitForTimeout(5_000);

  expect(
    submitJobFired,
    'SubmitJob request fired -- the confirmed bug appears to be FIXED. Replace this regression test with a happy-path assertion (see file header).'
  ).toBe(false);

  // Confirm the field genuinely never changed server-side, not just that the request didn't fire.
  await cm.goToItem(page, itemNumber);
  await expect(page.locator('input[name="ItemGroup"]')).toHaveValue('');
});
