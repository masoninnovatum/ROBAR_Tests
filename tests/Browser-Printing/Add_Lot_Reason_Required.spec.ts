// AddLotReasonRequired = Y on the print screens (live 2026-10-08, headless, TST703, seed user; prints NOTHING; user set the Print Config values to Y, restart not needed).
// A brand-new order / lot on Print by order, Print by lot, Print by order multi and Print by lot multi shows the dialog "Reason Code": "You are about to add a new lot record, please select a Reason Code in
// order to proceed." (#reasonSel dropdown "(Select Reason)" + the AddLotReasonRequired codes, optional #commentTxt, Reset / Submit / Close). Submit without a reason -> "This field is required.".
// Print by order lot has NO dialog here (its AddLotReasonRequired config is not Y): "No Lot found for this order/lot/item combination. Please fix or continue.".
// The lot record is created as soon as the Lot Panel appears (after the dialog + Item / Order step; dates 01/01/1900), before printing: the spec deletes it in Lot Management (one lot per run).
// A first run on 2026-10-08 left MBRL459052P (ROBAR, MI080301) behind because the assertion assumed the opposite: delete it manually in Lot Management if it is still there.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem } from '../support/robar';
import { nativeClick, lotNumberId, itemNumberId, orderNumberId, nextButtonId } from '../support/printing';
import * as du from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

const frameOf = (page: Page): Frame => page.frames().filter((x) => x.url().includes('PrintScreen')).pop()!;
const bodyOf = async (page: Page): Promise<string> => (await frameOf(page).locator('body').innerText()).replace(/\s+/g, ' ');
const dialog = (page: Page) => frameOf(page).locator('.ui-dialog:visible', { hasText: 'Reason Code' });

async function openScreen(page: Page, tile: string): Promise<void> {
  await page.locator(`li.ui-tabs-tab:has-text("${tile}") .ui-icon-close`).click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, tile);
  await page.waitForTimeout(5000);
}
async function enterNew(page: Page, order: string | null, lot: string | null): Promise<void> {
  const f = frameOf(page);
  if (order !== null) await f.locator(`#${orderNumberId}`).fill(order);
  if (lot !== null) await f.locator(`#${lotNumberId}`).fill(lot);
  await nativeClick(f, nextButtonId);
  await page.waitForTimeout(6000);
}

test('AddLotReasonRequired: the Reason Code dialog on the print screens', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const lot = (n: string) => `MBRL${stamp}${n}`;

  const screens: Array<{ tile: string; order: boolean; lot: boolean }> = [
    { tile: 'Print by order', order: true, lot: false },
    { tile: 'Print by lot', order: false, lot: true },
    { tile: 'Print by order multi', order: true, lot: false },
    { tile: 'Print by lot multi', order: false, lot: true },
  ];
  for (const s of screens) {
    await test.step(`${s.tile}: new ${s.order ? 'order' : 'lot'} -> Reason Code dialog; empty Submit refused; Close dismisses it`, async () => {
      await openScreen(page, s.tile);
      await enterNew(page, s.order ? lot('O') : null, s.lot ? lot('L') : null);
      const d = dialog(page);
      await expect(d, `${s.tile}: dialog`).toBeVisible();
      await expect(d).toContainText('You are about to add a new lot record, please select a Reason Code in order to proceed.');
      const opts = await d.locator('#reasonSel option').allInnerTexts();
      expect(opts[0]).toBe('(Select Reason)');
      expect(opts.length).toBeGreaterThan(1);
      console.log(`${s.tile} reasons: ${JSON.stringify(opts)}`);
      await d.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(1200);
      await expect(d).toContainText('This field is required.');
      await d.locator('button').filter({ hasText: 'Close' }).first().click();
      await page.waitForTimeout(1000);
      await expect(dialog(page)).toHaveCount(0);
    });
  }

  await test.step('Print by lot: a reason + comment lets the flow continue (Item / Order, then the Lot Panel); no lot exists yet', async () => {
    await openScreen(page, 'Print by lot');
    await enterNew(page, null, lot('P'));
    const d = dialog(page);
    await expect(d).toBeVisible();
    await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
    await d.locator('#commentTxt').fill('Playwright reason');
    await d.getByRole('button', { name: 'Submit' }).click();
    await page.waitForTimeout(6000);
    const f = frameOf(page);
    await expect(f.locator(`#${itemNumberId}`)).toBeVisible();
    await f.locator(`#${itemNumberId}`).fill('MI080301');
    await f.locator(`#${orderNumberId}`).fill(`${lot('P')}O`);
    await nativeClick(f, nextButtonId);
    await page.waitForTimeout(6000);
    const body = await bodyOf(page);
    expect(body).toContain('Override Lot');
    expect(body).toContain('Item: MI080301');
    const g = await du.reopenDynamicUi(page, 'Lot Management');
    await du.retrieve(page, g, 'LotNum', 'Contains', `MBRL${stamp}`, { expectRows: false });
    await page.waitForTimeout(5000);
    const rows = await du.rows(g);
    console.log(`lots created before printing: ${JSON.stringify(rows)}`);
    // live 2026-10-08: the lot record is already created when the Lot Panel appears (placeholder dates 01/01/1900), before anything is printed
    expect(rows.filter((r) => r.includes(`MBRL${stamp}P`))).toHaveLength(1);
    expect(rows.find((r) => r.includes(`MBRL${stamp}P`))).toContain('MI080301');
    expect(rows.find((r) => r.includes(`MBRL${stamp}P`))).toContain('01/01/1900');
    // clean up the lot (Lot Management delete)
    await du.selectGridRow(g, `MBRL${stamp}P`);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
    await du.retrieve(page, g, 'LotNum', 'Contains', `MBRL${stamp}`, { expectRows: false });
    await page.waitForTimeout(4000);
    expect((await du.rows(g)).filter((r) => r.includes(`MBRL${stamp}`)), 'lot deleted').toEqual([]);
  });

  await test.step('Print by order lot: no Reason Code dialog (its config is not Y); "No Lot found ... Please fix or continue."', async () => {
    await openScreen(page, 'Print by order lot');
    await enterNew(page, lot('X'), lot('Y'));
    await expect(dialog(page)).toHaveCount(0);
    expect(await bodyOf(page)).toContain('No Lot found for this order/lot/item combination. Please fix or continue.');
  });
});
