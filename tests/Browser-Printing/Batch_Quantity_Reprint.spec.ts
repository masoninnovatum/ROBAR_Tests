// Reprint rule with Batch Quantity (live 2026-10-09, HEADED, Print to PDF only, FEW copies; seed user Claude01, TST703).
// ValMaster FRS-8.1.9.1/9.2 (module "WEB - Print Request"): with ReprintBasedOnBatchQty = Y the Reprint box is defaulted AND forced on when (already printed qty + qty about to print) exceeds the batch qty
// x multiplier + extra of the item / label type; reprint records in the history are ignored in the count. Item A (Qty2 3, u5 2), Override Batch Qty 1 -> allowed total 5 copies.
// Sequence on ONE new order/lot: print 3 (total 3), print 2 (total 5 = allowed), print 1 (total 6 > 5 -> must be a reprint). 6 copies in all. The lot stays unless deleted in Lot Management (possible, verified 2026-10-09).

import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { login, PASSWORD } from '../support/robar';
import * as printing from '../support/printing';
import * as bartender from '../support/bartender';
import { PrintByLot, PDF } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const item = (f: string): string => JSON.parse(fs.readFileSync(f, 'utf8')).item as string;
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Batch Quantity reprint threshold: Reprint box forced on when printed + about to print exceeds the allowed quantity (Print by Order, Print to PDF)', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const A = item('test-data/batchqty-item-a.json');
  const stamp = process.env.RESUME_STAMP ?? Date.now().toString().slice(-6);
  const order = `MBBQR${stamp}`;
  const lot = `MBBQR${stamp}L`;
  const pb = new PrintByLot(page, 'Print by order');
  console.log(`ORDER ${order} LOT ${lot}`);
  const states: Record<string, unknown> = {};

  const state = async (label: string) => {
    const copies = await pb.opt('txtCopies').inputValue();
    const reprint = pb.opt('chbReprint');
    const s = { copies, reprintChecked: await reprint.isChecked(), reprintDisabled: await reprint.isDisabled(), marker: (await pb.body()).match(/Reprint[^A-Za-z]{0,40}/)?.[0] };
    states[label] = s;
    console.log(`STATE ${label} ${JSON.stringify(s)}`);
    return s;
  };
  const fillIfEditable = async (id: string, v: string) => {
    const l = pb.f.locator(`#${id}`);
    if ((await l.count()) && (await l.isEditable())) await l.fill(v);
  };
  const toLabelScreen = async (first: boolean) => {
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
    await fillIfEditable(printing.itemNumberId, A);
    await fillIfEditable(printing.orderNumberId, order);
    await fillIfEditable(printing.lotNumberId, lot);
    await pb.next();
    console.log(`PANEL ${first ? 'first' : 'again'}: ${(await pb.body()).slice(0, 200)}`);
    if (first) {
      await pb.f.locator('#ctl00_printContentHolder_deLot_chbLotOverride').check();
      await page.waitForTimeout(1200);
      await pb.f.locator('#ctl00_printContentHolder_deLot_txtLotU2').fill('1');
    }
    if (first) {
      await pb.next();
    } else {
      // an existing lot goes straight to the label screen (no lot panel); pick the label type radio
      await pb.f.getByRole('radio', { name: /Carton Label/ }).check({ timeout: 5000 }).catch(() => {});
    }
    await bartender.confirmSentinelLaunchPrompt(page, pb.pid).catch(() => {});
    await page.waitForTimeout(6000);
    pb.f = await pb.frame();
    for (let i = 0; i < 30 && (await pb.opt('drpPrinters').locator('option').count()) === 0; i++) await page.waitForTimeout(2000);
    await pb.opt('drpPrinters').selectOption({ label: PDF });
  };
  const printCopies = async (n: string) => {
    await pb.opt('txtCopies').fill(n);
    await pb.opt('txtCopies').press('Tab');
    await page.waitForTimeout(800);
    const result = await pb.print();
    console.log(`PRINT ${n}: ${result.slice(-200)}`);
    expect(result).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
  };

  if (!process.env.RESUME_STAMP) await test.step('visit 1: new lot, Override Batch Qty 1 -> Copy 5, Reprint not forced; print 3 copies', async () => {
    await toLabelScreen(true);
    const s = await state('visit1');
    if (s.copies !== '5') deviation('FRS-8.1.7.3', 'Copy 5 (1 x 3 + 2)', String(s.copies));
    await printCopies('3');
  });
  if (!process.env.RESUME_STAMP) await test.step('visit 2: same lot (3 printed); Copy 3 would make 6 > 5, Copy 2 = 5 = allowed; print 2 more', async () => {
    await toLabelScreen(false);
    const s0 = await state('visit2');
    if (s0.reprintChecked) deviation('FRS-8.1.9.2', 'Reprint box unchecked (printed 3 < batch 5)', 'checked');
    for (const c of ['3', '2']) {
      await pb.opt('txtCopies').fill(c);
      await pb.opt('txtCopies').press('Tab');
      await page.waitForTimeout(800);
      const s = await state(`visit2_copy${c}`);
      if (c === '3' && !s.reprintChecked) deviation('FRS-8.1.9.2', 'Reprint box forced on when printed 3 + about to print 3 = 6 exceeds the batch total 5 (the code comment in Lot.IsReprint says the UI comparison "is currently not supported")', 'Reprint box stays unchecked');
    }
    await printCopies('2');
  });
  await test.step('visit 3: same lot; 1 more copy would make 6 > 5 -> Reprint must be defaulted and forced on', async () => {
    await toLabelScreen(false);
    await state('visit3');
    await pb.opt('txtCopies').fill('1');
    await pb.opt('txtCopies').press('Tab');
    await page.waitForTimeout(800);
    const s = await state('visit3_copy1');
    if (!s.reprintChecked) deviation('FRS-8.1.9.2', 'Reprint box checked (printed 5 + 1 > batch 5)', 'Reprint box not checked');
    if (!s.reprintDisabled) console.log('NOTE: Reprint box is checked but not locked (forced = disabled?)');
    // a forced reprint needs the Reprint Options (reason + password); without them: "Please select a reprint reason."
    await pb.opt('btnDoPrint').click();
    await page.waitForTimeout(3000);
    pb.f = await pb.frame();
    expect(await pb.body()).toContain('Please select a reprint reason.');
    await pb.f.locator('.ui-dialog:visible button').filter({ hasText: /Ok/ }).first().click({ timeout: 3000 }).catch(() => {});
    await pb.opt('selSignature_ctl09').selectOption({ label: 'Damaged Labels' });
    const pw = pb.opt('selSignature_ctl07');
    await pw.fill('');
    await pw.pressSequentially(PASSWORD, { delay: 40 });
    await pb.opt('selSignature_ctl11').fill('Playwright batch quantity reprint');
    const result = await pb.print();
    console.log(`PRINT reprint 1: ${result.slice(-160)}`);
    expect(result).toMatch(/Printed PID_\w+\.prn to Microsoft Print to PDF/);
  });
  fs.mkdirSync('test-data/run-results', { recursive: true });
  fs.writeFileSync('test-data/run-results/batchqty-reprint-results.json', JSON.stringify({ order, lot, states }, null, 2));
});
