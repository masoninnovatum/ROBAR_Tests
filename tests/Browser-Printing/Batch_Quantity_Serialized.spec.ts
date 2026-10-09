// Serialized templates and Batch Quantity x Multiplier + Extra (live 2026-10-09, HEADED, PRINTS NOTHING; seed user Claude01, TST703).
// ValMaster LCP.170105.F.10.1: a template with S_Ser or S_USerial sets Copy to 1 and ignores batch qty / multipliers / extra in ALL printing modules.
// ValMaster MDP.180418.F.9.11 (conflicting): serial copies in Multi Document Printing take Batch Quantity, Multiplier and Extra into account.
// Items (Qty2 3, u5 2, no label master): MBBQU... on template Userial_na (S_USerial) and MBBQR... on SingleSer_na (S_Ser) -- test-data/batchqty-item-userial.json / -ser.json.
// Print by Order: Override Batch Qty 10 and read the Copy field (plain item A would give 32). Multi Document Printing: Override + Save batch 10 and read Copies. The unprinted lots are deleted at the end.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
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

test('serialized templates (S_USerial / S_Ser): Copy on Print by Order and Copies in Multi Document Printing with a batch quantity (no print)', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const items = { S_USerial: item('test-data/batchqty-item-userial.json'), S_Ser: item('test-data/batchqty-item-ser.json') };
  const stamp = Date.now().toString().slice(-6);
  const lots: string[] = [];
  let n = 0;

  const copyByOrder = async (itemNumber: string, batch: string | null): Promise<string> => {
    n += 1;
    const order = `MBBQZO${stamp}${n}`;
    const lot = `MBBQZL${stamp}${n}`;
    lots.push(lot);
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
    console.log(`Print by order item ${itemNumber} batch ${batch ?? '(blank)'} -> Copy ${copy}; body: ${(await pb.body()).slice(0, 0)}`);
    return copy;
  };

  const copiesInMdp = async (itemNumber: string, batch: string): Promise<string> => {
    n += 1;
    const lot = `MBBQZL${stamp}${n}`;
    lots.push(lot);
    await page.locator('li.ui-tabs-tab:has-text("Multi Document Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click();
    await page.waitForTimeout(4000);
    const pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, pid).catch(() => {});
    const frame = (): Frame => page.frames().filter((x) => x.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop()!;
    let f = frame();
    for (let i = 0; i < 20 && !(f && (await f.locator('input[name="FlexLot_OrderNum"]').count())); i++) {
      await page.waitForTimeout(1000);
      f = frame();
    }
    await f.locator('select').first().selectOption({ label: 'ROBAR' }).catch(() => {});
    await f.locator('input[name="FlexLot_OrderNum"]').fill(`MBBQZO${stamp}${n}`);
    await f.locator('input[name="FlexLot_LotNum"]').fill(lot);
    await f.locator('input[name="FlexLot_ItemNumber"]').fill(itemNumber);
    await f.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await f.getByRole('button', { name: 'Next' }).click();
    const d = f.locator('.ui-dialog:visible', { hasText: 'Reason Code' });
    for (let i = 0; i < 40 && !(await d.count()) && !(await f.locator('body').innerText()).includes('Lot Panel'); i++) await page.waitForTimeout(1000);
    if (await d.count()) {
      await d.locator('#reasonSel').selectOption({ label: 'On Demand' });
      await d.getByRole('button', { name: 'Submit' }).click();
      await page.waitForTimeout(6000);
    }
    f = frame();
    const pdfRow = f.locator('tr').filter({ has: f.locator('select') }).filter({ hasText: 'Microsoft Print to PDF' }).last();
    await pdfRow.locator('select').filter({ hasText: /Select a label type|Carton Label/ }).selectOption({ label: 'Carton Label' });
    await page.waitForTimeout(4000);
    const blank = await f.locator('input[name=txtCopies]').last().inputValue();
    await f.locator('#overrideLotCheckBox').click();
    await page.waitForTimeout(1000);
    const u2 = f.locator('input[type=text]:not([name]):not([id^=dp])').nth(3);
    await u2.fill(batch);
    await u2.press('Tab');
    await f.getByRole('button', { name: 'Save' }).click();
    await page.waitForTimeout(4000);
    const copies = await f.locator('input[name=txtCopies]').last().inputValue();
    console.log(`MDP item ${itemNumber}: blank batch -> Copies ${blank}; batch ${batch} -> Copies ${copies}`);
    return copies;
  };

  try {
    for (const [kind, itemNumber] of Object.entries(items)) {
      await test.step(`${kind} item ${itemNumber}: Print by Order, batch blank and batch 10`, async () => {
        const blank = await copyByOrder(itemNumber, null);
        const ten = await copyByOrder(itemNumber, '10');
        if (ten !== '1') deviation('LCP.170105.F.10.1', `${kind} template: Copy = 1 whatever the batch qty / multiplier / extra`, `blank batch Copy ${blank}, batch 10 Copy ${ten}`);
        expect.soft(ten, `${kind} Print by Order batch 10`).toBe('1');
      });
      await test.step(`${kind} item ${itemNumber}: Multi Document Printing, Override + Save batch 10`, async () => {
        const copies = await copiesInMdp(itemNumber, '10');
        if (copies !== '1') deviation('LCP.170105.F.10.1 vs MDP.180418.F.9.11', `${kind} template: Copy = 1 in ALL printing modules (F.10.1); MDP F.9.11 says serial copies include batch x multiplier + extra (32)`, `Copies ${copies}`);
        expect.soft(['1', '32']).toContain(copies);
      });
    }
  } finally {
    await test.step('cleanup: delete the unprinted lots in Lot Management', async () => {
      for (const lot of lots) {
        try {
          const g = await du.reopenDynamicUi(page, 'Lot Management');
          await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
          await page.waitForTimeout(4000);
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
