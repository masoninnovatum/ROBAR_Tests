// Campaign Manager's own "View History" (Item Change History) -- previously only doc-reviewed
// (IM_ViewHistory-1.32.doc in robar-module-reference.md's Campaign Manager section), never
// actually driven live. Confirmed via source:
// - NOT on the Item Edit page's own "Actions" dropdown at all (confirmed via Edit.cshtml's
//   DropMenu construction: exactly 5 items -- Create New Item, Save as New Version, Save as New
//   Item/Label Type, Approve Item, Retire/UnRetire Item -- no History entry among them). It's a
//   ROW-level action on the main Campaign Manager GRID instead (Index.aspx's own
//   ActionsFormatter/rowActionSelected("view-history")), a small "Row Actions" dropdown per row
//   with exactly two entries: "View/Edit" and "View History".
// - Clicking it does a REAL (non-AJAX) form submit of #frmEditItem to items/ItemsHistory --
//   navigates the grid iframe itself, same re-resolve-the-frame-afterward pattern as Load Filters.
// - Confirmed via ItemsController.ItemsHistory + ItemsHistory.cshtml: header shows Item Number/
//   Version/Label Type/Template/Description (Knockout-bound, server-rendered into `initModel` up
//   front -- no separate AJAX grid-data call to wait for), User/Field/Start/End Date filters, and
//   a change grid (#grdChangeHistory, columns Change Date/Change User/Changed Field/Value Before/
//   Value After). Audit source: X_Items table, ChangeType 'A' (Add) logged at creation, 'C'
//   (Change) logged per edited field thereafter -- a brand-new item already has at least one 'A'
//   row the instant it's created, which is what this test confirms shows up correctly.
//
// A follow-on "Change" (edit-then-view-history) round trip was tried and dropped: a second real
// Save on the Edit page re-navigates it (a fresh Edit?... URL, same pattern already documented for
// Approve Item), and the resulting frame-handle churn made the grid-navigation steps afterward
// unreliable in a way not worth chasing further for this test's purpose -- the initial 'A' row
// already proves the feature works end to end.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { findFrame } from '../support/robar';

test('View History shows the audit trail for a newly created item', async ({ page }) => {
  test.setTimeout(120_000);

  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);

  await test.step('open View History from the grid row', async () => {
    const row = gridFrame.locator('#gridResults tr').filter({ hasText: itemNumber });
    await row.locator('.actionsformatter').click();
    await row.getByText('View History', { exact: true }).click();
    await page.waitForTimeout(1500);
  });

  await test.step('confirm the history page and audit rows', async () => {
    const historyFrame = await findFrame(page, 'ItemsHistory');
    await historyFrame.locator('#grdChangeHistory').waitFor({ state: 'visible', timeout: 15_000 });

    await expect(historyFrame.locator('body')).toContainText(itemNumber);

    const rows = historyFrame.locator('#grdChangeHistory tr.jqgrow');
    await expect(rows).not.toHaveCount(0, { timeout: 10_000 });
  });
});
