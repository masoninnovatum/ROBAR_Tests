// Reprint rule with ReprintBasedOnBatchQty = N (user flipped it for Print1, LotNumber and MultiDocPrint, 2026-10-09; TST703; HEADED, Print to PDF, ONE copy printed).
// ValMaster FRS-8.1.9.1: with the setting off, ALL subsequent prints are reprints (printed total > 0), whatever the batch quantity. Lot.IsReprint: `isReprint = totalCount > 0`.
// Item A, Override Batch Qty 1 (allowed 5): print 1 copy; the next visit on Print by Order AND on Print by Lot (same lot) must have Reprint ticked + disabled (with Y it would still be an original: 1 < 5).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { login } from '../support/robar';
import * as printing from '../support/printing';
import * as bartender from '../support/bartender';
import { PrintByLot, PDF } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const item = (f: string): string => JSON.parse(fs.readFileSync(f, 'utf8')).item as string;
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('ReprintBasedOnBatchQty = N: after ONE printed copy every further print is a reprint (Print by Order and Print by Lot)', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const A = item('test-data/batchqty-item-a.json');
  const stamp = Date.now().toString().slice(-6);
  const order = `MBBQN${stamp}`;
  const lot = `MBBQN${stamp}L`;
  console.log(`ORDER ${order} LOT ${lot}`);

  const state = async (pb: PrintByLot, label: string) => {
    const reprint = pb.opt('chbReprint');
    const s = { copies: await pb.opt('txtCopies').inputValue(), reprintChecked: await reprint.isChecked(), reprintDisabled: await reprint.isDisabled(), options: (await pb.body()).includes('Reprint Options') };
    console.log(`STATE ${label} ${JSON.stringify(s)}`);
    return s;
  };

  await test.step('Print by Order, new lot, Override Batch Qty 1: Copy 5, Reprint off; print ONE copy', async () => {
    const pb = new PrintByLot(page, 'Print by order');
    await pb.open();
    await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
    await pb.next();
    const d = pb.f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
    if (await d.count()) {
      await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
      await d.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(6000);
      pb.f = await pb.frame();
    }
    await pb.f.locator(`#${printing.itemNumberId}`).fill(A);
    if (await pb.f.locator(`#${printing.orderNumberId}`).count()) await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
    if (await pb.f.locator(`#${printing.lotNumberId}`).count()) await pb.f.locator(`#${printing.lotNumberId}`).fill(lot);
    await pb.next();
    await pb.f.locator('#ctl00_printContentHolder_deLot_chbLotOverride').check();
    await page.waitForTimeout(1200);
    await pb.f.locator('#ctl00_printContentHolder_deLot_txtLotU2').fill('1');
    await pb.next();
    await bartender.confirmSentinelLaunchPrompt(page, pb.pid).catch(() => {});
    await page.waitForTimeout(6000);
    pb.f = await pb.frame();
    for (let i = 0; i < 30 && (await pb.opt('drpPrinters').locator('option').count()) === 0; i++) await page.waitForTimeout(2000);
    await pb.opt('drpPrinters').selectOption({ label: PDF });
    const s = await state(pb, 'first');
    expect(s.reprintChecked, 'first print is an original').toBe(false);
    await pb.opt('txtCopies').fill('1');
    await pb.opt('txtCopies').press('Tab');
    const result = await pb.print();
    expect(result).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
  });

  await test.step('Print by Order again, same order: Reprint ticked and locked although only 1 of 5 was printed', async () => {
    const pb = new PrintByLot(page, 'Print by order');
    await pb.open();
    await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
    await pb.next();
    for (const id of [printing.itemNumberId, printing.lotNumberId]) {
      const l = pb.f.locator(`#${id}`);
      if ((await l.count()) && (await l.isEditable())) await l.fill(id === printing.itemNumberId ? A : lot);
    }
    await pb.next();
    await pb.f.getByRole('radio', { name: /Carton Label/ }).check({ timeout: 5000 }).catch(() => {});
    await bartender.confirmSentinelLaunchPrompt(page, pb.pid).catch(() => {});
    await page.waitForTimeout(6000);
    pb.f = await pb.frame();
    const s = await state(pb, 'order_again');
    if (!s.reprintChecked) deviation('FRS-8.1.9.1', 'every subsequent print is a reprint when ReprintBasedOnBatchQty = N', 'Reprint box not checked after 1 printed copy (Print1)');
    expect.soft(s.reprintChecked && s.reprintDisabled, 'Print1: Reprint ticked + locked').toBe(true);
  });

  await test.step('Print by Lot (LotNumber config), same lot: Reprint ticked and locked', async () => {
    const pb = new PrintByLot(page);
    await pb.open();
    await pb.toLabelScreen(lot);
    const s = await state(pb, 'lot_again');
    if (!s.reprintChecked) deviation('FRS-8.1.9.1', 'every subsequent print is a reprint when ReprintBasedOnBatchQty = N', 'Reprint box not checked after 1 printed copy (LotNumber)');
    expect.soft(s.reprintChecked && s.reprintDisabled, 'LotNumber: Reprint ticked + locked').toBe(true);
  });
});
