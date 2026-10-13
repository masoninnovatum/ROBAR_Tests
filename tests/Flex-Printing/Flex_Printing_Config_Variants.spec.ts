// Flex Printing identifier layouts (live 2026-10-12, HEADED, TST703, seed user Claude01; nothing is printed). The FlexPrinting PrintConfig rows Flex_Identifier_1..3 are changed through Print Config Management
// (the user allowed this for FlexPrinting only; tests/support/print-config.ts guards the old value) and ALWAYS restored in `finally`:
//   base: _1 = "FlexLot_ItemNumber, Item Number", _2 = "FlexLot_LotNum, Lot Number", _3 = "FlexLot_OrderNum, Order Number, AddOnly".
// Requirements (.agents/valmaster-flex-printing.md): FLX.190301.F.1.6 / F.2.3 / F.2.1, FP.160601.F.1.x (date picker). Differences are annotated `deviation <id>`.
// Test data: none created (every step only looks up the existing lot MBBQN954324L).

import { test, expect } from '@playwright/test';
import { login } from '../support/robar';
import { FlexPrint } from '../support/flex-print';
import * as pc from '../support/print-config';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MBBQA8457561';
const BASE: Record<number, string> = { 1: 'FlexLot_ItemNumber, Item Number', 2: 'FlexLot_LotNum, Lot Number', 3: 'FlexLot_OrderNum, Order Number, AddOnly' };

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Flex Printing identifier layouts: Order+Item, Order+Lot (Item AddOnly / not AddOnly), date identifier (config restored afterwards)', async ({ page }) => {
  test.setTimeout(1_800_000);
  await login(page);
  const cur: Record<number, string> = { ...BASE };
  // the starting state must be the expected base (setParamValue also refuses to edit anything else)
  for (const n of [1, 2, 3]) expect(await pc.readParam(page, 'FlexPrinting', `Flex_Identifier_${n}`), `Flex_Identifier_${n} starts as the base value`).toBe(BASE[n]);
  const set = async (n: number, v: string) => {
    if (cur[n] !== v) {
      await pc.setParamValue(page, 'FlexPrinting', `Flex_Identifier_${n}`, cur[n], v);
      cur[n] = v;
    }
  };
  const fp = new FlexPrint(page);
  try {
    await test.step('FLX.190301.F.1.6: Order Number + Item Number on the initial screen (Lot AddOnly) -> the Lot Number of the single matching lot is displayed', async () => {
      await set(2, 'FlexLot_LotNum, Lot Number, AddOnly');
      await set(3, 'FlexLot_OrderNum, Order Number');
      await fp.open();
      expect(await fp.field('Order').count()).toBe(1);
      expect(await fp.field('Lot').count(), 'Lot is AddOnly: hidden').toBe(0);
      await fp.field('Order').fill('MBBQN954324');
      await fp.field('Item').fill(ITEM);
      await fp.next();
      const lot = await fp.f.locator('input[id$="deLot_txtLotNumber"]').inputValue().catch(() => '');
      console.log(`F.1.6 lot shown: "${lot}"`);
      if (lot !== 'MBBQN954324L') deviation('FLX.190301.F.1.6', 'the Lot Number of the matching lot is displayed', `"${lot}"`);
    });

    await test.step('FLX.190301.F.2.3: Order Number + Lot Number entered, Item Number AddOnly -> the Item Number of the single matching lot is displayed', async () => {
      await set(1, 'FlexLot_ItemNumber, Item Number, AddOnly');
      await set(2, 'FlexLot_LotNum, Lot Number');
      await fp.open();
      expect(await fp.field('Item').count(), 'Item is AddOnly: hidden').toBe(0);
      await fp.field('Order').fill('MBBQN954324');
      await fp.field('Lot').fill('MBBQN954324L');
      await fp.next();
      const panel = await fp.body();
      console.log(`F.2.3 AddOnly: ${panel.slice(0, 320)}`);
      if (!panel.includes(`Item: ${ITEM}`)) deviation('FLX.190301.F.2.3', 'the Item Number of the matching lot is displayed', panel.slice(0, 200));
    });

    await test.step('FLX.190301.F.2.3 (negative): Order + Lot entered but the Item identifier is NOT AddOnly -> "Insufficient lot identifiers configured"', async () => {
      await set(1, 'FlexLot_ItemNumber, Item Number');
      await fp.open();
      await fp.field('Order').fill('MBBQN954324');
      await fp.field('Lot').fill('MBBQN954324L');
      await fp.next();
      const t = await fp.body();
      console.log(`F.2.3 not AddOnly: ${t.slice(0, 200)}`);
      if (!t.includes('Insufficient lot identifiers configured')) deviation('FLX.190301.F.2.3', '"Insufficient lot identifiers configured"', t.slice(0, 160));
    });

    await test.step('FP.160601.F.1.1 / F.1.3 / F.1.4: an identifier with the Date (and Protect) modifier is shown with a date picker', async () => {
      await set(3, 'FlexLot_Expires, Expiration Date, Date, Protect');
      await fp.open();
      const info = await fp.f.locator('input:visible').evaluateAll((els) => els.map((e: any) => `${e.id.split('_').slice(-2).join('_')}|${e.type}|readOnly=${e.readOnly}|class=${e.className}`));
      console.log(`DATE IDENTIFIER controls ${JSON.stringify(info)}`);
      const dateBox = fp.f.locator('input[id*="Expires"], input.hasDatepicker, input.dpDate').first();
      if (!(await dateBox.count())) deviation('FP.160601.F.1.1', 'a date selector on the Flex Printing UI', JSON.stringify(info));
      else {
        console.log(`DATE BOX id=${await dateBox.getAttribute('id')} readonly=${await dateBox.getAttribute('readonly')} class=${await dateBox.getAttribute('class')}`);
        // FP.160601.F.1.5: BP_FlexPriorDate lets a user enter past dates; without it the picker has minDate 0 (today). Claude01 (seed admin) is expected to hold the process.
        const minDate = await dateBox.evaluate((e) => (window as any).jQuery(e).datepicker('option', 'minDate'));
        const format = await dateBox.evaluate((e) => (window as any).jQuery(e).datepicker('option', 'dateFormat'));
        console.log(`DATE PICKER minDate=${JSON.stringify(minDate)} dateFormat=${format}`);
      }
    });
  } finally {
    for (const n of [1, 2, 3]) await set(n, BASE[n]).catch((e) => console.log(`RESTORE FAILED _${n}: ${e.message}`));
    await page.locator('li.ui-tabs-tab:has-text("Flex Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  }
  for (const n of [1, 2, 3]) expect(await pc.readParam(page, 'FlexPrinting', `Flex_Identifier_${n}`), `Flex_Identifier_${n} restored`).toBe(BASE[n]);
});
