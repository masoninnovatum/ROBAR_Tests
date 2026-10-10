// Print by Order (legacy PrintScreen, ConfigName=print1) helper for HEADED specs (live 2026-10-09): enters order / item / lot, handles the Reason Code dialog (AddLotReasonRequired = Y) and the Lot Panel and returns on the label screen
// with "Microsoft Print to PDF" selected. `existing: true` = the lot already exists (the screen goes straight to the label screen after the first Next, no Lot Panel). Prints nothing.

import type { Page } from '@playwright/test';
import * as printing from './printing';
import * as bartender from './bartender';
import { PrintByLot, PDF } from './print-by-lot';

export interface OrderScreenOptions {
  /** the lot already exists (second visit) */
  existing?: boolean;
  /** Override Lot Data and set the Batch Qty (U2) on the Lot Panel */
  batch?: string;
  /** keep the default printer instead of selecting Microsoft Print to PDF */
  keepPrinter?: boolean;
}

export async function toOrderLabelScreen(page: Page, order: string, lot: string, item: string, opts: OrderScreenOptions = {}): Promise<PrintByLot> {
  const pb = new PrintByLot(page, 'Print by order');
  await pb.open();
  await pb.f.locator(`#${printing.orderNumberId}`).fill(order);
  await pb.next();
  const d = pb.f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
  for (let i = 0; i < 40 && !(await d.count()) && !(await pb.body()).includes('Override'); i++) await page.waitForTimeout(1000);
  if (await d.count()) {
    await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
    await d.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(6000);
    pb.f = await pb.frame();
  }
  for (const [id, value] of [[printing.itemNumberId, item], [printing.orderNumberId, order], [printing.lotNumberId, lot]] as const) {
    const l = pb.f.locator(`#${id}`);
    if ((await l.count()) && (await l.isEditable())) await l.fill(value);
  }
  await pb.next();
  if (!opts.existing) {
    if (opts.batch !== undefined) {
      await pb.f.locator('#ctl00_printContentHolder_deLot_chbLotOverride').check();
      await page.waitForTimeout(1200);
      await pb.f.locator('#ctl00_printContentHolder_deLot_txtLotU2').fill(opts.batch);
    }
    await pb.next();
  } else {
    await pb.f.getByRole('radio', { name: /Carton Label/ }).check({ timeout: 5000 }).catch(() => {});
  }
  await bartender.confirmSentinelLaunchPrompt(page, pb.pid).catch(() => {});
  await page.waitForTimeout(6000);
  pb.f = await pb.frame();
  for (let i = 0; i < 30 && (await pb.opt('drpPrinters').locator('option').count()) === 0; i++) await page.waitForTimeout(2000);
  if (!opts.keepPrinter) await pb.opt('drpPrinters').selectOption({ label: PDF });
  return pb;
}
