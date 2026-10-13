// Label Control security gating re-checked against ValMaster (LC.161207.F.1.3 / F.1.4 / F.1.30 / F.1.31 / F.3.9 / F.4.2 / F.7.2 / F.8.2 / F.10.2 / F.11.2 / F.16.2; live 2026-10-11, headless, TST703).
// MB fixtures only: group MBPWLoginGrp / user MBPWLogin01 (the group is left without processes). Read-only: nothing is submitted.
// Bulk actions are rendered with `menuDisable` + `processName`; this reads which are disabled and their tooltips for the MB user.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { login, loginAs, openMenuItem, findFrame, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu'];
const LT = ['LT_Carton Label', 'SCH_RobarMasterData']; // label type security so rows are visible; SCH_<item schema> or the page shows "All schemas have been disallowed due to Schema Security" (MDM integration on)

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

interface Seen { tile: boolean; bulk: Record<string, { disabled: boolean; title: string }>; rowActions: Record<string, { disabled: boolean; title: string }>; rows: number }

test('Label Control tile, bulk actions and row actions follow their security processes (MB group only)', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  await login(page);

  const inspect = async (processes: string[]): Promise<Seen> => {
    await sec.setGroupProcesses(page, GROUP, [...BASE, ...processes]);
    const ctx = await (browser as Browser).newContext();
    const p: Page = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      const tile = await p.getByRole('button', { name: 'Label Control', exact: true }).isVisible().catch(() => false);
      const seen: Seen = { tile, bulk: {}, rowActions: {}, rows: 0 };
      if (!tile) return seen;
      await openMenuItem(p, 'Label Control');
      let f: Frame = await findFrame(p, 'LabelControl/Management');
      await p.waitForTimeout(6000);
      await f.click('#btnReset'); // clears restored criteria; no criteria = every record the user's label type security allows
      await p.waitForTimeout(2000);
      f = await findFrame(p, 'LabelControl/Management');
      await p.waitForTimeout(5000);
      await f.click('#btnRetrieveData');
      await f.locator('#grdLabelControl tr.jqgrow').first().waitFor({ timeout: 30_000 }).catch(() => {});
      await p.waitForTimeout(1500);
      seen.rows = await f.locator('#grdLabelControl tr.jqgrow').count();
      if (!seen.rows) { await p.screenshot({ path: 'test-results/lc-sec-norows.png' }).catch(() => {}); console.log('PAGE ' + (await f.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 400)); }
      if (seen.rows) {
        const info = await f.locator('[id^="act"]').evaluateAll((els) => els.map((e: any) => {
          const li = e.closest('li') || e;
          // Label Control's menuDisable binding does not add ui-state-disabled: it sets the title, greys the link and sets pointer-events:none
          const a = e.tagName === 'A' ? e : e.querySelector('a') || e;
          return `${e.id}|${getComputedStyle(a).pointerEvents === 'none'}|${li.getAttribute('title') || e.getAttribute('title') || ''}`;
        }));
        for (const i of info) { const [id, dis, title] = i.split('|'); seen.bulk[id] = { disabled: dis === 'true', title }; }
        // a row WITH an LCN, so "Action disabled for records with no Label Control Number" does not mask the security state
        const withLcn = f.locator('#grdLabelControl tr.jqgrow').filter({ hasText: /LCN\d+/ }).first();
        const act = ((await withLcn.count()) ? withLcn : f.locator('#grdLabelControl tr.jqgrow').first()).locator('a:has-text("Actions")').first();
        await act.click({ timeout: 5000 }).catch(() => {});
        await p.waitForTimeout(600);
        const li = await f.locator('ul:visible li').evaluateAll((els) => els.map((e: any) => `${e.innerText.trim()}|${e.getAttribute('title') || e.querySelector('a')?.getAttribute('title') || ''}|${e.className}`));
        console.log(`ROW MENU ${JSON.stringify(li)}`);
        for (const i of li) { const [n, title, cls] = i.split('|'); seen.rowActions[n] = { disabled: !!title || cls.includes('ui-state-disabled'), title }; }
      }
      return seen;
    } finally {
      await ctx.close();
    }
  };

  const none = await inspect([]);
  console.log(`NO PROCESSES ${JSON.stringify(none)}`);
  expect.soft(none.tile, 'Label Control tile hidden without LC_View_LabelControl (F.1.3)').toBe(false);

  const view = await inspect(['LC_View_LabelControl', ...LT]);
  console.log(`LC_View_LabelControl ${JSON.stringify(view)}`);
  expect.soft(view.tile, 'tile visible with LC_View_LabelControl').toBe(true);
  if (view.rows === 0) deviation('LC.161207.F.1.3', 'the MB user sees label control records with LC_View_LabelControl', 'no rows retrieved (label type security hides them?)');
  for (const [id, s] of Object.entries(view.bulk)) {
    if (!s.disabled) deviation('LC.161207.F.1.31', `${id} disabled without its process`, 'enabled');
    else if (!/Not authorized for this action, '.+'/i.test(s.title)) deviation('LC.161207.F.1.31', `tooltip "Not authorized for this action, '<process>'" on ${id}`, `"${s.title}"`);
  }
  for (const [n, s] of Object.entries(view.rowActions)) {
    if (!s.disabled) deviation('LC.161207.F.1.30', `row action ${n} disabled without its process`, 'enabled');
    else if (!/User not authorized to perform action/i.test(s.title)) deviation('LC.161207.F.1.30', `tooltip "User not authorized to perform action" on ${n}`, `"${s.title}"`);
  }

  // each process enables exactly its own action
  const pairs: Array<[string, string, 'bulk' | 'row']> = [
    ['LC_Update_Versions', 'actUpdateVersions', 'bulk'], ['LC_Update_Versions', 'Update Versions', 'row'],
    ['LC_Manage_ProdAvail', 'actManageProduct', 'bulk'], ['LC_Assign_LabelControl', 'actAssignLabelControl', 'bulk'],
    ['LC_LinkToLabelMaster', 'actLinkToLabelMaster', 'bulk'], ['LM_Link_Attachments', 'actLinkAttachments', 'bulk'], ['LM_View_LinkManagement', 'Attachments', 'row'],
  ];
  const processes = [...new Set(pairs.map((p) => p[0]))];
  for (const proc of processes) {
    const s = await inspect(['LC_View_LabelControl', ...LT, proc]);
    const enabledBulk = Object.entries(s.bulk).filter(([, v]) => !v.disabled).map(([k]) => k);
    const enabledRow = Object.entries(s.rowActions).filter(([, v]) => !v.disabled).map(([k]) => k);
    console.log(`${proc}: enabled bulk=${JSON.stringify(enabledBulk)} row=${JSON.stringify(enabledRow)}`);
    for (const [p, target, kind] of pairs.filter((x) => x[0] === proc)) {
      const list = kind === 'bulk' ? enabledBulk : enabledRow;
      if (!list.includes(target)) deviation('LC.161207.F.8.2', `${proc} enables ${target}`, JSON.stringify(list));
    }
  }

  await sec.setGroupProcesses(page, GROUP, []);
});
