// Batch Quantity x Multiplier + Extra on the print screens (live 2026-10-09, HEADED: the Sentinel prompt is confirmed with FlaUI -- hands off the mouse; seed user Claude01, TST703; PRINTS NOTHING).
// ValMaster (module "WEB - Print Request"): FRS-8.1.7.3 total printed quantity = (Batch qty) x (Multiplier) + (extra); the extra may be written with a "P" / "p" suffix = percent of (batch x multiplier), always rounded up.
// Print Config (Print1 / LotNumber / ...): LotBatchQuantityField = u2 (the lot's U2, labelled "Batch Qty" on the lot panel), ItemQuantityMultiplierField = Qty2, ItemExtraQuantityField = u5 (item fields).
// Fixture items (created once, approved, LCN assigned, no label master, template A1SuperTemplate / Carton Label): A = Qty2 3 / u5 2, B = Qty2 2 / u5 "10P" (test-data/batchqty-item-a.json / -b.json).
// Each case enters a NEW order + lot, ticks Override on the lot panel, sets the Batch Qty and reads the Copy field of the label screen. The unprinted lots are deleted in Lot Management at the end.

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { login } from '../support/robar';
import * as printing from '../support/printing';
import * as du from '../support/dynamic-ui';
import * as bartender from '../support/bartender';
import { PrintByLot } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const P = 'ctl00_printContentHolder_';
const item = (f: string): string => JSON.parse(fs.readFileSync(f, 'utf8')).item as string;

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Batch Quantity x Multiplier + Extra: the Copy field on Print by Order / Print by Lot (no print)', async ({ page }) => {
  test.setTimeout(1_500_000);
  await login(page);
  const A = item('test-data/batchqty-item-a.json');
  const B = item('test-data/batchqty-item-b.json');
  const stamp = Date.now().toString().slice(-6);
  const lots: string[] = [];
  let n = 0;

  /** New order / lot for `itemNumber`, optional Override + Batch Qty, returns the label-screen Copy value. */
  const copyFor = async (tile: 'Print by order' | 'Print by lot', itemNumber: string, batch: string | null): Promise<string> => {
    n += 1;
    const order = `MBBQO${stamp}${n}`;
    const lot = `MBBQL${stamp}${n}`;
    lots.push(lot);
    const pb = new PrintByLot(page, tile);
    await pb.open();
    if (tile === 'Print by order') {
      await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
    } else {
      await pb.f.locator(`#${printing.lotNumberId}`).fill(lot);
    }
    await pb.next();
    const d = pb.f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
    if (await d.count()) {
      await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
      await d.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(6000);
      pb.f = await pb.frame();
    }
    await pb.f.locator(`#${printing.itemNumberId}`).fill(itemNumber);
    if (await pb.f.locator(`#${printing.orderNumberId}`).count()) await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
    if (await pb.f.locator(`#${printing.lotNumberId}`).count()) await pb.f.locator(`#${printing.lotNumberId}`).fill(lot);
    await pb.next();
    if (batch !== null) {
      await pb.f.locator(`#${P}deLot_chbLotOverride`).check();
      await page.waitForTimeout(1200);
      await pb.f.locator(`#${P}deLot_txtLotU2`).fill(batch);
    }
    await pb.next();
    await bartender.confirmSentinelLaunchPrompt(page, pb.pid).catch(() => {});
    await page.waitForTimeout(6000);
    pb.f = await pb.frame();
    const copy = await pb.f.locator(`#${P}posPrintOptions_txtCopies`).inputValue();
    console.log(`${tile} item ${itemNumber} batch ${batch ?? '(blank)'} -> Copy ${copy}`);
    return copy;
  };
  const check = (label: string, expected: number, actual: string): void => {
    if (String(expected) !== actual) deviation('WEB-Print Request FRS-8.1.7.3', `${label} = ${expected} copies`, actual);
    expect.soft(actual, label).toBe(String(expected));
  };

  try {
    await test.step('item A (multiplier 3, extra 2): blank batch -> 2; batch 10 -> 32; batch 5 -> 17', async () => {
      check('A blank batch: 0 x 3 + 2', 2, await copyFor('Print by order', A, null));
      check('A batch 10: 10 x 3 + 2', 32, await copyFor('Print by order', A, '10'));
      check('A batch 5: 5 x 3 + 2', 17, await copyFor('Print by order', A, '5'));
    });
    await test.step('item B (multiplier 2, extra "10P" = 10 % of batch x multiplier, rounded UP): batch 10 -> 22; batch 7 -> 16', async () => {
      check('B batch 10: 10 x 2 + ceil(10% of 20) = 20 + 2', 22, await copyFor('Print by order', B, '10'));
      check('B batch 7: 7 x 2 + ceil(10% of 14) = 14 + 2', 16, await copyFor('Print by order', B, '7'));
    });
    await test.step('Print by Lot uses the same rule (LotNumber config): item A batch 10 -> 32', async () => {
      check('Print by lot A batch 10', 32, await copyFor('Print by lot', A, '10'));
    });
  } finally {
    await test.step('cleanup: delete the unprinted lots in Lot Management', async () => {
      for (const lot of lots) {
        try {
          const f = await du.reopenDynamicUi(page, 'Lot Management');
          await f.click('#btnReset').catch(() => {});
          await page.waitForTimeout(2500);
          const g = await du.reopenDynamicUi(page, 'Lot Management');
          await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
          await g.locator('tr.jqgrow').first().waitFor({ timeout: 30_000 }).catch(() => {});
          if ((await du.rows(g)).length === 1) {
            await du.selectGridRow(g, lot);
            await g.click('#del_grdJqGrid');
            await page.waitForTimeout(1200);
            await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
            await page.waitForTimeout(2500);
          }
        } catch (e) {
          console.log(`lot cleanup ${lot} skipped: ${String(e).slice(0, 100)}`);
        }
      }
    });
  }
});
