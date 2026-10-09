// Destination Labeling barcode scanning (live 2026-10-08, HEADED: the Sentinel client is needed to scan -- a headless scan ends with "Timeout waiting for response from Sentinel. Waited 10 seconds."; the native
// "Open SentinelLauncher?" prompt is confirmed with FlaUI, hands off the mouse). Requirements (ValMaster modules "Destination Labeling" and "Destination Labeling - Barcode Parse Stored Procedure"):
// DL.171227.F.10.3 (default parse needs GTIN 01 + LOT 10; 17 / 11 / 21 optional), F.10.4-F.10.8 (Barcode Scan dialog: Fields Found / Fields Required / extra scan field / Reset), F.10.9 (unrecognized AI message),
// F.10.11-F.10.12 (all values found -> dialog closes; "No print rows found for given barcode" + Continue), F.10.14-F.10.15 (Current Scan button), F.11.7. No test items / destination templates exist for the
// scanned GTIN on TST703, so the scan ends at "No print rows found". One order is created per run (orders cannot be deleted). Prints nothing.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login } from '../support/robar';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const frame = (page: Page): Frame => page.frames().filter((x) => /DestLabeling\/DestLabeling/i.test(x.url())).pop()!;
const dialogText = async (page: Page): Promise<string> => (await frame(page).locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
function deviation(requirement: string, expected: string, actual: string): void {
  if (actual.includes(expected)) return;
  console.log(`DEVIATION ${requirement}: expected "${expected}", got "${actual.trim().slice(0, 220)}"`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected "${expected}", got "${actual.trim().slice(0, 220)}"` });
}

test('Destination Labeling scanning: unrecognized barcode, Barcode Scan dialog (Fields Found / Required), Reset, complete scan -> No print rows', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: 'Destination Labeling', exact: true }).click();
  await page.waitForTimeout(4000);
  const pid = await bartender.resolveBrowserPid(page);
  await bartender.confirmSentinelLaunchPrompt(page, pid);
  await page.waitForTimeout(5000);
  const scan = async (code: string, field = '#barcodeEntry'): Promise<void> => {
    await frame(page).locator(field).first().fill(code);
    await frame(page).locator(field).first().press('Enter');
    await page.waitForTimeout(8000);
    await bartender.confirmSentinelLaunchPrompt(page, pid).catch(() => {});
    await page.waitForTimeout(2000);
  };
  const closeMessage = async (): Promise<void> => {
    await frame(page).locator('.ui-dialog:visible button').filter({ hasText: 'Continue' }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1000);
  };

  await test.step('setup: Create Order (auto number) and choose the first destination', async () => {
    await frame(page).locator('#createOrderButton').click();
    await page.waitForTimeout(5000);
    await frame(page).locator('#destSelect').selectOption({ index: 1 });
    await page.waitForTimeout(3000);
    await expect(frame(page).locator('#barcodeEntry')).toBeEnabled();
    expect(await frame(page).locator('#btnCurrentScan').isVisible(), 'Current Scan only after an initial scan (F.10.14)').toBe(false);
  });

  await test.step('DL.171227.F.10.9: a barcode with no recognized AI -> unrecognized-identifier message with Continue', async () => {
    await scan('abc');
    const d = await dialogText(page);
    console.log(`abc: ${d}`);
    expect(d).toContain('Unable to recognize GS1 data identifier. The accepted GS1 data identifiers are');
    // the requirement lists Manufactured(11) as accepted; the live message omits it
    deviation('DL.171227.F.10.9', 'Manufactured(11)', d);
    await closeMessage();
    expect(await dialogText(page)).toBe('');
  });

  await test.step('DL.171227.F.10.9: the human-readable form with parentheses "(01)...(10)..." is not recognized either (observation)', async () => {
    await scan('(01)00012345600012(10)LOT1');
    const d = await dialogText(page);
    console.log(`parenthesized: ${d}`);
    expect(d).toContain('Unable to recognize GS1 data identifier');
    await closeMessage();
  });

  await test.step('DL.171227.F.10.4 / F.10.5 / F.10.6 / F.10.7 / F.10.14: a GTIN only -> Barcode Scan dialog with Fields Found (GTIN) and Fields Required (LotNumber), an extra scan field and Reset; Current Scan appears', async () => {
    await scan('0100012345600012');
    const d = await dialogText(page);
    console.log(`GTIN only: ${d}`);
    for (const t of ['Barcode Scan', 'Fields Found', 'Field Name', 'Value', 'GTIN', '00012345600012', 'Fields Required', 'LotNumber', 'Reset']) expect(d).toContain(t);
    const f = frame(page);
    await expect(f.locator('.ui-dialog:visible #fieldsFoundTable').first()).toBeVisible();
    await expect(f.locator('.ui-dialog:visible #fieldsRequiredTable').first()).toBeVisible();
    const secondVisible = await f.locator('.ui-dialog:visible #secondBarcodeEntry').first().isVisible();
    if (!secondVisible) deviation('DL.171227.F.10.7', 'a visible Barcode Scan field in the Barcode Scan dialog', 'the dialog field #secondBarcodeEntry is hidden');
    expect(await f.locator('.ui-dialog:visible #secondBarcodeEntry, .ui-dialog:visible #manualEntry0').count(), 'extra scan field and manual-entry box exist in the dialog').toBeGreaterThanOrEqual(2);
    expect(await f.locator('#btnCurrentScan').isVisible()).toBe(true);
  });

  await test.step('DL.171227.F.10.8: Reset closes the dialog, clears the scanned values and returns to the main screen', async () => {
    await frame(page).locator('.ui-dialog:visible button').filter({ hasText: 'Reset' }).first().click();
    await page.waitForTimeout(3000);
    expect(await dialogText(page)).toBe('');
    // scanning the GTIN again shows an empty Fields Found only for that GTIN (the earlier value was cleared, not accumulated twice)
    await scan('0100012345600012');
    const d = await dialogText(page);
    expect((d.match(/00012345600012/g) ?? []).length, 'GTIN listed once').toBe(1);
  });

  await test.step('DL.171227.F.10.7 / F.10.11 / F.10.12 / F.11.7: the lot scanned in the dialog completes the scan: the dialog closes and "No print rows found for given barcode" is shown with Continue', async () => {
    await scan('LOT1', '.ui-dialog:visible #manualEntry0'); // the visible box of the dialog is the Fields Required value box (F.10.6)
    const d = await dialogText(page);
    console.log(`after the lot scan: ${d || '(no dialog)'}`);
    expect(d).toContain('No print rows found for given barcode');
    // DEVIATION (live 2026-10-08): the requirement says the Barcode Scan dialog is closed once all values were found; it stays open underneath the message
    if (d.includes('Fields Required')) {
      console.log('DEVIATION DL.171227.F.10.11: the Barcode Scan dialog stays open after all values were scanned');
      test.info().annotations.push({ type: 'deviation DL.171227.F.10.11', description: 'the Barcode Scan dialog is not closed once the lot was entered (it stays open under the "No print rows found" message)' });
    }
    await closeMessage();
    const rest = await dialogText(page);
    if (rest.includes('Fields Required')) {
      await frame(page).locator('.ui-dialog:visible button').filter({ hasText: 'Reset' }).first().click();
      await page.waitForTimeout(2000);
    }
    expect(await dialogText(page)).toBe('');
    console.log(`Current Scan button visible after the completed scan: ${await frame(page).locator('#btnCurrentScan').isVisible()} (F.10.15 expects hidden)`);
  });
});
