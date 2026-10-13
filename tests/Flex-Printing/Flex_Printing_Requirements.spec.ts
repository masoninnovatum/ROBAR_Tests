// Flex Printing training (live 2026-10-12, HEADED, TST703, seed user Claude01; nothing is printed). Requirements: .agents/valmaster-flex-printing.md (FLX.190301.*, FP.160323.*, FP.160601.*).
// Config at the time (PrintConfig FlexPrinting): Flex_Identifier_1 = FlexLot_ItemNumber, _2 = FlexLot_LotNum, _3 = FlexLot_OrderNum AddOnly (set by Claude 2026-10-12 with the user's permission; the earlier duplicate
// Item identifier made Next crash with a Server Error). So the entry screen shows Item Number + Lot Number and the Order Number box appears only when it is needed (AddOnly).
// Differences from a requirement are annotated `deviation <id>`. Test data: lots CLFLX<stamp>A / B (item MBBQA8457561); they are deleted again in Lot Management (MB-prefixed rows only).

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { login } from '../support/robar';
import * as du from '../support/dynamic-ui';
import { FlexPrint } from '../support/flex-print';

test.use({ headless: false, actionTimeout: 20_000 });

const ITEM = 'MBBQA8457561'; // existing approved item with a label master (from the batch quantity specs)
const ITEM2 = 'MBLCCR3269267'; // a different existing item (Label Control specs)
const EXISTING_LOT = 'MBBQN954324L'; // existing lot of ITEM, order MBBQN954324

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

