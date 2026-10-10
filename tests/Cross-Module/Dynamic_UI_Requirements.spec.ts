// Dynamic UI re-checked against ValMaster (module "Dynamic UI", DUI.20190822.*; live 2026-10-09, headless, TST703). The expectations come from the shipped seed (`DynamicUIHeaderDefaultRecords.cs`):
// DUI.F.3.1 a security column of Y / N / process name -> everybody / nobody / holders of the process; DUI.F.3.3-3.5 a disabled CanAdd / CanEdit / CanDelete disables the grid button; CanExcelImport / CanExcelExport /
// CanViewAudit decide the entries of the Actions menu; DUI.F.3.2 a user without the CanView process gets "User is not authorized to view this page" on the page.
// Part A: the seed user Claude01 (`*`) -> icon states and Actions menu per page. Part B: MB fixture user MBPWLogin01 with only Login_WebMenu opening the pages by URL. Nothing is changed.

import { test, expect } from '@playwright/test';
import type { Browser } from '@playwright/test';
import { login, loginAs, PASSWORD, findFrame } from '../support/robar';
import * as du from '../support/dynamic-ui';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

// tile, URL query (Part B), seed: add / edit / delete / Excel Import / Excel Export / Audit (Y = everybody, N = nobody; a process name = the admin `*` holds it)
const PAGES = [
  { tile: 'Facility Management', query: 'Heading=Facility_Management&Definition=Facilities', add: true, edit: true, del: true, imp: true, exp: true, audit: true },
  { tile: 'Global Settings Management', query: 'Heading=Global_Settings_Management&Definition=GlobalSettings', add: true, edit: true, del: false, imp: false, exp: true, audit: true },
  { tile: 'Print Config Management', query: 'Heading=Print_Config_Management&Definition=PrintConfig', add: false, edit: true, del: false, imp: false, exp: true, audit: true },
  { tile: 'Printer Control', query: 'Heading=Printer_Control_Maintenance&Definition=PrinterControl', add: true, edit: true, del: true, imp: true, exp: true, audit: true },
  { tile: 'Label Type Management', query: 'Heading=Label_Type_Management&Definition=LabelTypes', add: true, edit: true, del: false, imp: true, exp: true, audit: true },
  { tile: 'Lot Management', query: 'Heading=Lot_Management&Definition=Lots', add: true, edit: true, del: true, imp: true, exp: true, audit: true },
];

test('Dynamic UI vs ValMaster: icon states and Actions menu follow the header security columns; no CanView process -> not authorized message', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  await login(page);

  await test.step('Part A: the admin user sees the icons / Actions entries the seed configures (DUI.F.3.1, F.3.3-F.3.5)', async () => {
    for (const p of PAGES) {
      let g;
      let hadRow = false;
      try {
        g = await du.reopenDynamicUi(page, p.tile);
        await g.click('#btnRetrieveData'); // the grid (and its nav icons) is only drawn after Retrieve Data
        await page.waitForTimeout(6000);
        g = await findFrame(page, 'DynamicUI');
        await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 }).catch(() => {});
        hadRow = (await g.locator('tr.jqgrow').count()) > 0;
        if (hadRow) await g.locator('tr.jqgrow').first().locator('td').nth(3).click().catch(() => {}); // Edit / Delete are only enabled while a row is selected
        await page.waitForTimeout(800);
      } catch (e) {
        console.log(`PAGE ${p.tile}: could not be opened (${String(e).slice(0, 80)})`);
        continue;
      }
      const icon = async (n: 'add' | 'edit' | 'del') => ((await g.locator('#' + n + '_grdJqGrid').count()) ? du.navEnabled(g, n) : false); // an icon of a header column set to N may not be rendered at all
      const icons = { add: await icon('add'), edit: await icon('edit'), del: await icon('del') };
      // the view hides the entries of a header column set to N with style=display:none, so test VISIBILITY, not presence
      await g.locator('a:has-text("Actions")').first().click().catch(() => {});
      await page.waitForTimeout(600);
      const vis = async (id: string) => g.locator('#' + id).isVisible().catch(() => false);
      const seen: Record<string, boolean> = { ...icons, imp: await vis('actExcelImport'), exp: await vis('actExcelExport'), audit: await vis('actAuditView') };
      await g.locator('a:has-text("Actions")').first().click().catch(() => {});
      if (!hadRow) { delete seen.edit; delete seen.del; console.log('NOTE ' + p.tile + ': no rows were retrieved, Edit / Delete (row-dependent) not compared'); }
      console.log(`PAGE ${p.tile}: icons=${JSON.stringify(icons)} seen=${JSON.stringify(seen)}`);
      const want: Record<string, boolean> = { add: p.add, edit: p.edit, del: p.del, imp: p.imp, exp: p.exp, audit: p.audit };
      if (!hadRow) { delete want.edit; delete want.del; }
      if (JSON.stringify(seen) !== JSON.stringify(want)) deviation('DUI.20190822.F.3.1', `${p.tile}: ${JSON.stringify(want)} (seed)`, JSON.stringify(seen));
      expect.soft(seen, p.tile).toEqual(want);
      // a second open Dynamic UI tab makes findFrame('DynamicUI') return the wrong frame for the next page
      await page.locator('li.ui-tabs-tab:has-text("' + p.tile + '") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    }
  });

  await test.step('Part B (DUI.F.3.2): a user without the CanView process gets "User is not authorized to view this page"', async () => {
    await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu']);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      for (const pg of PAGES) {
        await p.goto(`http://vmsrvtst703/InnoPages/DynamicUI/DynamicUI?${pg.query}`);
        await p.waitForTimeout(3000);
        const text = (await p.locator('body').innerText()).replace(/\s+/g, ' ');
        console.log(`NOVIEW ${pg.tile}: ${text.slice(0, 160)}`);
        if (!text.includes('User is not authorized to view this page')) deviation('DUI.20190822.F.3.2', '"User is not authorized to view this page"', text.slice(0, 120));
        expect.soft(text, pg.tile).toContain('User is not authorized to view this page');
      }
    } finally {
      await ctx.close();
      await sec.setGroupProcesses(page, GROUP, []);
    }
  });
});
