// SC-04 (test-generation-browser-printing.md) -- regression lock for REQ-1/REQ-17: an
// invalid/nonexistent Order+Lot+Item combination must be blocked on every retry, never let the
// wizard through to the Lot Panel / print-execution screen.
//
// Message strings and the "misleading wording, gating still works" behavior are reproduced exactly
// from .agents/exploratory-session-log-robar-print.md (Finding 1, 2026-09-16 manual exploration) --
// this test locks that behavior as a regression guard, per the design doc's explicit instruction to
// snapshot the (currently misleading) "...or continue" copy as a known-issue rather than silently
// passing if it ever gets fixed to feel more actionable than it is.
//
// Uses openPrintByOrder()/nativeClick() from tests/support/printing.ts -- Playwright's own
// locator.click() does not reliably trigger this legacy WebForms page's postback (confirmed live
// 2026-09-16, see that file's header comment); nativeClick's frame.evaluate()-based native DOM
// .click() does. This test only needs the first two wizard transitions (blank/invalid order ->
// item+lot entry screen -> still blocked), which are confirmed reliable; it does not touch the Lot
// Panel's own submit, which is a separate, currently-blocked transition (see printing.ts).

import { test, expect } from '@playwright/test';
import { login } from '../support/robar';
import { openPrintByOrder, nativeClick, orderNumberId, itemNumberId, lotNumberId, nextButtonId } from '../support/printing';

test('invalid order/lot/item combination is blocked on every retry, never reaches the Lot Panel', async ({ page }) => {
  test.setTimeout(120_000);
  await login(page);
  const frame = await openPrintByOrder(page);

  await test.step('a nonexistent order number is rejected with "No Lot found..." and offers Item/Lot fields', async () => {
    await frame.fill(`#${orderNumberId}`, 'ZZZ-NONEXISTENT-99999');
    await nativeClick(frame, nextButtonId);
    await page.waitForTimeout(3000);

    // Confirmed live wording (exploratory session log, Finding 1) -- deliberately asserting the
    // misleading "...or continue" copy as-is; a future copy fix should be a visible, deliberate
    // test update, not a silent pass.
    await expect(frame.getByText('No Lot found for this order/lot/item combination. Please fix or continue.')).toBeVisible();
    await expect(frame.locator(`#${itemNumberId}`)).toBeVisible();
    await expect(frame.locator(`#${lotNumberId}`)).toBeVisible();
  });

  await test.step('retrying with Item/Lot still blank keeps blocking with "No item found." -- never advances', async () => {
    for (let attempt = 0; attempt < 3; attempt++) {
      await nativeClick(frame, nextButtonId);
      await page.waitForTimeout(2500);

      // Confirmed live: message text changes from the initial "No Lot found..." to "No item
      // found." on repeated attempts with no data supplied -- the gating itself never lets the
      // "...or continue" wording actually mean "continue with bad data."
      await expect(frame.getByText('No item found.')).toBeVisible();

      // Regression lock (INV-3-adjacent): the Lot Panel is a genuinely different screen with its
      // own distinct field ids (deLot_ prefix, not customControl_) -- its absence proves the
      // wizard never let this invalid data through, on this or any prior attempt.
      await expect(frame.locator('#ctl00_printContentHolder_deLot_txtLotNumber')).toHaveCount(0);
    }
  });

  await test.step('supplying a nonexistent Item Number alongside stays blocked the same way', async () => {
    await frame.fill(`#${itemNumberId}`, 'ZZZ-NONEXISTENT-ITEM');
    await nativeClick(frame, nextButtonId);
    await page.waitForTimeout(2500);

    await expect(frame.getByText('No item found.')).toBeVisible();
    await expect(frame.locator('#ctl00_printContentHolder_deLot_txtLotNumber')).toHaveCount(0);
  });
});