async function deleteMbLots(page: Page, prefix: string): Promise<void> {
  if (!/^CLFLX\d+/.test(prefix)) throw new Error(`refusing to delete lots with prefix ${prefix}`);
  await page.locator('li.ui-tabs-tab:has-text("Lot Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  for (let i = 0; i < 6; i++) {
    const g = await du.reopenDynamicUi(page, 'Lot Management');
    await du.retrieve(page, g, 'LotNum', 'Contains', prefix, { expectRows: false });
    await page.waitForTimeout(3000);
    const rows = await du.rows(g);
    const mine = rows.filter((r) => r.split(/\s+/).some((t) => t.startsWith(prefix)));
    console.log(`CLEANUP pass ${i}: ${JSON.stringify(rows)}`);
    if (!mine.length) break;
    const lot = mine[0].split(/\s+/).find((t) => t.startsWith(prefix))!;
    await du.selectGridRow(g, lot);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
    await page.locator('li.ui-tabs-tab:has-text("Lot Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  }
}

test('Flex Printing: entry screen, lot lookup, add-at-print-time, messages, Reset (config: Item + Lot visible, Order AddOnly)', async ({ page }) => {
  test.setTimeout(900_000);
  const stamp = Date.now().toString().slice(-6);
  const prefix = `CLFLX${stamp}`;
  await login(page);
  const fp = new FlexPrint(page);
  try {
    await test.step('entry screen: Item Number + Lot Number, Next, Reset; the AddOnly Order Number box is not shown; first field has the cursor (DIT 6617)', async () => {
      await fp.open();
      expect(await fp.field('Item').count()).toBe(1);
      expect(await fp.field('Lot').count()).toBe(1);
      expect(await fp.field('Order').count(), 'Order Number is AddOnly: hidden until needed (FLX.190301.F.2.1)').toBe(0);
      const active = await fp.f.evaluate(() => (document.activeElement as HTMLInputElement | null)?.id ?? '');
      expect(active).toContain('txtItemNumber');
      expect(await fp.f.locator('#ctl00_btnNext').count()).toBe(1);
      expect(await fp.f.locator('#ctl00_btnResetAll').count()).toBe(1);
    });

    await test.step('FLX.190301.F.1.5 / U.1: Item + Lot of an existing lot -> the Lot Panel shows the Order Number of that lot', async () => {
      await fp.field('Item').fill(ITEM);
      await fp.field('Lot').fill(EXISTING_LOT);
      await fp.next();
      const b = await fp.body();
      const order = await fp.f.locator('input[id$="deLot_txtOrderNumber"]').inputValue().catch(() => '');
      console.log(`EXISTING LOT: order=${order} body=${b.slice(0, 200)}`);
      if (order !== 'MBBQN954324') deviation('FLX.190301.F.1.5', 'the order number of the matching lot is displayed', `"${order}"`);
      expect(await fp.f.locator('input[id$="deLot_txtLotNumber"]').inputValue()).toBe(EXISTING_LOT);
    });

    await test.step('FP.160323.F.5.1 / F.3.1 / U.3 / U.5: label screen offers the preview drop-down (View Master / Preview / Compare) and a Test Print check box (TestPrintShow = Y)', async () => {
      await fp.next(); // Lot Panel -> label screen (single label type is pre-selected)
      const selects = await fp.f.locator('select:visible').evaluateAll((els) => els.map((e: any) => `${e.id.split('_').slice(-2).join('_')}=[${[...e.options].map((o: any) => o.text).join('|')}]`));
      console.log(`LABEL SCREEN selects ${JSON.stringify(selects)}`);
      const action = selects.find((s) => s.startsWith('posPrintOptions_drpSelectedAction'))!;
      expect(action, 'preview drop-down').toBeTruthy();
      for (const o of ['View Master', 'View Preview', 'View Compare']) if (!action.includes(o)) deviation('FP.160323.F.5.1', `option "${o}"`, action);
      const test = fp.f.locator('input[id$="posPrintOptions_chbTestPrint"]');
      expect(await test.count(), 'Test Print check box shown').toBe(1);
      const printBtn = await fp.f.locator('input[id$="posPrintOptions_btnDoPrint"]').getAttribute('value');
      console.log(`TEST PRINT checked=${await test.isChecked()} button="${printBtn}" printer=${await fp.f.locator('select[id$="drpPrinters"] option:checked').innerText()}`);
    });

    await test.step('messages: blank entry, unknown item (the screen shows the Order box as soon as a lookup fails)', async () => {
      await fp.open();
      await fp.next();
      const blank = await fp.body();
      console.log(`BLANK: ${blank.slice(0, 160)} orderBox=${await fp.field('Order').count()}`);
      expect.soft(blank).toContain('No item found.');
      await fp.open();
      await fp.field('Item').fill('ZZNOITEM');
      await fp.field('Lot').fill('ZZLOT');
      await fp.next();
      const bad = await fp.body();
      console.log(`BAD ITEM: ${bad.slice(0, 160)}`);
      expect.soft(bad).toContain('No item found. ZZNOITEM');
    });

    await test.step('FLX.190301.F.2.2 / U.2 / F.1.1: unknown lot with BP_Add_Lot_Printtime -> message, Order box offered; entering an order adds the lot at print time', async () => {
      await fp.open();
      await fp.field('Item').fill(ITEM);
      await fp.field('Lot').fill(`${prefix}A`);
      await fp.next();
      const msg = await fp.body();
      console.log(`UNKNOWN LOT: ${msg.slice(0, 200)} orderBox=${await fp.field('Order').count()}`);
      expect.soft(msg).toContain('No Lot found for this order/lot/item combination. Please fix or continue.');
      if ((await fp.field('Order').count()) !== 1) deviation('FLX.190301.F.2.2', 'the identifier field not yet on the screen (Order Number) is displayed', 'no Order box');
      await fp.field('Order').fill(`${prefix}O`);
      await fp.next();
      expect(await fp.f.locator('input[id$="deLot_txtOrderNumber"]').inputValue()).toBe(`${prefix}O`);
      expect(await fp.f.locator('input[id$="deLot_txtLotNumber"]').inputValue()).toBe(`${prefix}A`);
    });

    await test.step('FLX.190301.F.2.2: the record can also be submitted with a blank identifier (Next again without an Order)', async () => {
      await fp.open();
      await fp.field('Item').fill(ITEM);
      await fp.field('Lot').fill(`${prefix}B`);
      await fp.next();
      await fp.next();
      const order = await fp.f.locator('input[id$="deLot_txtOrderNumber"]').inputValue().catch(() => 'n/a');
      console.log(`BLANK ORDER lot panel: order="${order}"`);
      expect(await fp.f.locator('input[id$="deLot_txtLotNumber"]').inputValue()).toBe(`${prefix}B`);
      expect(order).toBe('');
    });

    await test.step('FLX.190301.F.1.2: DeleteLotIfExists = N and an existing lot/order combination used for a different item', async () => {
      await fp.open();
      await fp.field('Item').fill(ITEM2);
      await fp.field('Lot').fill(`${prefix}A`);
      await fp.next();
      await fp.field('Order').fill(`${prefix}O`).catch(() => {});
      await fp.next();
      const t = await fp.body();
      console.log(`DIFFERENT ITEM: ${t.slice(0, 300)}`);
      if (!t.includes('Cannot update item number of an existing lot/order combination')) deviation('FLX.190301.F.1.2', '"Cannot update item number of an existing lot/order combination"', t.slice(0, 220));
    });

    await test.step('FP.160323.F.4.1 / U.4: Reset clears the entry fields', async () => {
      await fp.open();
      await fp.field('Item').fill(ITEM);
      await fp.field('Lot').fill(`${prefix}Z`);
      await fp.next();
      expect(await fp.field('Order').count()).toBe(1);
      await fp.reset();
      expect(await fp.field('Item').inputValue()).toBe('');
      expect(await fp.field('Lot').inputValue()).toBe('');
      // observed: the AddOnly Order box that a failed lookup revealed stays on the screen after Reset (empty); it is only absent when Reset follows an entry that never revealed it
      const orderLeft = await fp.field('Order').count();
      console.log(`AFTER RESET: Order box count=${orderLeft}`);
      if (orderLeft) expect(await fp.field('Order').inputValue()).toBe('');
    });
  } finally {
    await page.locator('li.ui-tabs-tab:has-text("Flex Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await deleteMbLots(page, prefix);
  }
});
