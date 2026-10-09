// Multi Document Printing and Batch Quantity x Multiplier + Extra (live 2026-10-09, HEADED, Print to PDF only, ONE copy printed; seed user Claude01, TST703).
// ValMaster MDP.180418.F.14.1: non-serialized Copies in the Labeling grid = Batch Quantity x Multiplier + Extra of the Item / Lot; F.14.2: no values -> Copies = 1; F.4.12: editing the Lot Batch Quantity via
// "Override Lot Data" (+ Save) updates Copies; F.7.1: a reprint row shows "R" next to the checkbox (second print, or reprint by batch qty). Item A: Qty2 3 / u5 2 (copies = batch x 3 + 2).
// Prerequisite: ReprintBasedOnBatchQty = N for MultiDocPrint (user flipped 2026-10-09) -> any second print is a reprint. The throw-away lots: MBBQM<stamp>L (printed, stays), MBBQM<stamp>XL (item MI080301, unprinted, deleted).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import { login } from '../support/robar';
import * as bartender from '../support/bartender';
import * as du from '../support/dynamic-ui';

test.use({ headless: false, actionTimeout: 20_000 });

const PDF_PRINTER = 'Microsoft Print to PDF';
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Multi Document Printing: Copies = Batch Qty x Multiplier + Extra, Override Lot Data recalculation, no values -> 1, R marker after a print', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const A = JSON.parse(fs.readFileSync('test-data/batchqty-item-a.json', 'utf8')).item as string;
  const stamp = Date.now().toString().slice(-6);
  const order = `MBBQM${stamp}`;
  const lot = `MBBQM${stamp}L`;
  const lot2 = `MBBQM${stamp}XL`;
  let pid = 0;
  let f!: Frame;
  const frame = (): Frame => page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop()!;
  const pdfRow = () => f.locator('tr').filter({ has: f.locator('select') }).filter({ hasText: PDF_PRINTER }).last();
  const copies = async (): Promise<string> => f.locator('input[name=txtCopies]').last().inputValue();

  const openLot = async (orderNo: string, lotNo: string, item: string) => {
    await page.locator('li.ui-tabs-tab:has-text("Multi Document Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click();
    await page.waitForTimeout(4000);
    pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, pid).catch(() => {});
    for (let i = 0; i < 20; i++) {
      f = frame();
      if (f && (await f.locator('input[name="FlexLot_OrderNum"]').count()) > 0) break;
      await page.waitForTimeout(1000);
    }
    await f.locator('select').first().selectOption({ label: 'ROBAR' }).catch(() => {});
    await f.locator('input[name="FlexLot_OrderNum"]').fill(orderNo);
    await f.locator('input[name="FlexLot_LotNum"]').fill(lotNo);
    await f.locator('input[name="FlexLot_ItemNumber"]').fill(item);
    await f.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f.getByRole('button', { name: 'Next' }).click();
    const d = f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
    // the Reason Code dialog (or the Lot Panel) can take longer than a few seconds
    for (let i = 0; i < 40 && !(await d.count()) && !(await f.locator('body').innerText()).includes('Lot Panel'); i++) await page.waitForTimeout(1000);
    if (await d.count()) {
      await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
      await d.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(6000);
    }
    f = frame();
    expect(await f.locator('body').innerText()).toContain('Lot Panel');
    await pdfRow().locator('select').filter({ hasText: /Select a label type|Carton Label/ }).selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
  };
  const setBatch = async (value: string) => {
    if (!(await f.getByRole('button', { name: 'Save' }).isVisible().catch(() => false))) {
      await f.locator('#overrideLotCheckBox').click();
      await page.waitForTimeout(1000);
    }
    const u2 = f.locator('input[type=text]:not([name]):not([id^=dp])').nth(3); // lot, order, U1, U2 (Batch Qty)
    await u2.fill(value);
    await u2.press('Tab');
    await f.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(4000);
  };
  const expectCopies = async (label: string, expected: number, requirement: string) => {
    const actual = await copies();
    console.log(`MDP ${label} -> Copies ${actual}`);
    if (actual !== String(expected)) deviation(requirement, `${label} = ${expected}`, actual);
    expect.soft(actual, label).toBe(String(expected));
  };

  await test.step('item A: blank batch -> 2; Override + Save batch 10 -> 32; batch 1 -> 5; cleared -> 2', async () => {
    await openLot(order, lot, A);
    await expectCopies('blank batch (0 x 3 + 2)', 2, 'MDP.180418.F.14.1');
    await setBatch('10');
    await expectCopies('batch 10 (10 x 3 + 2)', 32, 'MDP.180418.F.4.12');
    await setBatch('1');
    await expectCopies('batch 1 (1 x 3 + 2)', 5, 'MDP.180418.F.4.12');
    await setBatch('');
    await expectCopies('batch cleared (0 x 3 + 2)', 2, 'MDP.180418.F.4.12');
    await setBatch('1');
    await expectCopies('batch 1 again', 5, 'MDP.180418.F.4.12');
  });

  await test.step('an item without multiplier / extra values: Copies = 1 (F.14.2)', async () => {
    await openLot(`${order}X`, lot2, 'MI080301');
    await expectCopies('item MI080301 without values', 1, 'MDP.180418.F.14.2');
  });

  await test.step('item A again on the first lot: lower Copies to 1 and print ONE copy to PDF', async () => {
    await openLot(order, lot, A);
    await expectCopies('reopened lot, no override (batch kept 1)', 5, 'MDP.180418.F.14.1');
    await f.locator('input[name=txtCopies]').last().fill('1');
    await f.locator('input[name=txtCopies]').last().press('Tab');
    const responses: string[] = [];
    const onResponse = async (r: import('@playwright/test').Response) => {
      if (r.url().includes('/MultiDocPrinting/GetPrinterStatus')) responses.push(await r.text().catch(() => ''));
    };
    page.on('response', onResponse);
    await f.getByRole('button', { name: /^Print$/ }).click();
    await page.waitForTimeout(1500);
    await bartender.confirmSentinelLaunchPrompt(page, pid);
    for (let i = 0; i < 30 && !responses.some((x) => /"PrintStatus":"(success|error)"/.test(x)); i++) await page.waitForTimeout(1000);
    page.off('response', onResponse);
    const status = responses.find((x) => /"PrintStatus":"(success|error)"/.test(x)) ?? '';
    console.log(`print status: ${status.slice(0, 200)}`);
    expect(status).toContain('"PrintStatus":"success"');
  });

  await test.step('the same lot again (second print, ReprintBasedOnBatchQty = N): the row is a reprint (R next to the checkbox, F.7.1)', async () => {
    await openLot(order, lot, A);
    const row = pdfRow();
    const rowText = (await row.innerText()).replace(/\s+/g, ' ');
    const checkbox = row.locator('input[type=checkbox]').first();
    console.log(`reprint row: ${rowText} | checked=${await checkbox.isChecked()} disabled=${await checkbox.isDisabled()} html=${(await row.locator('td').first().innerHTML()).slice(0, 300)}`);
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`reprint screen: ${body.slice(0, 500)}`);
    const hasR = /(^|\s)R(\s|$)/.test(rowText) || (await row.locator('td').first().innerText()).includes('R');
    if (!hasR) deviation('MDP.180418.F.7.1', 'an R next to the checkbox of a reprint row', `no R in the row (${rowText.slice(0, 120)})`);
    await expectCopies('copies on the reprint row', 5, 'MDP.180418.F.14.1');
  });

  await test.step('cleanup: delete the unprinted item MI080301 lot', async () => {
    try {
      const g = await du.reopenDynamicUi(page, 'Lot Management');
      await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot2, { expectRows: false });
      await page.waitForTimeout(4000);
      if ((await du.rows(g)).length === 1) {
        await du.selectGridRow(g, lot2);
        await g.click('#del_grdJqGrid');
        await page.waitForTimeout(1200);
        await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
        await page.waitForTimeout(2500);
      }
    } catch (e) {
      console.log(`lot cleanup skipped: ${String(e).slice(0, 120)}`);
    }
  });
});
