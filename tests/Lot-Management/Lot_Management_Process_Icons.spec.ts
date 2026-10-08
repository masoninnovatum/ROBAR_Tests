// Lot Management: what each security process switches on in the UI (headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only).
//   LE_View_Lots only   : grid + View window; Add / Edit / Delete icons disabled; Excel Import hidden
//   + LE_Add_Lots       : Add icon enabled
//   + LE_Chg_Lots       : Edit icon enabled AND double-clicking a row opens "Edit Record" (otherwise "View Record")
//   + LE_Del_Lots       : Delete icon enabled
//   + EI_Lots           : "Excel Import" menu item visible
// The MB user needs a Print Entity (ROBAR) to see any lot. One throw-away lot MBLICO<stamp> is added by the test user and deleted again; the group ends without processes and the user
// without entities.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { setUserPrintEntities } from '../support/print-entity';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu', 'LE_View_Lots'];

test('Lot Management: each process (Add / Change / Delete / Excel Import) switches on its own icon or menu item', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  sec.assertMb(GROUP);
  const stamp = Date.now().toString().slice(-6);
  const lot = `MBLICO${stamp}`;
  let g: Frame;

  const openLots = async (p: Page): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    return du.reopenDynamicUi(p, 'Lot Management');
  };
  const view = async () => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      const f = await openLots(p);
      await du.retrieve(p, f, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
      await f.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      // Edit / View / Delete only enable once ONE row is selected (0 selected = all three disabled), so select the row before reading the icons
      await du.selectGridRow(f, lot);
      const nav: Record<string, boolean> = {};
      for (const icon of ['add', 'edit', 'view', 'del'] as const) nav[icon] = await du.navEnabled(f, icon);
      await f.locator('tr.jqgrow').filter({ hasText: lot }).dblclick();
      await p.waitForTimeout(2500);
      const dialogTitle = (await f.locator('.ui-jqdialog:visible').first().innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 40);
      await f.locator('.ui-jqdialog:visible #cData, .ui-jqdialog:visible .ui-jqdialog-titlebar-close').first().click({ timeout: 5000 }).catch(() => {});
      await p.waitForTimeout(800);
      await f.locator('a:has-text("Actions")').first().click();
      await p.waitForTimeout(500);
      const importVisible = await f.locator('ul li a').filter({ hasText: 'Excel Import' }).first().isVisible();
      const exportVisible = await f.locator('ul li a').filter({ hasText: 'Excel Export' }).first().isVisible();
      return { nav, dialogTitle, importVisible, exportVisible };
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('setup: LE_View_Lots only; the MB user gets the ROBAR entity; the test user adds the throw-away lot', async () => {
      await login(page);
      await sec.setGroupProcesses(page, GROUP, BASE);
      await setUserPrintEntities(page, MB, ['ROBAR']);
      g = await openLots(page);
      await du.retrieve(page, g, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
      await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      const dlg = await du.openFormDialog(g, 'add');
      await dlg.locator('[name="OrderNum"]').fill(`${lot}O`);
      await dlg.locator('[name="LotNum"]').fill(lot);
      await dlg.locator('[name="ItemNumber"]').fill('MI080301');
      await du.submitForm(g);
      await page.waitForTimeout(1500);
    });

    const steps: Array<{ name: string; processes: string[]; check: (v: Awaited<ReturnType<typeof view>>) => void }> = [
      { name: 'LE_View_Lots only', processes: BASE, check: (v) => { expect(v.nav).toMatchObject({ add: false, edit: false, del: false }); expect(v.dialogTitle).toContain('View Record'); expect(v.importVisible).toBe(false); expect(v.exportVisible).toBe(true); } },
      { name: '+ LE_Add_Lots', processes: [...BASE, 'LE_Add_Lots'], check: (v) => { expect(v.nav).toMatchObject({ add: true, edit: false, del: false }); expect(v.dialogTitle).toContain('View Record'); } },
      { name: '+ LE_Chg_Lots', processes: [...BASE, 'LE_Chg_Lots'], check: (v) => { expect(v.nav).toMatchObject({ add: false, edit: true, del: false }); expect(v.dialogTitle, 'double-click now opens the Edit window').toContain('Edit Record'); } },
      { name: '+ LE_Del_Lots', processes: [...BASE, 'LE_Del_Lots'], check: (v) => { expect(v.nav).toMatchObject({ add: false, edit: false, del: true }); expect(v.dialogTitle).toContain('View Record'); } },
      { name: '+ EI_Lots', processes: [...BASE, 'EI_Lots'], check: (v) => { expect(v.importVisible, 'Excel Import visible').toBe(true); expect(v.nav).toMatchObject({ add: false, edit: false, del: false }); } },
    ];
    for (const s of steps) {
      await test.step(s.name, async () => {
        await sec.setGroupProcesses(page, GROUP, s.processes);
        const v = await view();
        console.log(`${s.name}: ${JSON.stringify(v)}`);
        s.check(v);
      });
    }
  } finally {
    await test.step('cleanup: delete the lot, remove the entity from the MB user, leave the group without processes', async () => {
      try {
        g = await openLots(page);
        await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
        await page.waitForTimeout(4000);
        if ((await du.rows(g)).length === 1) {
          await du.selectGridRow(g, lot);
          await g.click('#del_grdJqGrid');
          await page.waitForTimeout(1200);
          await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
          await page.waitForTimeout(3000);
        }
      } catch (e) {
        console.log(`lot cleanup skipped: ${String(e).slice(0, 140)}`);
      }
      await setUserPrintEntities(page, MB, []).catch((e) => console.log(`entity cleanup skipped: ${String(e).slice(0, 120)}`));
      await sec.setGroupProcesses(page, GROUP, []);
    });
  }
});
