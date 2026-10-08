// Dictionary Management security gating (live 2026-10-07, TST703). The MB fixture group MBPWLoginGrp / user MBPWLogin01 get ONE process more per state (second browser context for the MB user), the
// seed user edits the group (only MB groups are allowed). Formal scripts: DM_Security-1.1, DM_NewEntry-1.4 (step 2), DM_ViewEdit-1.8 (step 1). Ends with the group holding only Login_WebMenu.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as dm from '../support/dictionary';
import { openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu'];

interface Menu { text: string; disabled: boolean; title: string }

async function menu(f: Frame, trigger: string): Promise<Menu[]> {
  await f.locator(trigger).click();
  await f.page().waitForTimeout(500);
  const items = await f.locator('ul:visible li').evaluateAll((lis) => lis.map((li) => ({
    text: ((li.querySelector('a') as HTMLElement | null)?.innerText || (li as HTMLElement).innerText || '').trim(),
    disabled: /disabled/i.test(li.className) || /disabled/i.test((li.querySelector('a') as HTMLElement | null)?.className || '') || /not authorized/i.test(li.getAttribute('title') || ''),
    title: li.getAttribute('title') || (li.querySelector('a') as HTMLElement | null)?.getAttribute('title') || '',
  })));
  await f.locator(trigger).click();
  return items.filter((i) => i.text);
}

test('Dictionary Management: each DM_* process switches on its own control; the module tile needs Web_DictionaryManagement', async ({ page, browser }) => {
  test.setTimeout(1_800_000);
  sec.assertMb(GROUP);
  await sec.openSecurity(page);
  // an UNAPPROVED record of our own: approved records open read-only in View/Edit whatever the security (the seeded prompt phrases are approved)
  const stamp = Date.now().toString().slice(-6);
  const PHR = `MBDMS${stamp}`;
  {
    const ctx = await (browser as Browser).newContext();
    const ap = await ctx.newPage();
    await dm.openDictionary(ap);
    await dm.openMainAction(ap, 'New Entry');
    await dm.fillNewEntry(ap, { phrase: PHR, language: 'MBLangS', translation: 'Security test' });
    await ap.waitForTimeout(2500);
    await ctx.close();
  }

  /** MB user in a second context: tile present? and, when present, the state of every menu entry for a retrieved record. */
  const inspect = async (): Promise<{ tile: boolean; main: Menu[]; row: Menu[]; bulk: Menu[]; editable: boolean | null; p?: Page; close: () => Promise<void> }> => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2000);
    const tile = (await p.locator('button.menuIcon:has-text("Dictionary Management")').count()) > 0;
    const out = { tile, main: [] as Menu[], row: [] as Menu[], bulk: [] as Menu[], editable: null as boolean | null, close: () => ctx.close() };
    if (tile) {
      await openMenuItem(p, 'Dictionary Management');
      const f = await findFrame(p, 'DictionaryManagement/Management');
      await p.waitForTimeout(3000);
      await f.click('#btnReset');
      await p.waitForTimeout(2500);
      const g = dm.frameOf(p);
      await g.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
      await p.waitForTimeout(400);
      await g.locator('select[name="dvFilters[0].Column"]').selectOption('Phrase');
      await g.locator('input[name="dvFilters[0].Value"]').fill(PHR);
      await g.locator('#drpApproved').selectOption({ label: 'Any' });
      await Promise.all([p.waitForResponse((r) => r.url().includes('GridSessionStart'), { timeout: 20_000 }), g.click('#btnRetrieveData')]);
      await p.waitForTimeout(2500);
      out.main = await menu(g, '#drpMainActions');
      await g.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
      await p.waitForTimeout(500);
      out.row = (await g.locator('ul:visible li').evaluateAll((lis) => lis.map((li) => ({ text: ((li.querySelector('a') as HTMLElement | null)?.innerText || '').trim(), disabled: /disabled/i.test(li.className) || /disabled/i.test((li.querySelector('a') as HTMLElement | null)?.className || '') || /not authorized/i.test(li.getAttribute('title') || ''), title: li.getAttribute('title') || '' })))).filter((i) => i.text);
      await g.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
      await g.locator('#grdJqGrid tr.jqgrow input[type=checkbox]').first().check();
      out.bulk = await menu(g, '#drpActions');
      // the View/Edit window: Translation is editable only with DM_Edit (otherwise every field is disabled)
      await g.locator('#grdJqGrid tr.jqgrow input[type=checkbox]').first().uncheck();
      await g.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
      await p.waitForTimeout(500);
      await g.locator('ul:visible li a').filter({ hasText: 'View/Edit' }).click({ force: true });
      await p.waitForTimeout(3000);
      const ef = dm.editFrame(p);
      out.editable = ef ? await ef.locator('#nonHtmlTrans').isEnabled() : null;
    }
    out.p = p;
    return out;
  };
  const show = (label: string, r: Awaited<ReturnType<typeof inspect>>) => console.log(`${label}: tile=${r.tile} main=${JSON.stringify(r.main)} row=${JSON.stringify(r.row)} bulk=${JSON.stringify(r.bulk)}`);
  const state = async (extra: string[]) => { await sec.setGroupProcesses(page, GROUP, [...BASE, ...extra]); };
  const get = (items: Menu[], name: string) => items.find((i) => i.text.includes(name));

  try {
    await test.step('S0: only Login_WebMenu -> no Dictionary Management tile', async () => {
      await state([]);
      const r = await inspect();
      expect(r.tile).toBe(false);
      await r.close();
    });

    let processes: string[] = ['Web_DictionaryManagement'];
    await test.step('S1: + Web_DictionaryManagement -> tile and module open, every action disabled with a "User not authorized" tooltip', async () => {
      await state(processes);
      const r = await inspect();
      show('S1', r);
      expect(r.tile).toBe(true);
      for (const n of ['New Entry', 'Excel Import']) expect(get(r.main, n)?.disabled, `${n} disabled`).toBe(true);
      expect(get(r.row, 'New Version')?.disabled, 'New Version disabled').toBe(true);
      for (const n of ['Export to Excel', 'Mass Approve', 'Mass Retire']) expect(get(r.bulk, n)?.disabled, `${n} disabled`).toBe(true);
      expect(r.editable, 'View/Edit window is read-only without DM_Edit').toBe(false);
      console.log(`tooltips: ${JSON.stringify([...r.main, ...r.row, ...r.bulk].map((i) => `${i.text} -> ${i.title}`))}`);
      await r.close();
    });

    const steps: Array<[string, (r: Awaited<ReturnType<typeof inspect>>) => void]> = [
      ['DM_NewEntry', (r) => expect(get(r.main, 'New Entry')?.disabled, 'New Entry enabled').toBe(false)],
      ['DM_Edit', (r) => expect(r.editable, 'View/Edit window is editable with DM_Edit').toBe(true)],
      ['DM_NewVersion', (r) => expect(get(r.row, 'New Version')?.disabled, 'New Version enabled').toBe(false)],
      ['DM_Export', (r) => expect(get(r.bulk, 'Export to Excel')?.disabled, 'Export enabled').toBe(false)],
      ['DM_MassApprove', (r) => expect(get(r.bulk, 'Mass Approve')?.disabled, 'Mass Approve enabled').toBe(false)],
      ['DM_MassRetireUnretire', (r) => expect(get(r.bulk, 'Mass Retire')?.disabled, 'Mass Retire enabled').toBe(false)],
      ['DM_Import', (r) => expect(get(r.main, 'Excel Import')?.disabled, 'Excel Import enabled').toBe(false)],
    ];
    for (const [proc, check] of steps) {
      await test.step(`+ ${proc} -> its own control switches on`, async () => {
        processes = [...processes, proc];
        await state(processes);
        const r = await inspect();
        show(`+${proc}`, r);
        check(r);
        await r.close();
      });
    }

    await test.step('server side: a user with only the module process can still open the New Entry dialog URL (observation)', async () => {
      await state(['Web_DictionaryManagement']);
      const ctx = await (browser as Browser).newContext();
      const p = await ctx.newPage();
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(1500);
      await p.goto(`${dm.frameOf === undefined ? '' : ''}http://vmsrvtst703/InnoPages/DictionaryManagement/ViewEdit?pageAction=new&dicId=`);
      await p.waitForTimeout(3000);
      const body = (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200);
      console.log(`direct ViewEdit?pageAction=new as a user WITHOUT DM_NewEntry: ${body}`);
      await ctx.close();
    });
  } finally {
    await test.step('cleanup: the group holds only Login_WebMenu', async () => { await sec.setGroupProcesses(page, GROUP, BASE); });
  }
});
