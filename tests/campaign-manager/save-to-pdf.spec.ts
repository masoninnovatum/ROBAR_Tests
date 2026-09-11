// Bulk action: Save to PDF ("CreatePDF" in the #Action dropdown).
// No signature block. Fields: #Description, #Path (labeled "Subfolder" -- effectively required;
// confirmed live that leaving it blank fails with the vague "Path is invalid." rather than naming
// the field, matching the known UX gap), Merge/Use Unapproved Dictionary Entries checkboxes.
// Posts to /innovatum/CreatePDF/SubmitJob.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('save to pdf submits a job when Subfolder is provided', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'CreatePDF');

  await gridFrame.fill('#Description', 'Playwright save to PDF job');
  await gridFrame.fill('#Path', 'PlaywrightTests');

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/CreatePDF/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#SubmitButton'),
  ]);
  const body = await response.json();
  expect(body.Success, `SubmitJob failed: ${JSON.stringify(body)}`).toBe(true);
});

test('BUG: save to pdf rejects a blank Subfolder with a vague message', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'CreatePDF');

  await gridFrame.fill('#Description', 'Playwright save to PDF job, no subfolder');
  // #Path intentionally left blank.
  await gridFrame.click('#SubmitButton');

  // Confirmed UX gap: the error never names "Subfolder" -- if this ever improves, update the
  // expected text below rather than deleting the test, so the fix is still verified. The dialog
  // renders inside the Campaign Manager iframe (gridFrame), not the top-level page.
  await expect(gridFrame.locator('body')).toContainText('Path is invalid.');
});
