// Print by Order / Print by Lot when the number is assigned to MULTIPLE items (live 2026-10-09, HEADED because the screens raise the Sentinel prompt; PRINTS NOTHING; seed user Claude01, TST703).
// ValMaster (module "WEB - Print Request"): FRS-8.1.3.13 -- printing with Print by Order and an Order number assigned to multiple items displays an error; FRS-8.1.3.12 -- the same for Print by (Lot) with a Lot number
// assigned to multiple items. Setup through Lot Management (Add): order O with lots L1 (item A) and L2 (item B); lot L1 again under order O2 with item B. The unprinted lots are deleted at the end.

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { login } from '../support/robar';
import * as printing from '../support/printing';
import * as du from '../support/dynamic-ui';
import { PrintByLot } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const item = (f: string): string => JSON.parse(fs.readFileSync(f, 'utf8')).item as string;
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Print by Order / Print by Lot: a number assigned to multiple items shows an error', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const A = item('test-data/batchqty-item-a.json');
  const B = item('test-data/batchqty-item-b.json');
  const stamp = Date.now().toString().slice(-6);
  const order = `MBPRO${stamp}`;
  const order2 = `MBPRO${stamp}B`;
  const lot1 = `MBPRL${stamp}A`;
  const lot2 = `MBPRL${stamp}B`;
  const created: string[] = [];

  const addLot = async (o: string, l: string, i: string) => {
    const g = await du.reopenDynamicUi(page, 'Lot Management');
    await du.retrieve(page, g, 'LotNum', 'Contains', 'MBPRL', { expectRows: false });
    await page.waitForTimeout(3000);
    const dlg = await du.openFormDialog(g, 'add');
    for (const [name, value] of Object.entries({ OrderNum: o, LotNum: l, ItemNumber: i })) await dlg.locator(`[name="${name}"]`).fill(value);
    await du.submitForm(g);
    await page.waitForTimeout(2000);
    const open = (await g.locator('.ui-jqdialog:visible').count()) > 0;
    const err = open ? await du.formError(g) : '';
    if (open) await du.cancelForm(g);
    console.log(`add ${o} / ${l} / ${i}: ${open ? 'REFUSED ' + err : 'created'}`);
    if (!open) created.push(`${o}|${l}`);
    return !open;
  };

  try {
    await test.step('setup in Lot Management: order O -> lots L1 (item A) and L2 (item B); lot L1 also under order O2 with item B', async () => {
      expect(await addLot(order, lot1, A)).toBe(true);
      expect(await addLot(order, lot2, B)).toBe(true);
      expect(await addLot(order2, lot1, B), 'the same lot number under another order').toBe(true);
    });

    await test.step('Print by Order with an order assigned to two items: an error (FRS-8.1.3.13)', async () => {
      const pb = new PrintByLot(page, 'Print by order');
      await pb.open();
      await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
      await pb.next();
      pb.f = await pb.frame();
      const text = await pb.body();
      console.log(`PRINT BY ORDER multi-item order -> ${text.slice(0, 400)}`);
      const dialog = (await pb.f.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
      console.log(`dialog: ${dialog}`);
      const shown = /multiple|more than one|more than 1|assigned to/i.test(text + ' ' + dialog);
      if (!shown) deviation('FRS-8.1.3.13', 'an error that the order is assigned to multiple items', `no such message (${text.slice(0, 160)})`);
      expect.soft(shown, 'error for an order assigned to multiple items').toBe(true);
    });

    await test.step('Print by Lot with a lot number assigned to two items: an error (FRS-8.1.3.12)', async () => {
      const pb = new PrintByLot(page);
      await pb.open();
      await pb.f.locator(`#${printing.lotNumberId}`).fill(lot1);
      await pb.next();
      pb.f = await pb.frame();
      const text = await pb.body();
      console.log(`PRINT BY LOT multi-item lot -> ${text.slice(0, 400)}`);
      const dialog = (await pb.f.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
      console.log(`dialog: ${dialog}`);
      const shown = /multiple|more than one|more than 1|assigned to/i.test(text + ' ' + dialog);
      if (!shown) deviation('FRS-8.1.3.12', 'an error that the lot is assigned to multiple items', `no such message (${text.slice(0, 160)})`);
      expect.soft(shown, 'error for a lot assigned to multiple items').toBe(true);
    });
  } finally {
    await test.step('cleanup: delete the unprinted lots in Lot Management', async () => {
      for (const key of created) {
        const [o, l] = key.split('|');
        try {
          const g = await du.reopenDynamicUi(page, 'Lot Management');
          await du.retrieve(page, g, 'OrderNum', 'Exactly Matches', o, { expectRows: false });
          await page.waitForTimeout(4000);
          const rows = (await du.rows(g)).filter((r) => r.includes(l));
          if (rows.length) {
            await du.selectGridRow(g, l);
            await g.click('#del_grdJqGrid', { timeout: 10_000 });
            await page.waitForTimeout(1200);
            await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
            await page.waitForTimeout(2500);
          }
        } catch (e) {
          console.log(`cleanup ${key} skipped: ${String(e).slice(0, 100)}`);
        }
      }
    });
  }
});
