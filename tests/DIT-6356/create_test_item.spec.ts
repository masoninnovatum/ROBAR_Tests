// Creates a fresh Master Data item in VAL703 to use as the Print-by-Lot test item for UAT_6356,
// then immediately re-verifies it was actually saved (same session, using the now-confirmed-
// working Add Filter widget) rather than assuming success from the save response alone.
//
// Field lessons folded in from this run's debugging:
// - Effective Begin: readonly jQuery-UI-datepicker input -- set via the itemHeader() Knockout
//   observable directly (setEffectiveBegin), not .fill().
// - Labeler Duns Number: in this manual New-Record form it's a Select2 dropdown keyed by Company
//   Name ("Innovatum" -> Duns 118117576), NOT a plain text field like the Excel Import path used.
//   New records default it to "123456789" -- the same known-fake sample value from DIT-6198's
//   lessons -- which the page itself flags invalid ("This dropdown value is no longer a valid
//   selection") until explicitly changed.
// - Primary DI Number must be unique across the WHOLE schema -- reusing a fixed literal across
//   repeated test-item creations throws "This value already exists in another record."
// - The Master Data Edit page is TABBED (Device Id / Packaging Structure / Regulatory Data /
//   Traceabilty and Iso Symbols / Characteristics / Storage and Handling / Sterilization Method /
//   Additional Identifiers / GUDID Control). Device Count lives on "Packaging Structure", NOT the
//   default "Device Id" tab -- every earlier attempt hung for the full test timeout waiting for a
//   "Device Count" row that was simply never rendered because the right tab was never clicked.
//   Primary DI Number/Brand Name/Labeler Duns Number/Issuing Agency are confirmed on "Device Id".
// - Device Count itself renders as `<input type="number">` (ARIA role "spinbutton", not
//   "textbox") -- fillFieldByCaption's original getByRole('textbox') silently matched nothing and
//   hung for the full test timeout. Fixed in master-data.ts to match the row's actual <input>
//   element directly instead of by ARIA role.
// - Every locator has an explicit timeout -- this app's actionTimeout defaults to unlimited, so an
//   unconfirmed selector must fail in seconds, not hang for the whole test budget.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import {
  selectSchema,
  openNewRecordAction,
  submitNewItemDialog,
  setItemDescription,
  setEffectiveBegin,
  saveRecord,
  fillFieldByCaption,
  selectDropdownFieldByCaption,
} from '../support/master-data';

test('create and verify a fresh RobarMasterData item for UAT_6356', async ({ page }) => {
  test.setTimeout(2 * 60 * 1000);
  await login(page);

  const itemNumber = `MBUAT6356E_${Date.now()}`;
  // Primary DI Number must be unique across the whole schema (confirmed live: reusing the same
  // literal across repeated test-item creations throws a validation error) -- derive a fresh one
  // from the same timestamp instead of a fixed literal, keeping it 14 digits like a real DI.
  const primaryDi = ('008' + Date.now().toString().slice(-11)).padEnd(14, '0');
  console.log(`ITEM_NUMBER=${itemNumber} PRIMARY_DI=${primaryDi}`);

  await openMenuItem(page, 'Master Data');
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);

  await selectSchema(frame, 'RobarMasterData');
  await page.waitForTimeout(500);
  await openNewRecordAction(frame);
  const created = await submitNewItemDialog(page, frame, itemNumber, 'UAT_6356 Print by Lot test item');
  console.log('CREATE_RESULT=' + JSON.stringify(created.createResponse));
  await page.waitForTimeout(1500);

  await setItemDescription(frame, 'UAT_6356 Print by Lot test item');
  await setEffectiveBegin(frame, new Date(2026, 0, 1));
  // "Device Id" tab is active by default -- confirmed home of these four fields.
  await fillFieldByCaption(frame, 'Primary DI Number', primaryDi);
  await fillFieldByCaption(frame, 'Brand Name', 'UAT6356 Test Brand');
  await selectDropdownFieldByCaption(frame, 'Labeler Duns Number', 'Innovatum');
  await selectDropdownFieldByCaption(frame, 'Issuing Agency', 'GS1').catch(async () => {
    await frame.getByRole('row', { name: 'Issuing Agency' }).locator('select').selectOption('1.3.160', { timeout: 5000 });
  });

  // Device Count lives on "Packaging Structure", a different tab -- switch before filling it.
  await frame.getByText('Packaging Structure', { exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(500);
  await fillFieldByCaption(frame, 'Device Count', '1');
  await page.waitForTimeout(500);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_item_before_save.png', fullPage: true });

  const saveResult = await saveRecord(page, frame);
  console.log('SAVE_RESULT=' + JSON.stringify(saveResult));
  await page.waitForTimeout(1500);
  await page.screenshot({ path: 'C:\\Users\\Mason\\AppData\\Local\\Temp\\claude\\uat6356_item_created.png', fullPage: true });

  // --- Immediate re-verification via search, same session ---
  await frame.getByText('Previous Page', { exact: false }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(1000);
  await frame.getByText('Remove', { exact: true }).click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(500);
  await frame.getByText('Add Filter', { exact: true }).last().click({ timeout: 5000, force: true });
  await page.waitForTimeout(800);
  await frame.locator('.criteriaFilter-ColumnSelect').last().selectOption({ label: 'Item Number' }, { timeout: 5000 });
  await page.waitForTimeout(500);
  // Operator defaults to "Exactly Matches", not "Contains" -- confirmed live (user caught this
  // silently producing false-negative empty results on earlier substring searches). Select it
  // explicitly rather than relying on the default, even though an exact full item-number match
  // would also work here.
  await frame.locator('.criteriaFilter-Filter select').nth(1).selectOption({ label: 'Contains' }, { timeout: 5000 }).catch((e) => console.log('operator select failed: ' + e.message));
  await frame.locator('.criteriaFilter-Value').last().fill(itemNumber, { timeout: 5000 });
  await frame.locator('#drpApproved').selectOption({ label: 'Any' }, { timeout: 5000 }).catch(() => {});
  await frame.getByRole('button', { name: 'Retrieve Data' }).click({ timeout: 10_000 });
  await page.waitForTimeout(2000);
  const resultsText = await frame.locator('#grdMasterData').innerText().catch(() => frame.locator('body').innerText());
  console.log('=== verification search results ===');
  console.log(resultsText);
  expect(resultsText).toContain(itemNumber);
});
