// Bulk action: Item Translation ("ItemTranslation" in the #Action dropdown).
//
// Multi-step flow, confirmed live end to end:
//   1. Page auto-loads with a default dictionary filter (Column=Phrase, Operator=Contains,
//      Value="a", Include Unapproved checked) and immediately fires Get Translations.
//   2. Expand "Select Fields to Translate" (a field, "Description 2", is pre-selected by default).
//   3. Click a row in the Dictionary Translations grid (#dictGrid).
//   4. The selected item appears in its own grid (#itemGridContainer / #itemGrid, row id
//      "jqg_itemGrid_0" for a single selected item) -- check its row checkbox.
//   5. Click #btLoadPhrase ("Populate Phrase") -- this fills the chosen field's cell (shown via
//      the #drpLoadPhrase field-selector dropdown next to it) with the clicked phrase's
//      translation text for every checked item row.
//   6. #SubmitButton opens a SECOND "Job Submission" modal with its own Job Description +
//      Signature block (unlike every other bulk action, which submits straight from the single
//      page) -- that modal's own Submit posts to /innovatum/ItemTranslation/JobSubmit.
//
// NOTE: an earlier exploratory session (interactive, not Playwright-driven) reported "Populate
// Phrase never becomes enabled" as a confirmed bug/silent no-op. That did NOT reproduce here --
// driven via Playwright, the button was enabled as soon as a dictionary row was clicked, Populate
// Phrase visibly updated the item's cell, and the job actually persisted the change. Written as a
// normal happy-path test; if a real reproduction of the old bug resurfaces, convert this back to
// a regression test (see mass-item-update.spec.ts / item-data-compare.spec.ts for that pattern).

import { test, expect } from '@playwright/test';
import * as cm from '../support/campaign-manager';
import { USERNAME, PASSWORD } from '../support/robar';

test('item translation populates a translated phrase into the selected item', async ({ page }) => {
  const cmFrame = await cm.openCampaignManager(page);
  const { itemNumber, editFrame } = await cm.createItem(page, cmFrame);

  const gridFrame = await cm.backToGrid(page, editFrame);
  await cm.retrieveAndSelectItem(page, gridFrame, itemNumber);
  await cm.startBulkAction(page, gridFrame, 'ItemTranslation');

  // Wait for the default Get Translations call (auto-fired on load) to populate #dictGrid.
  await gridFrame.locator('#dictGrid tr.jqgrow').first().waitFor({ timeout: 15_000 });
  await gridFrame.click('text=Select Fields to Translate');

  const firstDictRow = gridFrame.locator('#dictGrid tr.jqgrow').first();
  const expectedPhrase = ((await firstDictRow.locator('td[aria-describedby="dictGrid_Phrase"]').textContent()) ?? '').trim();
  await firstDictRow.click();

  await gridFrame.locator('#jqg_itemGrid_0').check();
  await expect(gridFrame.locator('#btLoadPhrase')).toBeEnabled();
  await gridFrame.click('#btLoadPhrase');

  // Confirm the grid cell visibly updated before submitting.
  await expect(gridFrame.locator('#itemGrid tr.jqgrow').first()).toContainText(expectedPhrase);

  // #SubmitButton opens a SECOND "Job Submission" modal (its own Job Description + Signature
  // block) -- distinct from every other bulk action's single-page Job Submission form.
  await gridFrame.click('#SubmitButton');
  await gridFrame.fill('#txtJobDescription', 'Playwright item translation job');
  await gridFrame.fill('#Signature_UserName', USERNAME);
  await gridFrame.fill('#Signature_Password', PASSWORD);

  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/ItemTranslation/JobSubmit'), { timeout: 15_000 }),
    gridFrame.locator('.ui-dialog-buttonpane button:has-text("Submit")').click(),
  ]);
  const body = await response.json();
  expect(body.Success, `JobSubmit failed: ${JSON.stringify(body)}`).toBe(true);

  await cm.goToItem(page, itemNumber);
  await expect(page.locator('input[name="Description2"]')).toHaveValue(expectedPhrase);
});
