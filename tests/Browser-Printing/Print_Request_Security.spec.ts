// Print by Lot security processes on the label screen (live 2026-10-09, HEADED, PRINTS NOTHING; MB fixtures MBPWLoginGrp / MBPWLogin01 only; the seed user Claude01 sets the group's processes and the MB user's Print Entity).
// ValMaster (module "WEB - Print Request"): FRS-8.1.7.5 a security setting allows / disallows changes to the calculated quantities (process BP_Change_Print_Quantity -> Copies / Batch Qty boxes enabled);
// WP20130208001F103.2.4 security settings determine whether a user can perform test prints (BP_Test_Print); FRS-8.1.13.1 digital signatures for reprints (BP_Reprint_Label / BP_Reprint_CanSign).
// The MB user opens Print by Lot on an EXISTING printed lot (MBBQN..., item A) -> straight to the label screen -> state is read, nothing is printed. The group is left without processes at the end.
// Prerequisite: PrintEntityRequired may be Y or N (an entity is assigned when the dropdown exists).

import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import * as printing from '../support/printing';
import * as bartender from '../support/bartender';
import { readGlobalSetting } from '../support/global-settings';
import { setUserPrintEntities } from '../support/print-entity';
import { PrintByLot } from '../support/print-by-lot';

test.use({ headless: false, actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu', 'Print_Label', 'BP_PrintByLot_Option', 'LT_Carton Label']; // LT_<label type> authorizes the label type on the print screens (LabeltypeSelection)

interface Seen { tile: boolean; copies?: { visible: boolean; enabled: boolean }; test?: { visible: boolean; enabled: boolean }; reprint?: { checked: boolean; disabled: boolean }; reprintOptions?: boolean; printEnabled?: boolean; body: string }

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Print by Lot label screen follows BP_Change_Print_Quantity, BP_Test_Print and the reprint processes (no print)', async ({ page, browser }) => {
  test.setTimeout(2_400_000);
  sec.assertMb(GROUP);
  await login(page);
  const entityRequired = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${entityRequired}`);

  // an existing printed lot of item A (from the reprint-off spec)
  const g = await du.reopenDynamicUi(page, 'Lot Management');
  await du.retrieve(page, g, 'LotNum', 'Contains', 'MBBQN', { expectRows: false });
  await page.waitForTimeout(4000);
  const lots = (await du.rows(g)).map((r) => r.split(/\s+/)[2]).filter((l) => /^MBBQN\d+L$/.test(l ?? ''));
  console.log(`candidate lots: ${JSON.stringify(lots)}`);
  expect(lots.length, 'a printed MBBQN lot from Batch_Quantity_Reprint_Off').toBeGreaterThan(0);
  const lot = lots[0];

  if (entityRequired === 'Y') await setUserPrintEntities(page, MB, ['ROBAR']);

  const inspect = async (processes: string[]): Promise<Seen> => {
    await sec.setGroupProcesses(page, GROUP, processes);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const tile = await p.getByRole('button', { name: 'Print by lot', exact: true }).isVisible().catch(() => false);
      if (!tile) return { tile, body: '' };
      const pb = new PrintByLot(p);
      await pb.open();
      const dd = pb.f.locator('select[id$="ddlPrintEntity"]');
      if (await dd.count()) await dd.selectOption({ label: 'ROBAR' }).catch(() => {});
      await pb.f.locator(`#${printing.lotNumberId}`).fill(lot);
      await pb.next();
      if ((await pb.body()).includes('Reassay')) await pb.next(); // the Lot Panel comes first for this user
      await pb.f.getByRole('radio', { name: /Carton Label/ }).check({ timeout: 5000 }).catch(() => {});
      await bartender.confirmSentinelLaunchPrompt(p, pb.pid).catch(() => {});
      await p.waitForTimeout(6000);
      pb.f = await pb.frame();
      const body = await pb.body();
      const state = async (suffix: string) => {
        const l = pb.opt(suffix);
        return (await l.count()) ? { visible: await l.isVisible(), enabled: await l.isEnabled() } : { visible: false, enabled: false };
      };
      const seen: Seen = {
        tile,
        copies: await state('txtCopies'),
        test: await state('chbTestPrint'),
        reprint: (await pb.opt('chbReprint').count()) ? { checked: await pb.opt('chbReprint').isChecked(), disabled: await pb.opt('chbReprint').isDisabled() } : undefined,
        reprintOptions: body.includes('Reprint Options'),
        printEnabled: (await pb.opt('btnDoPrint').count()) ? await pb.opt('btnDoPrint').isEnabled() : undefined,
        body: body.slice(0, 200),
      };
      return seen;
    } finally {
      await ctx.close();
    }
  };

  try {
    const s0 = await test.step('base processes only (Print by Lot tile, Print_Label)', async () => inspect(BASE));
    console.log(`STATE base ${JSON.stringify(s0)}`);
    const s1 = await test.step('+ BP_Change_Print_Quantity', async () => inspect([...BASE, 'BP_Change_Print_Quantity']));
    console.log(`STATE +ChangeQty ${JSON.stringify(s1)}`);
    const s2 = await test.step('+ BP_Test_Print', async () => inspect([...BASE, 'BP_Test_Print']));
    console.log(`STATE +TestPrint ${JSON.stringify(s2)}`);
    const s3 = await test.step('+ BP_Reprint_Label + BP_Reprint_CanSign', async () => inspect([...BASE, 'BP_Reprint_Label', 'BP_Reprint_CanSign']));
    console.log(`STATE +Reprint ${JSON.stringify(s3)}`);

    // FRS-8.1.7.5
    if (s0.copies?.enabled) deviation('FRS-8.1.7.5', 'Copies box disabled without BP_Change_Print_Quantity', 'Copies enabled');
    if (s1.copies && !s1.copies.enabled) deviation('FRS-8.1.7.5', 'Copies box enabled with BP_Change_Print_Quantity', 'Copies disabled');
    expect.soft(s0.copies?.enabled, 'Copies without BP_Change_Print_Quantity').toBe(false);
    expect.soft(s1.copies?.enabled, 'Copies with BP_Change_Print_Quantity').toBe(true);
    // F103.2.4
    if (s0.test?.visible && s0.test.enabled) deviation('WP20130208001F103.2.4', 'no Test checkbox without BP_Test_Print', 'Test checkbox visible and enabled');
    if (!(s2.test?.visible && s2.test.enabled)) deviation('WP20130208001F103.2.4', 'Test checkbox with BP_Test_Print', JSON.stringify(s2.test));
  } finally {
    await sec.setGroupProcesses(page, GROUP, []).catch((e) => console.log(`reset group failed: ${String(e).slice(0, 100)}`));
  }
});
