// InnoView "View Print History" report helper (live 2026-10-05). The DynamicUI "Print History Inquiry" grid returns HTTP 500 on TST703 (see the DIT
// tracker), but the legacy InnoView report (`Innovatum/innoview/Screens/ViewReport.aspx?ReportName=View Print History`) works and lists every REAL print
// (PrintStatus Printed): User ID, Work Station, Time Zone, Full Name, Item Number, IVersion, Label Name, LVersion, Order Num, Lot, Print Entity, Mfg/Exp/Rea
// Date, Lu1-5, Qty, Printer, Serial Num, Copies, Printid, Reprint, Batchqty, Print Date. Test Prints are NOT listed. Prompts, in order: UserID select,
// Template, Item, Order, Lot, Print Entity (text), Workstation select, Print Date Start, Print Date Finish; buttons Submit / Export.
// InnoView category "Print History" has three reports: View Print History, View Print History With Failed, View Print History Reprints.

import type { Frame, Page } from '@playwright/test';
import { openMenuItem } from './robar';

export interface PrintHistoryFilter {
  report?: 'View Print History' | 'View Print History With Failed' | 'View Print History Reprints';
  user?: string;
  template?: string;
  item?: string;
  order?: string;
  lot?: string;
  printEntity?: string;
}

export interface PrintHistoryRow {
  text: string;
}

/** Runs the InnoView report on an already logged-in page and returns the report text after the prompt block. */
export async function viewPrintHistory(page: Page, filter: PrintHistoryFilter = {}): Promise<{ frame: Frame; reportText: string }> {
  const report = filter.report ?? 'View Print History';
  await page.locator('li.ui-tabs-tab:has-text("InnoView") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'InnoView');
  await page.waitForTimeout(5000);
  let f = page.frames().filter((x) => /innoview/i.test(x.url())).pop()!;
  await f.getByText('Print History', { exact: true }).first().click({ timeout: 10_000 });
  await page.waitForTimeout(2500);
  await f.getByText(report, { exact: true }).first().click({ timeout: 10_000 });
  await page.waitForTimeout(6000);
  f = page.frames().filter((x) => /ViewReport/i.test(x.url())).pop()!;
  const selects = f.locator('select[name*="scriptPrompts"]');
  const texts = f.locator('input[type=text][name*="scriptPrompts"]');
  if (filter.user) await selects.first().selectOption({ label: filter.user }, { timeout: 10_000 });
  const fill = async (i: number, v?: string) => { if (v) await texts.nth(i).fill(v, { timeout: 10_000 }); };
  await fill(0, filter.template);
  await fill(1, filter.item);
  await fill(2, filter.order);
  await fill(3, filter.lot);
  await fill(4, filter.printEntity);
  await f.locator('input[type=submit][value="Submit"]').click({ timeout: 10_000 });
  await page.waitForTimeout(10_000);
  f = page.frames().filter((x) => /ViewReport/i.test(x.url())).pop()!;
  const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
  const at = body.indexOf('Print Date Finish:');
  return { frame: f, reportText: at >= 0 ? body.slice(at + 'Print Date Finish:'.length).trim() : body };
}
