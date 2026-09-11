// Single-item action: Item Edit -> Actions -> Save As New Version.
// Only enabled once the item is approved (confirmed live -- disabled on a fresh unapproved item).
// Unlike the other Actions-menu items this has no dialog at all: clicking it directly fires a
// synchronous AJAX call (isNewVersion: true) to /InnoPages/items/SaveAsNewItemVersion -- the same
// endpoint Save As New Item / Label Type posts to, distinguished by that flag -- and on success
// navigates straight to versionNumber + 1 of the same item.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { findFrame } from '../support/robar';

test('save as new version creates version 1 from an approved item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  await cm.openItemAction(editFrame, 'Approve Item');
  const approveResult = await cm.submitSignatureDialog(page, editFrame, '#approveItemDialog', 'ApproveItem');
  expect(approveResult.Success, `Setup approve failed: ${JSON.stringify(approveResult)}`).toBe(true);

  const approvedFrame = await findFrame(page, `items/edit?itemnumber=${itemNumber.toLowerCase()}`);
  await approvedFrame.waitForLoadState('networkidle').catch(() => {});

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/SaveAsNewItemVersion'), { timeout: 15_000 }),
    cm.openItemAction(approvedFrame, 'Save As New Version'),
  ]);
  const body = await response.json();
  expect(body.Success, `SaveAsNewItemVersion failed: ${JSON.stringify(body)}`).toBe(true);

  const v1Frame = await findFrame(
    page,
    `items/edit?itemnumber=${itemNumber.toLowerCase()}&labeltype=${encodeURIComponent(cm.LABEL_TYPE.toLowerCase())}&versionnumber=1`
  );
  await v1Frame.waitForLoadState('networkidle').catch(() => {});
  await expect(v1Frame.getByRole('cell', { name: /Version:\s*1\b/ })).toBeVisible();
});
