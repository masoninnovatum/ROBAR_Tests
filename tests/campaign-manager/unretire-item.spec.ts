// Single-item action: Item Edit -> Actions -> UnRetire Item.
// Reuses the exact same #retireItemDialog / RetireUnretireItem endpoint as Retire Item (see
// retire-item.spec.ts) -- only the dialog title differs client-side (isRetireRequest: false).
// Requires a retired item as setup: "UnRetire Item" is disabled on an active item and "Retire
// Item" is disabled on an already-retired one (confirmed live via the Actions menu).

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { findFrame } from '../support/robar';

test('unretire item marks a retired item active again', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  await cm.openItemAction(editFrame, 'Retire Item');
  const retireResult = await cm.submitSignatureDialog(page, editFrame, '#retireItemDialog', 'RetireUnretireItem');
  expect(retireResult.Success, `Setup retire failed: ${JSON.stringify(retireResult)}`).toBe(true);

  const retiredFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await retiredFrame.waitForLoadState('networkidle').catch(() => {});
  await expect(retiredFrame.locator('span.retired')).toHaveText('Retired');

  await cm.openItemAction(retiredFrame, 'UnRetire Item');
  const unretireResult = await cm.submitSignatureDialog(page, retiredFrame, '#retireItemDialog', 'RetireUnretireItem', {
    comment: 'Unretired by Playwright test',
  });
  expect(unretireResult.Success, `RetireUnretireItem (unretire) failed: ${JSON.stringify(unretireResult)}`).toBe(true);

  const activeFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await activeFrame.waitForLoadState('networkidle').catch(() => {});
  await expect(activeFrame.locator('span.retired')).toHaveCount(0);
});
