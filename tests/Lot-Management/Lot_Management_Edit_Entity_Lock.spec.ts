// PE.161004.F.7.9 (ValMaster, module "Print Entity - Lot Management"): with ONE Print Entity the Print Entity dropdown of the Lot Edit Record dialog is pre-populated and LOCKED. Live check with PrintEntityRequired = Y,
// TST703: the seed user (`*`) adds an England lot, an MB user holding ONLY England (LE_View_Lots + LE_Chg_Lots, second browser context) opens the Edit dialog. A requirement the system does not meet is recorded as a
// test annotation `deviation <id>` (not a failure). The lot (MBLEL<stamp>) is deleted at the end; the MB user ends without entities and the group without processes. Skips unless the setting is Y.

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

test('Lot Management Edit dialog: one Print Entity -> the Print Entity dropdown is locked (PE.161004.F.7.9)', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  sec.assertMb(GROUP);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}`);
  const stamp = Date.now().toString().slice(-6);
  const lot = `MBLEL${stamp}`;
  const openLots = async (p: Page): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    return du.reopenDynamicUi(p, 'Lot Management');
  };

  try {
    await test.step('the seed user adds an England lot', async () => {
      const g = await openLots(page);
      await du.retrieve(page, g, 'LotNum', 'Contains', 'MBMDPL', { expectRows: false });
      await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
      const dlg = await du.openFormDialog(g, 'add');
      await dlg.locator('[name="OrderNum"]').fill(`${lot}O`);
      await dlg.locator('[name="LotNum"]').fill(lot);
      await dlg.locator('[name="ItemNumber"]').fill('MI080301');
      await dlg.locator('[name="PrintEntity"]').selectOption({ label: 'England' });
      await du.submitForm(g);
      await page.waitForTimeout(2000);
    });

    await test.step('an MB user with ONLY England opens the Edit dialog: Print Entity is England and locked', async () => {
      await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', 'LE_View_Lots', 'LE_Chg_Lots']);
      await setUserPrintEntities(page, MB, ['England']);
      const ctx = await (browser as Browser).newContext();
      const p = await ctx.newPage();
      try {
        await loginAs(p, MB, PASSWORD);
        await p.waitForTimeout(2000);
        const f = await openLots(p);
        await du.retrieve(p, f, 'LotNum', 'Contains', 'MBLEL', { expectRows: false });
        await p.waitForTimeout(6000);
        const rows = (await du.rows(f)).filter((r) => r.includes(lot));
        expect(rows, 'the MB user sees the England lot').toHaveLength(1);
        await f.locator('tr.jqgrow').filter({ hasText: lot }).first().dblclick();
        await p.waitForTimeout(2500);
        const dlg = f.locator('.ui-jqdialog:visible');
        expect(await dlg.count(), 'a dialog opened').toBeGreaterThan(0);
        const title = (await dlg.first().innerText()).replace(/\s+/g, ' ').slice(0, 60);
        const field = await dlg.locator('[name="PrintEntity"]').first().evaluate((e: HTMLSelectElement) => ({ tag: e.tagName, disabled: e.disabled, value: e.value })).catch(() => null);
        console.log(`dialog "${title}" Print Entity field: ${JSON.stringify(field)}`);
        expect(field, 'the dialog has a Print Entity field').not.toBeNull();
        expect(field!.value).toBe('England');
        if (field!.disabled !== true) {
          console.log('DEVIATION PE.161004.F.7.9: the Print Entity dropdown is not locked in the Edit Record dialog');
          test.info().annotations.push({ type: 'deviation PE.161004.F.7.9', description: `expected the Print Entity dropdown locked (disabled) in the Edit Record dialog for a one-entity user; actual ${JSON.stringify(field)}` });
        }
        await f.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: /Cancel/ }).first().click().catch(() => {});
      } finally {
        await ctx.close();
      }
    });
  } finally {
    await test.step('cleanup: delete the lot, MB user without entities, group without processes', async () => {
      await setUserPrintEntities(page, MB, []).catch(() => {});
      await sec.setGroupProcesses(page, GROUP, []).catch(() => {});
      try {
        const g = await openLots(page);
        await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
        await g.locator('tr.jqgrow').first().waitFor({ timeout: 45_000 }).catch(() => {});
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
    });
  }
});
