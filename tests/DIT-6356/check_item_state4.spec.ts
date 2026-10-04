// Retry Add Filter with force:true (same jQuery dropmenu-toggle icon-overlap class of issue
// documented for openNewRecordAction) and generous settle time, verified via screenshot at each
// step before proceeding.

import { test } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { selectSchema } from '../support/master-data';

test('Add Filter retry with force click', async ({ page }) => {
  test.setTimeout(90_000);
  await login(page);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);
  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(800);

  // Confirmed from source (CriteriaFilter.js ~L274-288): the AddButton div contains TWO spans
  // both showing "Add Filter" text (an icon span with settings.addButtonText as its HTML, plus a
  // separate plain text span) -- the click handler (.on("click.criteriaFilter", addClick)) is
  // bound ONLY to the second span, not the icon one. .first() silently clicked the wrong span.
  await frame.getByText('Add Filter', { exact: true }).last().click({ timeout: 5000, force: true });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_addfilter_v2.png', fullPage: true });

  const filterGroupHtml = await frame.locator('#dvFilters').innerHTML().catch((e) => 'ERROR: ' + e.message);
  console.log('=== #dvFilters HTML ===');
  console.log(filterGroupHtml.slice(0, 3000));

  // The filter row defaults its Column to the first option ("Active"), whose Value editor is a
  // <select> (boolean-like column) -- switch Column to "Item Number" first, which swaps the Value
  // editor to a plain text input (class "criteriaFilter-Value" either way, just a different tag).
  await frame.locator('.criteriaFilter-ColumnSelect').last().selectOption({ label: 'Item Number' }, { timeout: 5000 });
  await page.waitForTimeout(500);
  await frame.locator('.criteriaFilter-Value').last().fill('MBUAT', { timeout: 5000 });
  await frame.locator('#drpApproved').selectOption({ label: 'Any' }, { timeout: 5000 }).catch((e) => console.log('drpApproved failed: ' + e.message));
  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_mbuat_search_results.png', fullPage: true });
  const resultsText = await frame.locator('#grdMasterData').innerText().catch(() => frame.locator('body').innerText());
  console.log('=== MBUAT search results ===');
  console.log(resultsText);
});
