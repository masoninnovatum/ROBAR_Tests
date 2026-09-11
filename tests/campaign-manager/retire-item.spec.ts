// Single-item action: Item Edit -> Actions -> Retire Item.
// Same signature-dialog pattern as Approve Item, posting to /InnoPages/items/RetireUnretireItem
// (isRetireRequest: true) -- shared with UnRetire Item's dialog, which reuses the same
// #retireItemDialog markup and #sigUser/etc ids (see unretire-item.spec.ts). On success the item
// edit page redirects to itself; a red "Retired" badge (span.retired, bound to !viewModel.active())
// appears top-left and Effective End is set to today.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { findFrame } from '../support/robar';

test('retire item marks the item inactive', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  await cm.openItemAction(editFrame, 'Retire Item');
  const result = await cm.submitSignatureDialog(page, editFrame, '#retireItemDialog', 'RetireUnretireItem', {
    comment: 'Retired by Playwright test',
  });
  expect(result.Success, `RetireUnretireItem failed: ${JSON.stringify(result)}`).toBe(true);

  const finalFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await finalFrame.waitForLoadState('networkidle').catch(() => {});
  await expect(finalFrame.locator('span.retired')).toHaveText('Retired');
});
