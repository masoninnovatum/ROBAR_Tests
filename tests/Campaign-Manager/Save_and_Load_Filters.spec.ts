// Campaign Manager's own grid-level "Save Filters"/"Load Filters" (#btSaveFilters/#btLoadFilters)
// -- previously only doc-reviewed (CM_SaveLoadFilters-1.15.doc in robar-module-reference.md's
// Campaign Manager section), never actually driven live. Confirmed via source
// (Innovatum.CampaignManager.MVC/Views/CampaignManager/Index.aspx, classic Web Forms + jQuery UI,
// NOT the Knockout/MVC style Item Edit uses):
// - Save Filters (#saveFiltersDialog): #txtFilterSaveName, #txtFilterSaveDescription, #chkPublic,
//   a New/Existing radio (#radNew/#radExisting + #drpExistingSets) for overwriting a prior save.
//   Client-side blocks: blank name (Err_SaveFiltersBlank), a name that collides with an existing
//   saved set while "New" is selected (Err_SaveFiltersName), and the literal name "default"
//   case-insensitively (invNameDefaultMsg). POSTs CampaignManager/SaveFilters with
//   {name, description, isPublic, recordsPerPage}; on success shows a generic jQuery UI "Success"
//   dialog (showSuccessDialog) with the message text, not a stable-id element -- confirmed exact
//   wording "Filters Saved Successfully" per the formal script.
// - Load Filters (#loadFiltersDialog): on open, POSTs GetNamedSearches and renders a plain jqGrid
//   (#jqGrid, columns Owner/Name/Description) of the account's saved sets. Clicking a row sets a
//   module-level `selRow` JS variable (onSelectRow) -- Load then POSTs LoadFilters with that row's
//   data and, on success, does `document.location.href = ...Index...&isReload=false` -- a REAL
//   navigation of the grid IFRAME itself (not the top-level page), so the frame must be re-resolved
//   via findFrame afterward, same as backToGrid's own pattern elsewhere in this suite.

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { findFrame } from '../support/robar';

test('save filters persists the current query, load filters restores it', async ({ page }) => {
  test.setTimeout(120_000);

  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);

  const filterName = 'PWFilter' + Date.now().toString().slice(-8);

  await test.step('Save Filters', async () => {
    await gridFrame.click('#btSaveFilters');
    await gridFrame.locator('#txtFilterSaveName').waitFor({ state: 'visible', timeout: 10_000 });
    await gridFrame.fill('#txtFilterSaveName', filterName);
    await gridFrame.fill('#txtFilterSaveDescription', 'Playwright Save Filters test');

    const [response] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/CampaignManager/SaveFilters'), { timeout: 15_000 }),
      gridFrame.locator('.ui-dialog-buttonpane button:has-text("Save")').click(),
    ]);
    expect(response.status()).toBe(200);

    const successDialog = gridFrame.locator('.ui-dialog:has-text("Success")');
    await expect(successDialog).toBeVisible({ timeout: 10_000 });
    await expect(successDialog).toContainText('Filters Saved Successfully');
    await successDialog.locator('button:has-text("Ok")').click();
  });

  await test.step('Load Filters restores the saved criteria', async () => {
    // Clear the current filter value first so restoring it is a real, observable change, not a
    // no-op that happens to already match.
    await gridFrame.fill('input[name="Filters[0].Value"]', '');

    await gridFrame.click('#btLoadFilters');
    await page.waitForResponse((r) => r.url().includes('/CampaignManager/GetNamedSearches'), { timeout: 15_000 });

    const row = gridFrame.locator('#jqGrid tr').filter({ hasText: filterName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    await row.click();

    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/CampaignManager/LoadFilters'), { timeout: 15_000 }),
      gridFrame.locator('.ui-dialog-buttonpane button:has-text("Load")').click(),
    ]);

    // Load navigates the grid iframe itself (document.location.href inside the frame) -- re-resolve
    // it rather than assuming the old Frame handle stays valid.
    await page.waitForTimeout(1500);
    const reloadedFrame = await findFrame(page, 'campaignmanager');
    await expect(reloadedFrame.locator('input[name="Filters[0].Value"]')).toHaveValue(itemNumber, { timeout: 10_000 });
  });
});
