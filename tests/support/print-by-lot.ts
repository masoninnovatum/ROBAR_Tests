// Print by Lot (legacy PrintScreen.aspx?ConfigName=LotNumber) driver for HEADED specs (live 2026-10-07; see Browser-Printing/Print_By_Lot.spec.ts and the reference's "Print by Lot, PrintEntityRequired = N").
// The Print button needs a REAL click (user activation) or Chrome blocks the sentinel: launch; Next works with nativeClick. Sentinel prompts are confirmed with FlaUI. Only "Microsoft Print to PDF".

import type { Frame, Page } from '@playwright/test';
import * as printing from './printing';
import * as bartender from './bartender';

export const P = 'ctl00_printContentHolder_';
export const PDF = 'Microsoft Print to PDF';

export class PrintByLot {
  f!: Frame;
  pid = 0;
  constructor(readonly page: Page) {}

  async frame(): Promise<Frame> {
    for (let i = 0; i < 20; i++) {
      const g = this.page.frames().filter((x) => x.url().includes('PrintScreen')).pop();
      if (g) return g;
      await this.page.waitForTimeout(1000);
    }
    throw new Error('Print screen did not load');
  }
  body = async () => (await this.f.locator('body').innerText()).replace(/\s+/g, ' ');
  opt = (suffix: string) => this.f.locator(`#${P}posPrintOptions_${suffix}`);

  /** Opens the Print by lot tile (closing a stale tab first); confirms the Sentinel prompt. */
  async open(): Promise<void> {
    const { page } = this;
    await page.locator('li.ui-tabs-tab:has-text("Print by lot") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Print by lot', exact: true }).click();
    await page.waitForTimeout(4000);
    this.pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, this.pid);
    this.f = await this.frame();
    await page.waitForTimeout(3000);
  }

  async next(): Promise<void> {
    await printing.nativeClick(this.f, printing.nextButtonId);
    await this.page.waitForTimeout(6000);
  }

  /** Enters lot (+ item / order for a new lot) and goes Next until the label screen (Sentinel prompt after the last Next). */
  async toLabelScreen(lot: string, item?: string, order?: string, labelType?: string): Promise<void> {
    await this.f.locator(`#${printing.lotNumberId}`).fill(lot);
    await this.next();
    if (item) {
      await this.f.locator(`#${printing.itemNumberId}`).fill(item);
      await this.f.locator(`#${printing.orderNumberId}`).fill(order ?? `${lot}O`);
      await this.next();
    }
    await this.next();
    await bartender.confirmSentinelLaunchPrompt(this.page, this.pid).catch(() => {});
    await this.page.waitForTimeout(6000);
    this.f = await this.frame();
    if (labelType) {
      // an item with several label types shows radios first; the printer / LCN block appears after one is chosen
      await this.f.locator('label, span').filter({ hasText: new RegExp('^' + labelType) }).first().click({ timeout: 5000 }).catch(() => {});
      await this.f.getByRole('radio', { name: new RegExp(labelType) }).check({ timeout: 5000 }).catch(() => {});
      await this.page.waitForTimeout(6000);
    }
    // the printer list is filled asynchronously from the Sentinel client (GetPrinters); wait for it
    for (let i = 0; i < 30 && (await this.opt('drpPrinters').locator('option').count()) === 0; i++) await this.page.waitForTimeout(2000);
    console.log('PRINTER OPTIONS', JSON.stringify(await this.opt('drpPrinters').locator('option').allInnerTexts()));
    await this.opt('drpPrinters').selectOption({ label: PDF });
  }

  /** Real click on Print, confirm the Sentinel prompt, wait for the result text; returns the page text. */
  async print(): Promise<string> {
    await this.opt('btnDoPrint').click();
    for (let i = 0; i < 20; i++) {
      await this.page.waitForTimeout(2000);
      await bartender.confirmSentinelLaunchPrompt(this.page, this.pid).catch(() => {});
      this.f = await this.frame();
      const text = await this.body().catch(() => '');
      if (/Printed PID_\w+\.prn|Timeout waiting for Sentinel|Print Failed/i.test(text)) {
        await this.f.locator('.ui-dialog:visible button, input[value=Ok]').filter({ hasText: /Ok/ }).first().click({ timeout: 3000 }).catch(() => {});
        return text;
      }
    }
    return this.body().catch(() => '');
  }
}
