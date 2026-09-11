// Bulk action: Mass Print ("MassPrint" in the #Action dropdown).
// No signature block (unlike most other bulk actions) -- just Print Entity / lot fields
// (Expires/Manufactured pre-filled, "System will calculate expiration date"), a Description, and
// a Select Printer dropdown (#drpPrinters) of configured virtual/network label printers -- no OS
// print dialog involved, fully automatable. Posts to /innovatum/MassPrint/SubmitJob. Button id is
// #PrintButton, not #SubmitButton.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';

test('mass print submits a print job for the selected item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'MassPrint');

  await gridFrame.fill('#txtDescription', 'Playwright mass print job');
  await gridFrame.selectOption('#drpPrinters', { label: 'Zebra 220XiIII Plus (203 dpi)' });

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/MassPrint/SubmitJob'), { timeout: 15_000 }),
    gridFrame.click('#PrintButton'),
  ]);
  const body = await response.json();
  expect(body.Success, `SubmitJob failed: ${JSON.stringify(body)}`).toBe(true);
});
