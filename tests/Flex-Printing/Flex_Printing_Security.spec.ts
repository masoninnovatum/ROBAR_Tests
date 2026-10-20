// Flex Printing security (live 2026-10-12, HEADED, TST703; nothing is printed). MB fixtures only: group MBPWLoginGrp / user MBPWLogin01 (the group is left without processes). The seed user Claude01 sets the group's processes.
// Requirements: FLX.190301.F.1.1 (no BP_Add_Lot_PrintTime -> "user not authorized to add lot records"), F.2.2 (with it the lot can be added at print time); tile process BP_FlexPrinting_Option; Override_Lot_At_Print for changed lot data.
// Test data: lot CLFLX<stamp>S (item MBBQA8457561) added at print time in the last state; deleted again in Lot Management (MB-prefixed rows only).

import { test, expect } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { readGlobalSetting } from '../support/global-settings';
import { setUserPrintEntities } from '../support/print-entity';
import { FlexPrint, ensureFlexBase } from '../support/flex-print';

test.use({ headless: false, actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu', 'Print_Label', 'BP_FlexPrinting_Option', 'LT_Carton Label']; // LT_<label type> authorizes the label type on the print screens
const ITEM = 'MBBQA8457561';

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

async function deleteMbLots(page: Page, prefix: string): Promise<void> {
  if (!/^CLFLX\d+/.test(prefix)) throw new Error(`refusing to delete lots with prefix ${prefix}`);
  for (let i = 0; i < 4; i++) {
    await page.locator('li.ui-tabs-tab:has-text("Lot Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    const g = await du.reopenDynamicUi(page, 'Lot Management');
    await du.retrieve(page, g, 'LotNum', 'Contains', prefix, { expectRows: false });
    await page.waitForTimeout(3000);
    const mine = (await du.rows(g)).filter((r) => r.split(/\s+/).some((t) => t.startsWith(prefix)));
    if (!mine.length) break;
    await du.selectGridRow(g, mine[0].split(/\s+/).find((t) => t.startsWith(prefix))!);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
  }
}

test('Flex Printing: tile, add-lot-at-print-time authorization (BP_FlexPrinting_Option, BP_Add_Lot_PrintTime) for an MB user', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  const prefix = `CLFLX${Date.now().toString().slice(-6)}`;
  await login(page);
  await ensureFlexBase(page);
  const entityRequired = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${entityRequired}`);
  if (entityRequired === 'Y') await setUserPrintEntities(page, MB, ['ROBAR']);

  /** Opens Flex Printing as the MB user with the given processes and tries an unknown lot (and, when asked, completes the add). */
  const inspect = async (processes: string[], completeAdd = false) => {
    await sec.setGroupProcesses(page, GROUP, processes);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const tile = await p.getByRole('button', { name: 'Flex Printing', exact: true }).isVisible().catch(() => false);
      if (!tile) return { tile, message: '', lotAdded: false };
      const fp = new FlexPrint(p);
      await fp.open();
      const dd = fp.f.locator('select[id$="ddlPrintEntity"]');
      if (await dd.count()) await dd.selectOption({ label: 'ROBAR' }).catch(() => {});
      await fp.field('Item').fill(ITEM);
      await fp.field('Lot').fill(`${prefix}S`);
      await fp.next();
      const message = await fp.body();
      let lotAdded = false;
      if (completeAdd && (await fp.field('Order').count())) {
        await fp.field('Order').fill(`${prefix}O`);
        await fp.next();
        lotAdded = (await fp.f.locator('input[id$="deLot_txtLotNumber"]').inputValue().catch(() => '')) === `${prefix}S`;
      }
      return { tile, message: message.slice(0, 260), lotAdded };
    } finally {
      await ctx.close();
    }
  };

  try {
    const none = await inspect(['Login_WebMenu', 'Print_Label']);
    console.log(`STATE without BP_FlexPrinting_Option ${JSON.stringify(none)}`);
    expect.soft(none.tile, 'Flex Printing tile hidden without BP_FlexPrinting_Option').toBe(false);

    const noAdd = await inspect(BASE);
    console.log(`STATE base ${JSON.stringify(noAdd)}`);
    expect.soft(noAdd.tile).toBe(true);
    if (!/user not authorized to add lot records/i.test(noAdd.message)) deviation('FLX.190301.F.1.1', '"user not authorized to add lot records" for an unknown lot without BP_Add_Lot_PrintTime', noAdd.message);

    const withAdd = await inspect([...BASE, 'BP_Add_Lot_PrintTime'], true);
    console.log(`STATE +BP_Add_Lot_PrintTime ${JSON.stringify(withAdd)}`);
    if (!withAdd.lotAdded) deviation('FLX.190301.F.2.2', 'with BP_Add_Lot_PrintTime the unknown lot is added at print time', withAdd.message);
  } finally {
    await sec.setGroupProcesses(page, GROUP, []).catch((e) => console.log(`reset group failed: ${String(e).slice(0, 100)}`));
    await deleteMbLots(page, prefix);
  }
});
