// Lot Management and Print Entities (live 2026-10-06, headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only). Documented behaviour (PE_LotManagment): search results and the Add dialog's Print Entity
// are limited to the user's assigned entities; ONE entity -> the Add/Edit Print Entity field is pre-set and disabled; NO entity -> "No records to view" and every icon disabled; `*` (All) sees everything.
// The test user (Claude01, entity `*`) adds lot LPR (entity ROBAR) and LPE (entity England); the MB user's entities are changed with `setUserPrintEntities` (User Print Entity Management) and the
// MB user looks at Lot Management in a second browser context. At the end: lots deleted, MB user without entities, group without processes.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { setUserPrintEntities } from '../support/print-entity';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const PROCESSES = ['Login_WebMenu', 'LE_View_Lots', 'LE_Add_Lots', 'LE_Chg_Lots'];

test('Lot Management: the rows and the Add dialog follow the user\'s Print Entities', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);
  // SP_LotsPrintEntities / SP_LotsForcedFilter only scope by Print Entity when PrintEntityRequired = Y; TST703 has N (see Lot_Management_Print_Entity_Off.spec.ts), so this spec is skipped there
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}; the scoping behavior below only exists when it is Y (UNVERIFIED branch: written from the formal script PE_LotManagment and the stored procedures)`);
  const stamp = Date.now().toString().slice(-6);
  const lpr = `MBLPR${stamp}`;
  const lpe = `MBLPE${stamp}`;
  let g: Frame;

  const openLots = async (p: Page): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    return du.reopenDynamicUi(p, 'Lot Management');
  };
  /** Adds a lot through the Add dialog of frame `f` (page `p`), choosing `entity` when the Print Entity field is a dropdown with that option. */
  const addLot = async (f: Frame, p: Page, lot: string, entity: string) => {
    const dlg = await du.openFormDialog(f, 'add');
    await dlg.locator('[name="OrderNum"]').fill(`${lot}O`);
    await dlg.locator('[name="LotNum"]').fill(lot);
    await dlg.locator('[name="ItemNumber"]').fill('MI080301');
    await dlg.locator('[name="PrintEntity"]').selectOption({ label: entity });
    await du.submitForm(f);
    await p.waitForTimeout(1500);
  };
  const adminAdd = (lot: string, entity: string) => addLot(g, page, lot, entity);
  /** The MB user adds a lot (needs LE_Add_Lots and the entity assigned) in a second context. */
  const mbAdd = async (lot: string, entity: string) => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      const f = await openLots(p);
      await du.retrieve(p, f, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
      await f.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      await addLot(f, p, lot, entity);
    } finally {
      await ctx.close();
    }
  };
  /** What the MB user sees: the rows for MBLP lots, the nav icon state, and the Add dialog's Print Entity field. */
  const mbView = async () => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      const f = await openLots(p);
      await du.retrieve(p, f, 'LotNum', 'Contains', `MBLP`, { expectRows: false });
      await p.waitForTimeout(6000);
      const rows = (await du.rows(f)).filter((r) => r.includes(stamp));
      const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
      const add = await f.locator('#add_grdJqGrid').count() ? await du.navEnabled(f, 'add').catch(() => false) : false;
      let entityField: { tag: string; value: string; disabled: boolean; options: string[] } | null = null;
      if (add) {
        const dlg = await du.openFormDialog(f, 'add');
        const pe = dlg.locator('[name="PrintEntity"]');
        entityField = await pe.evaluate((e) => ({ tag: e.tagName, value: (e as HTMLInputElement).value, disabled: (e as HTMLInputElement).disabled, options: e.tagName === 'SELECT' ? Array.from((e as HTMLSelectElement).options).map((o) => o.text.trim()) : [] }));
        await du.cancelForm(f);
      }
      return { rows, noRecords: /No records to view/i.test(body), add, entityField };
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('setup: the MB group can view / add / change lots; the test user adds a ROBAR lot and an England lot', async () => {
      await sec.setGroupProcesses(page, GROUP, PROCESSES);
      g = await openLots(page);
      await du.retrieve(page, g, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
      await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      // the test user (entity `*`) is only offered ROBAR in the Add dialog, so the England lot is added by the MB user once he holds ROBAR + England
      await adminAdd(lpr, 'ROBAR');
      await setUserPrintEntities(page, MB, ['ROBAR', 'England']);
      await mbAdd(lpe, 'England');
      g = await openLots(page);
      await du.retrieve(page, g, 'LotNum', 'Contains', 'MBLP', { expectRows: false });
      await page.waitForTimeout(5000);
      const mine = (await du.rows(g)).filter((r) => r.includes(stamp));
      console.log(`lots added by the test user: ${JSON.stringify(mine)}`);
      expect(mine.find((r) => r.includes(lpr))).toContain('ROBAR');
      expect(mine.find((r) => r.includes(lpe))).toContain('England');
    });

    await test.step('NO Print Entity: "No records to view" and no Add icon', async () => {
      await setUserPrintEntities(page, MB, []);
      const v = await mbView();
      console.log(`no entity: ${JSON.stringify(v)}`);
      expect(v.rows).toEqual([]);
      expect(v.add, 'Add icon disabled without any Print Entity').toBe(false);
    });

    await test.step('ONE entity (England): only the England lot is listed; the Add dialog\'s Print Entity is England and read-only', async () => {
      await setUserPrintEntities(page, MB, ['England']);
      const v = await mbView();
      console.log(`England only: ${JSON.stringify(v)}`);
      expect(v.rows).toHaveLength(1);
      expect(v.rows[0]).toContain(lpe);
      expect(v.rows[0]).toContain('England');
      expect(v.add).toBe(true);
      expect(v.entityField?.value).toBe('England');
      expect(v.entityField?.disabled, 'a single entity cannot be changed').toBe(true);
    });

    await test.step('TWO entities (ROBAR + England): both lots are listed and the Add dialog offers both entities', async () => {
      await setUserPrintEntities(page, MB, ['ROBAR', 'England']);
      const v = await mbView();
      console.log(`ROBAR + England: ${JSON.stringify(v)}`);
      expect(v.rows).toHaveLength(2);
      expect(v.entityField?.disabled).toBe(false);
      expect(v.entityField?.options.length ? v.entityField.options : [v.entityField?.value]).toEqual(expect.arrayContaining(['ROBAR', 'England']));
      expect(v.entityField?.options ?? []).not.toContain('Vendors');
    });

    await test.step('ALL (*): both lots are listed', async () => {
      await setUserPrintEntities(page, MB, ['*']);
      const v = await mbView();
      console.log(`all: ${JSON.stringify(v)}`);
      expect(v.rows).toHaveLength(2);
    });
  } finally {
    await test.step('cleanup: delete the lots, remove the entities from the MB user, leave the group without processes', async () => {
      try {
        for (const lot of [lpr, lpe]) {
          g = await openLots(page);
          await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
          await page.waitForTimeout(4000);
          if ((await du.rows(g)).length !== 1) continue;
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
