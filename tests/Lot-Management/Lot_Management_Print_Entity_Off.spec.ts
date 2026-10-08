// Lot Management with PrintEntityRequired = N (the TST703 value, read-only check of Global Settings; LastTouch 09/29/2026). With the setting OFF the Print Entity is NOT enforced:
// `SP_LotsPrintEntities` returns only `ROBAR` for every user (also for a user holding `*` or several entities), so the Add dialog's Print Entity dropdown has the single option ROBAR, lots are
// listed to every user whatever his Print Entities are (even none), and Excel Import accepts only ROBAR in the PrintEntity column ("ROBAR is a required value for this column").
// MB fixtures only (MBPWLoginGrp / MBPWLogin01); one throw-away lot MBLPO<stamp>; the MB user ends without entities, the group without processes. Skipped automatically when the setting is Y.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { readGlobalSetting } from '../support/global-settings';
import { setUserPrintEntities } from '../support/print-entity';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const PROCESSES = ['Login_WebMenu', 'LE_View_Lots', 'LE_Add_Lots', 'LE_Chg_Lots'];

test('Lot Management with PrintEntityRequired = N: ROBAR only, lots visible to every user, import accepts only ROBAR (invalid value message)', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${setting}`);
  test.skip(setting !== 'N', `PrintEntityRequired is ${setting}; this spec covers the N behavior (see Lot_Management_Print_Entity.spec.ts for Y)`);
  const stamp = Date.now().toString().slice(-6);
  const lot = `MBLPO${stamp}`;
  let g: Frame;

  const openLots = async (p: Page): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    return du.reopenDynamicUi(p, 'Lot Management');
  };
  const addDialogEntity = async (f: Frame) => {
    const dlg = await du.openFormDialog(f, 'add');
    const field = await dlg.locator('[name="PrintEntity"]').evaluate((e) => ({ tag: e.tagName, value: (e as HTMLInputElement).value, disabled: (e as HTMLInputElement).disabled, options: e.tagName === 'SELECT' ? Array.from((e as HTMLSelectElement).options).map((o) => o.text.trim()) : [] }));
    await du.cancelForm(f);
    return field;
  };
  const mbView = async () => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      const f = await openLots(p);
      await du.retrieve(p, f, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
      await p.waitForTimeout(6000);
      const rows = await du.rows(f);
      const add = (await f.locator('#add_grdJqGrid').count()) > 0 && (await du.navEnabled(f, 'add'));
      return { rows, add, entityField: add ? await addDialogEntity(f) : null };
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('setup: the MB group can view / add lots; the test user adds a ROBAR lot; its Add dialog offers only ROBAR', async () => {
      await sec.setGroupProcesses(page, GROUP, PROCESSES);
      g = await openLots(page);
      await du.retrieve(page, g, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
      await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      const field = await addDialogEntity(g);
      console.log(`test user (entity *) Add dialog: ${JSON.stringify(field)}`);
      expect(field.options, 'even a user holding * is offered only ROBAR while the setting is N').toEqual(['ROBAR']);
      const dlg = await du.openFormDialog(g, 'add');
      await dlg.locator('[name="OrderNum"]').fill(`${lot}O`);
      await dlg.locator('[name="LotNum"]').fill(lot);
      await dlg.locator('[name="ItemNumber"]').fill('MI080301');
      await du.submitForm(g);
      await page.waitForTimeout(1500);
    });

    for (const entities of [[], ['England'], ['ROBAR', 'England'], ['*']] as string[][]) {
      await test.step(`MB user with entities ${JSON.stringify(entities)}: the lot is listed, Add is enabled, the Print Entity dropdown is ROBAR only`, async () => {
        await setUserPrintEntities(page, MB, entities);
        const v = await mbView();
        console.log(`${JSON.stringify(entities)}: ${JSON.stringify(v)}`);
        expect(v.rows, 'lots are not scoped by Print Entity while the setting is N').toHaveLength(1);
        expect(v.add).toBe(true);
        expect(v.entityField?.options).toEqual(['ROBAR']);
      });
    }

    await test.step('Excel Import: a PrintEntity other than ROBAR is refused ("ROBAR is a required value for this column")', async () => {
      g = await openLots(page);
      await du.retrieve(page, g, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
      await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      await g.locator('a:has-text("Actions")').first().click();
      await page.waitForTimeout(500);
      await g.locator('ul:visible li a').filter({ hasText: 'Excel Import' }).click({ force: true });
      await page.waitForTimeout(5000);
      const imp = page.frames().filter((x) => /ExcelImport/i.test(x.url())).pop()!;
      const today = new Date();
      const file = path.join(os.tmpdir(), `lots_entity_${stamp}.xlsx`);
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet('Sheet1');
      ws.addRow(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5']);
      ws.addRow([`${lot}XO`, `${lot}X`, 'MI080301', 'England', today, today, today, '', '', '', '', ''] as never);
      await wb.xlsx.writeFile(file);
      await imp.locator('input[type=file]').setInputFiles(file);
      await imp.locator('#btnValidate').click();
      await page.waitForTimeout(6000);
      const text = (await imp.locator('body').innerText()).replace(/\s+/g, ' ');
      console.log(`import with England: ${text.slice(-220)}`);
      // OBSERVED wording (the formal script PE_LotManagment_Import expects "ROBAR is a required value for this column"); note the product's typo "specifed"
      expect(text).toContain('Row 2 has an invalid value specifed for the PrintEntity column');
      expect(await imp.locator('#btnSubmit').isVisible()).toBe(false);
    });
  } finally {
    await test.step('cleanup: delete the lot, remove the entities from the MB user, leave the group without processes', async () => {
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
