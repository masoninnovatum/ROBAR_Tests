// Print Entity on the print screens with PrintEntityRequired = Y (live 2026-10-08, TST703, headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only; prints NOTHING). Formal scripts PE_PrintByLot / PE_PrintByOrder /
// PE_PrintByOrderMulti / PE_PrintByLotMulti / PE_PrintByOrderLot / PE_MultiDocumentPrinting (the mechanic repeats verbatim per screen): the user's ACTIVE Print Entities drive the screen:
//   none -> "No active Print Entities associated with this user. Cannot proceed." (no dropdown);  one -> dropdown pre-selected and DISABLED;  two+ -> editable dropdown, ascending.
// The MB user needs Print_Label and the screen's BP_*_Option process (without Print_Label every screen shows "User not authorized to print. Print_Label" and the dropdown is disabled whatever the entities).
// The seed user changes the MB user's entities (User Print Entity Management); at the end the MB user has no entities and the group no processes. Skips unless PrintEntityRequired = Y.

import { test, expect } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import { login, loginAs, openMenuItem, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import { setUserPrintEntities } from '../support/print-entity';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const PROCS = ['Login_WebMenu', 'Print_Label', 'BP_PrintByOrder_Option', 'BP_PrintByLot_Option', 'BP_PrintByOrderMulti_Option', 'BP_PrintByLotMulti_Option', 'BP_PrintByOrderLot_Option', 'BP_MultiDocumentPrint'];
// tile text, URL part of the frame, label next to the dropdown
const SCREENS: Array<{ tile: string; url: string; legacy: boolean }> = [
  { tile: 'Print by order', url: 'PrintScreen', legacy: true },
  { tile: 'Print by lot', url: 'PrintScreen', legacy: true },
  { tile: 'Print by order multi', url: 'PrintScreen', legacy: true },
  { tile: 'Print by lot multi', url: 'PrintScreen', legacy: true },
  { tile: 'Print by order lot', url: 'PrintScreen', legacy: true },
  { tile: 'Multi Document Printing', url: 'MultiDocumentPrinting', legacy: false },
];
const NONE = 'No active Print Entities associated with this user. Cannot proceed.';

interface Seen { body: string; dd: { disabled: boolean; value: string; options: string[] } | null }

async function look(p: Page, tile: string, url: string, legacy: boolean): Promise<Seen> {
  await p.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(p, tile);
  await p.waitForTimeout(5000);
  const f = p.frames().filter((x) => x.url().includes(url)).pop()!;
  const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
  // legacy screens: #...ddlPrintEntity; Multi Document Printing: the first select of the entry panel (no id) whose options are entity names
  const sel = legacy ? f.locator('select[id$="ddlPrintEntity"]') : f.locator('select').first();
  const dd = (await sel.count()) ? await sel.evaluate((e: HTMLSelectElement) => ({ disabled: e.disabled, value: e.value, options: Array.from(e.options).map((o) => o.text) })) : null;
  await p.locator(`li.ui-tabs-tab:has-text("${tile}") .ui-icon-close`).click({ timeout: 2000 }).catch(() => {});
  return { body, dd };
}

test('Print Entity (PrintEntityRequired = Y): every print screen follows the user\'s active entities', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);
  const setting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  test.skip(setting !== 'Y', `PrintEntityRequired is ${setting}; this behavior only exists when it is Y`);
  await sec.setGroupProcesses(page, GROUP, PROCS);
  const inspect = async (ents: string[]): Promise<Record<string, Seen>> => {
    await setUserPrintEntities(page, MB, ents);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    const out: Record<string, Seen> = {};
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      for (const s of SCREENS) {
        out[s.tile] = await look(p, s.tile, s.url, s.legacy);
        console.log(`${JSON.stringify(ents)} ${s.tile}: dd=${JSON.stringify(out[s.tile].dd)} ${out[s.tile].body.slice(0, 120)}`);
      }
      // two entities: the dropdown is really editable (pick the second one on Print by lot)
      if (ents.length === 2) {
        await openMenuItem(p, 'Print by lot');
        await p.waitForTimeout(5000);
        const f = p.frames().filter((x) => x.url().includes('PrintScreen')).pop()!;
        await f.locator('select[id$="ddlPrintEntity"]').selectOption({ label: 'ROBAR' });
        expect(await f.locator('select[id$="ddlPrintEntity"]').inputValue()).toBe('ROBAR');
      }
    } finally {
      await ctx.close();
    }
    return out;
  };

  try {
    await test.step('NO active Print Entity: every screen refuses with the hard-block message and shows no dropdown', async () => {
      const r = await inspect([]);
      for (const s of SCREENS) {
        expect(r[s.tile].body, s.tile).toContain(NONE);
        expect(r[s.tile].dd === null || r[s.tile].dd!.options.length === 0, `${s.tile}: no entity to choose`).toBe(true);
      }
    });
    await test.step('ONE entity (England): dropdown pre-selected and disabled on every screen', async () => {
      const r = await inspect(['England']);
      for (const s of SCREENS) {
        expect(r[s.tile].body, s.tile).not.toContain(NONE);
        expect(r[s.tile].dd, s.tile).toEqual({ disabled: true, value: 'England', options: ['England'] });
      }
    });
    await test.step('TWO entities (ROBAR + England): editable dropdown, ascending, default England', async () => {
      const r = await inspect(['ROBAR', 'England']);
      for (const s of SCREENS) {
        expect(r[s.tile].dd, s.tile).toEqual({ disabled: false, value: 'England', options: ['England', 'ROBAR'] });
      }
    });
  } finally {
    await test.step('cleanup: the MB user has no entities, the group no processes', async () => {
      await setUserPrintEntities(page, MB, []).catch((e) => console.log(`entity cleanup skipped: ${String(e).slice(0, 120)}`));
      await sec.setGroupProcesses(page, GROUP, []).catch(() => {});
    });
  }
});
