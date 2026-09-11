// Bulk action: Send to Workflow ("WorkFlowSendTo" in the #Action dropdown).
// No signature block, unlike most other bulk actions. Fields: #txtDescription (Job Description),
// #txtComments (Workflow Comments -- required, confirmed live via the doc's known
// "Workflow comments cannot be left blank." message), #drpPreset (required -- "A workflow preset
// must be selected." if skipped). Posts to /innovatum/WorkFlowSendTo/SubmitJob. Submit button id
// is #btnSubmit, not #SubmitButton.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('send to workflow submits an unapproved item into a workflow preset', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'WorkFlowSendTo');

  await gridFrame.fill('#txtDescription', 'Playwright send to workflow job');
  await gridFrame.fill('#txtComments', 'Sent to workflow by Playwright test');
  // "ROBAR Only" is one of the few presets on this server with actual workflow steps configured
  // (confirmed live via GetWorkflowSteps) -- most others return an empty step list and SubmitJob
  // fails with "Workflow steps are empty," a preset-configuration gap, not a bug in this flow.
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/GetWorkflowSteps'), { timeout: 10_000 }),
    gridFrame.selectOption('#drpPreset', { label: 'ROBAR Only' }),
  ]);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#btnSubmit'),
  ]);
  const body = await response.json();
  expect(body.Success, `SubmitJob failed: ${JSON.stringify(body)}`).toBe(true);
});

test('BUG-CHECK: send to workflow requires Workflow Comments and a Preset', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'WorkFlowSendTo');

  // Leave Comments and Preset blank -- both documented as required.
  await gridFrame.fill('#txtDescription', 'Playwright send to workflow validation check');
  await gridFrame.click('#btnSubmit');

  await expect(gridFrame.locator('body')).toContainText('Workflow comments cannot be left blank.');
});
