// Flex Printing (legacy PrintScreen.aspx?ConfigName=FlexPrinting) driver for HEADED specs (live 2026-10-12). Entry fields are rendered from the PrintConfig rows Flex_Identifier_n
// (FlexLot_ItemNumber / FlexLot_LotNum / FlexLot_OrderNum, "AddOnly" = shown only when needed); ids end in customControl_txtItemNumber / _txtLotNumber / _txtOrderNumber.
// Chrome shows "Open SentinelLauncher?" when the screen opens: confirmed with FlaUI like Print by Lot. Next works with a native click; nothing here prints.

import type { Frame, Page } from '@playwright/test';
import * as bartender from './bartender';
import * as printing from './printing';
import * as pc from './print-config';

export class FlexPrint {
  f!: Frame;
  pid = 0;
  constructor(readonly page: Page, readonly tile = 'Flex Printing') {}

  async frame(): Promise<Frame> {
    for (let i = 0; i < 20; i++) {
      const g = this.page.frames().filter((x) => /PrintScreen/i.test(x.url())).pop();
      if (g) return g;
      await this.page.waitForTimeout(1000);
    }
    throw new Error('Flex print screen did not load');
  }
  body = async () => (await this.f.locator('body').innerText()).replace(/\s+/g, ' ').trim();
  field = (kind: 'Item' | 'Lot' | 'Order') => this.f.locator(`input[id$="customControl_txt${kind === 'Order' ? 'Order' : kind + 'Number'}"]`);

  /** Opens the tile (closing a stale tab first) and confirms the Sentinel prompt. */
  async open(): Promise<void> {
    const { page } = this;
    await page.locator(`li.ui-tabs-tab:has-text("${this.tile}") .ui-icon-close`).click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: this.tile, exact: true }).click();
    await page.waitForTimeout(4000);
    this.pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, this.pid).catch(() => {});
    await page.waitForTimeout(3000);
    this.f = await this.frame();
  }

  async next(): Promise<void> {
    await printing.nativeClick(this.f, printing.nextButtonId);
    await this.page.waitForTimeout(6000);
    await bartender.confirmSentinelLaunchPrompt(this.page, this.pid).catch(() => {});
    await this.page.waitForTimeout(2000);
    this.f = await this.frame();
  }

  async reset(): Promise<void> {
    await printing.nativeClick(this.f, 'ctl00_btnResetAll');
    await this.page.waitForTimeout(4000);
    this.f = await this.frame();
  }

  async controls(): Promise<string[]> {
    return this.f.locator('input:visible, select:visible').evaluateAll((els) => els.map((e: any) => `${e.id.split('_').slice(-2).join('_')}|${e.type}|${e.value}|${e.disabled}`));
  }
}

/** The FlexPrinting identifier layout every Flex spec expects, and the layouts Flex_Printing_Config_Variants itself switches to. */
export const FLEX_BASE: Record<number, string> = { 1: 'FlexLot_ItemNumber, Item Number', 2: 'FlexLot_LotNum, Lot Number', 3: 'FlexLot_OrderNum, Order Number, AddOnly' };
const FLEX_SPEC_VARIANTS: Record<number, string[]> = {
  1: ['FlexLot_ItemNumber, Item Number, AddOnly'],
  2: ['FlexLot_LotNum, Lot Number, AddOnly'],
  3: ['FlexLot_OrderNum, Order Number', 'FlexLot_Expires, Expiration Date, Date, Protect'],
};

/** Call after login in every Flex spec. An interrupted Flex_Printing_Config_Variants run (killed process, so its `finally` never ran) leaves the FlexPrinting
 * identifiers on one of its own layouts and every other Flex spec then fails confusingly (2026-10-19: lot field hidden). Restores the base layout when a row holds
 * one of the layouts the specs themselves set (FlexPrinting edits are allowed, see feedback-flexprinting-printconfig-ok); any other value is somebody's change -> fail. */
export async function ensureFlexBase(page: Page): Promise<void> {
  for (const n of [1, 2, 3]) {
    const cur = await pc.readParam(page, 'FlexPrinting', `Flex_Identifier_${n}`);
    if (cur === FLEX_BASE[n]) continue;
    if (!FLEX_SPEC_VARIANTS[n].includes(cur)) throw new Error(`Flex_Identifier_${n} is "${cur}", neither the base "${FLEX_BASE[n]}" nor a layout these specs set: not touching it`);
    await pc.setParamValue(page, 'FlexPrinting', `Flex_Identifier_${n}`, cur, FLEX_BASE[n]);
    console.log(`RESTORED Flex_Identifier_${n} to the base layout (an earlier run left "${cur}")`);
  }
}
