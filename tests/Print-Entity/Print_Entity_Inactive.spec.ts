// An INACTIVE Print Entity assigned to a user (live 2026-10-08, headless, TST703; PrintEntityRequired = Y; MB fixtures only; prints nothing). Print Entity Management lists England / MLAUser1 / ROBAR / Vendors
// as active and `Mars` (Print Entity for Mars) and `1240` (Germany) as INACTIVE. Formal scripts PE_*: an inactive entity assigned to the user never appears on the print screens (with only inactive entities
// the hard block "No active Print Entities associated with this user. Cannot proceed." applies; with one active entity the dropdown is pre-selected and disabled). Entities are only ASSIGNED
// (User Print Entity Management, MB user only), never created or changed. At the end the MB user has no entities and the group no processes. Skips unless PrintEntityRequired = Y.

import { test, expect } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { login, loginAs, openMenuItem, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { setUserPrintEntities } from '../support/print-entity';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const PROCS = ['Login_WebMenu', 'Print_Label', 'BP_PrintByOrder_Option', 'BP_PrintByLot_Option', 'BP_MultiDocumentPrint', 'LE_View_Lots', 'LE_Add_Lots', 'LE_Chg_Lots'];
const NONE = 'No active Print Entities associated with this user. Cannot proceed.';

async function look(p: Page, tile: string, url: string, legacy: boolean): Promise<{ body: string; dd: { disabled: boolean; value: string; options: string[] } | null }> {
  await p.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(p, tile);
  await p.waitForTimeout(5000);
  const f = p.frames().filter((x) => x.url().includes(url)).pop()!;
  const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
  const sel = legacy ? f.locator('select[id$="ddlPrintEntity"]') : f.locator('select').first();
  const dd = (await sel.count()) ? await sel.evaluate((e: HTMLSelectElement) => ({ disabled: e.disabled, value: e.value, options: Array.from(e.options).map((o) => o.text) })) : null;
  await p.locator(`li.ui-tabs-tab:has-text("${tile}") .ui-icon-close`).click({ timeout: 2000 }).catch(() => {});
  return { body, dd };
}

test('Print Entity: an inactive entity assigned to the user never appears on the print screens', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}`);
  await sec.setGroupProcesses(page, GROUP, PROCS);
  const screens: Array<[string, string, boolean]> = [['Print by lot', 'PrintScreen', true], ['Print by order', 'PrintScreen', true], ['Multi Document Printing', 'MultiDocumentPrinting', false]];
  const inspect = async (ents: string[]) => {
    await setUserPrintEntities(page, MB, ents);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      const out: Record<string, Awaited<ReturnType<typeof look>>> = {};
      for (const [tile, url, legacy] of screens) {
        out[tile] = await look(p, tile, url, legacy);
        console.log(`${JSON.stringify(ents)} ${tile}: dd=${JSON.stringify(out[tile].dd)} ${out[tile].body.slice(0, 110)}`);
      }
      // Lot Management Add dialog (DynamicUI): which entities does it offer?
      const f = await du.reopenDynamicUi(p, 'Lot Management');
      const add = (await f.locator('#add_grdJqGrid').count()) > 0 && (await du.navEnabled(f, 'add'));
      let lm: string[] | null = null; // null = the Add icon is disabled
      if (add) {
        const dlg = await du.openFormDialog(f, 'add');
        lm = await dlg.locator('[name="PrintEntity"]').evaluate((e: HTMLSelectElement) => Array.from(e.options).map((o) => o.text));
        await du.cancelForm(f);
      }
      console.log(`${JSON.stringify(ents)} Lot Management Add dialog entities: ${JSON.stringify(lm)}`);
      return { out, lm };
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('ONLY an inactive entity (Mars): every print screen refuses with the hard-block message', async () => {
      const { out } = await inspect(['Mars']);
      for (const [tile] of screens) {
        expect(out[tile].body, tile).toContain(NONE);
        expect(out[tile].dd === null || out[tile].dd!.options.length === 0, `${tile}: nothing to choose`).toBe(true);
      }
    });
    await test.step('England (active) + Mars (inactive): only England, pre-selected and disabled', async () => {
      const { out, lm } = await inspect(['England', 'Mars']);
      for (const [tile] of screens) {
        expect(out[tile].body, tile).not.toContain(NONE);
        expect(out[tile].dd, tile).toEqual({ disabled: true, value: 'England', options: ['England'] });
      }
      console.log(`Lot Management Add dialog for England + Mars: ${lm === null ? 'Add icon disabled' : JSON.stringify(lm)}`);
    });
  } finally {
    await test.step('cleanup: the MB user has no entities, the group no processes', async () => {
      await setUserPrintEntities(page, MB, []).catch((e) => console.log(`entity cleanup skipped: ${String(e).slice(0, 120)}`));
      await sec.setGroupProcesses(page, GROUP, []).catch(() => {});
    });
  }
});
