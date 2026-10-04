// SC-05 (test-generation-browser-printing.md) -- REQ-8/REQ-9/INV-2: when a new Lot is being
// entered with a blank expiration date, the Lot Panel calculates and displays
// Expires = Manufactured + the item's configured shelf life, rather than leaving it blank or
// equal to the manufacturing date.
//
// Live-confirmed 2026-09-16 (see robar-module-reference.md "Browser Printing" section): for a
// brand-new Order+Item combo (existing item MI080301, a never-used order number), the Lot Panel
// shows Manufactured defaulted to the server's current date and Expires defaulted to
// Manufactured + 1 day -- both computed and displayed as soon as the Lot Panel renders, i.e.
// entirely within the two wizard transitions confirmed reliable under automation (see
// tests/support/printing.ts's nativeClick doc comment). This test does NOT submit the Lot Panel
// itself (that third transition is a separate, currently-blocked step needing a reachable Sentinel
// service -- see printing.ts and the module reference) -- the calculation is already visible on
// this screen before that submit, which is all REQ-9's oracle needs.

import { test, expect } from '@playwright/test';
import { login } from '../support/robar';
import { openPrintByOrder, nativeClick, orderNumberId, itemNumberId, nextButtonId } from '../support/printing';

test('blank expiration date is calculated from manufacturing date + shelf life on the Lot Panel', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const frame = await openPrintByOrder(page);

  const orderNumber = 'MBEXP' + Math.floor(Math.random() * 100000);
  const itemNumber = 'MI080301'; // confirmed live, existing approved test item (see exploratory-session-log-robar-print.md)

  await test.step('enter a brand-new Order+Item combo', async () => {
    await frame.fill(`#${orderNumberId}`, orderNumber);
    await nativeClick(frame, nextButtonId);
    await page.waitForTimeout(3000);

    // Confirmed live: a new order number lands on the "No Lot found..." screen with Item/Lot
    // fields, exactly like Invalid_Combination_Blocked.spec.ts's negative case -- the only
    // difference here is supplying a real, existing item next.
    await expect(frame.getByText('No Lot found for this order/lot/item combination. Please fix or continue.')).toBeVisible();
    await frame.fill(`#${itemNumberId}`, itemNumber);
    await nativeClick(frame, nextButtonId);
    await page.waitForTimeout(3000);
  });

  await test.step('the Lot Panel shows a calculated (non-blank, non-stale) Expires date', async () => {
    const manufacturedField = frame.locator('#ctl00_printContentHolder_deLot_txtLotManufactured');
    const expiresField = frame.locator('#ctl00_printContentHolder_deLot_txtLotExpiration');

    await expect(manufacturedField).toBeVisible();
    await expect(expiresField).toBeVisible();

    const manufacturedValue = await manufacturedField.inputValue();
    const expiresValue = await expiresField.inputValue();

    expect(manufacturedValue, 'Manufactured date should be server-defaulted, not blank').not.toBe('');
    expect(expiresValue, 'Expires date should be calculated, not left blank (REQ-9/INV-2)').not.toBe('');
    expect(expiresValue, 'Expires must not just echo the manufacturing date unchanged').not.toBe(manufacturedValue);

    // REQ-9: Expires = Manufactured + item's configured shelf life. Confirmed live for this item
    // (MI080301) the shelf life is 1 day; assert the actual date arithmetic rather than a fixed
    // string, since Manufactured defaults to "today" and shifts every day this test runs.
    const manufacturedDate = new Date(manufacturedValue);
    const expiresDate = new Date(expiresValue);
    const diffDays = Math.round((expiresDate.getTime() - manufacturedDate.getTime()) / (24 * 60 * 60 * 1000));

    expect(diffDays, `Expires (${expiresValue}) should be Manufactured (${manufacturedValue}) + shelf life, not a different offset`).toBe(1);

    // Sanity: Manufactured itself is today's server date (or later, if the day rolled over between
    // form render and this read), not a stale/leftover value from prior test data.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    expect(manufacturedDate.getTime(), 'Manufactured should default to the server\'s current date (REQ-7)').toBeGreaterThanOrEqual(today.getTime());
  });
});
