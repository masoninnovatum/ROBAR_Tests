// Single-item action: Item Edit -> Actions -> Save As New Item / Label Type.
// Dialog fields have no signature block, just #txtItemNumberLT / #ddlLabelTypeLT / #ltDescription,
// submitted to the SAME endpoint Save As New Version uses (/InnoPages/items/SaveAsNewItemVersion),
// distinguished by isNewVersion: false and a newItemNumber/newLabelType pair.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { findFrame } from '../support/robar';

test('save as new item / label type creates a distinct new item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  await cm.openItemAction(editFrame, 'Save As New Item / Label Type');
  const newItemNumber = itemNumber + '-LT';
  await editFrame.fill('#txtItemNumberLT', newItemNumber);
  await editFrame.selectOption('#ddlLabelTypeLT', cm.LABEL_TYPE);
  await editFrame.fill('#ltDescription', 'Saved as new item/label type by Playwright test');

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/items/SaveAsNewItemVersion'), { timeout: 15_000 }),
    editFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  const body = await response.json();
  expect(body.Success, `SaveAsNewItemVersion failed: ${JSON.stringify(body)}`).toBe(true);

  const newItemFrame = await findFrame(page, `items/edit?itemnumber=${newItemNumber.toLowerCase()}`);
  await newItemFrame.waitForLoadState('networkidle').catch(() => {});
  await expect(newItemFrame.locator('input[name="txtDescription"]')).toHaveValue('Saved as new item/label type by Playwright test');
});
