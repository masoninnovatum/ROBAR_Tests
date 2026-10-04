// Label Type Management security gating, observed as a REAL MB user (fixtures `MBPWLoginGrp` + `MBPWLogin01`, created by
// Security-Management/Security_Effect_On_Login.spec.ts; only MB* security is changed). DynamicUI definition "LabelTypes" is seeded with
//   CanView = View_LabelTypes, CanAdd / CanEdit / CanExcelImport = Web_LabelTypes, CanDelete = "N" (never), CanExcelExport = Y,
//   CanViewAudit = Y   (Innovatum.Install/ROBARDB/BaseProductTables/DynamicUIHeader)
// so: no View_LabelTypes -> no tile; View only -> read-only; + Web_LabelTypes -> Add/Edit/Excel Import. Roles are read at LOGIN.

import { test, expect } from '@playwright/test';
import type { Browser, Frame } from '@playwright/test';
import * as sec from '../support/security';
import { loginAs, findFrame, openMenuItem, PASSWORD } from '../support/robar';

const GROUP = 'MBPWLoginGrp';
const USER = 'MBPWLogin01';

test('Label Type Management: tile, read-only mode and edit rights follow View_LabelTypes / Web_LabelTypes', async ({ page, browser }) => {
  test.setTimeout(600_000);
  sec.assertMb(GROUP);
  sec.assertMb(USER);
  let f: Frame = await sec.openSecurity(page);
  await sec.setView(f, 'GROUP');
  await sec.selectRow(page, f, sec.groupRow(f, GROUP));
  const names = Object.keys(await sec.readProcesses(f));
  expect(names).toEqual(expect.arrayContaining(['Login_WebMenu', 'View_LabelTypes', 'Web_LabelTypes']));

  const setSet = async (procs: string[]) => {
    f = await sec.reopenSecurity(page);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, GROUP));
    const cur = await sec.readProcesses(f);
    if (Object.values(cur).some(Boolean)) {
      const selectAll = f.locator('#cbSelectAll');
      if (!(await selectAll.isChecked())) {
        await Promise.all([page.waitForResponse((r) => r.url().includes('UpdateAllSecurityProcesses'), { timeout: 20_000 }), selectAll.setChecked(true, { timeout: 5000 })]);
        await page.waitForTimeout(800);
      }
      await Promise.all([page.waitForResponse((r) => r.url().includes('UpdateAllSecurityProcesses'), { timeout: 20_000 }), selectAll.setChecked(false, { timeout: 5000 })]);
      await page.waitForTimeout(800);
    }
    for (const p of procs) expect((await sec.toggleProcess(page, f, GROUP, p, true)).Success).toBe(true);
  };

  interface Obs {
    tile: boolean;
    actions: string[];
    nav: Record<string, boolean>;
    titles?: Record<string, string>;
    importOpened?: boolean;
    importText?: string;
  }
  const observe = async (): Promise<Obs> => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, USER, PASSWORD);
      await p.waitForTimeout(2000);
      const tiles = (await p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim());
      const out: Obs = { tile: tiles.includes('Label Type Management'), actions: [], nav: {} };
      if (!out.tile) return out;
      await openMenuItem(p, 'Label Type Management');
      const tf = await findFrame(p, 'DynamicUI');
      await tf.locator('#btnRetrieveData').waitFor({ timeout: 20_000 });
      await p.waitForTimeout(2500);
      if ((await tf.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
        await tf.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
        await p.waitForTimeout(400);
      }
      await tf.locator('select[name="dvFilters[0].Column"]').selectOption('LabelType', { timeout: 5000 });
      await tf.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'Exactly Matches' }, { timeout: 5000 });
      await tf.locator('input[name="dvFilters[0].Value"]').fill('MBLT1', { timeout: 5000 });
      await tf.click('#btnRetrieveData', { timeout: 5000 });
      await tf.locator('tr.jqgrow').first().waitFor({ timeout: 15_000 });
      await tf.locator('tr.jqgrow').first().click({ timeout: 5000 });
      await p.waitForTimeout(600);
      for (const i of ['add', 'edit', 'view', 'del']) {
        out.nav[i] = await tf.locator(`#${i}_grdJqGrid`).evaluate((e) => !e.classList.contains('ui-state-disabled')).catch(() => false);
      }
      await tf.locator('#drpMainActions').click({ timeout: 5000 });
      await p.waitForTimeout(600);
      // only items that are actually rendered visible (a hidden <a> still reports its text through allInnerTexts)
      out.actions = (await tf.locator('ul:visible li a').evaluateAll((as) => as.filter((a) => (a as HTMLElement).offsetWidth > 0 && (a as HTMLElement).offsetHeight > 0).map((a) => ((a as HTMLElement).textContent ?? '').trim().split('document.getElementById')[0].trim())));
      out.titles = Object.fromEntries(await tf.locator('ul:visible li').evaluateAll((lis) => lis.map((li) => [(li as HTMLElement).innerText.trim().split('\n')[0].trim(), li.getAttribute('title') ?? li.querySelector('a')?.getAttribute('title') ?? ''] as [string, string])));
      // does the (always rendered) Excel Import item actually open the import page?
      if (out.actions.includes('Excel Import')) await tf.locator('#actExcelImport').click({ force: true, timeout: 5000 });
      await p.waitForTimeout(3500);
      const importFrame = p.frames().find((x) => x.url().includes('ExcelImport'));
      out.importOpened = !!importFrame;
      out.importText = importFrame
        ? (await importFrame.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300)
        : (await p.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200) + ' | ' + (await tf.locator('.ui-dialog:visible').allInnerTexts().catch(() => [])).join(' ').replace(/\s+/g, ' ');
      return out;
    } finally {
      await ctx.close();
    }
  };

  const BASE = ['Login_WebMenu'];

  await test.step('without View_LabelTypes the tile is not shown (even with Web_LabelTypes)', async () => {
    await setSet([...BASE, 'Web_LabelTypes']);
    const o = await observe();
    expect(o.tile).toBe(false);
  });

  await test.step('View_LabelTypes only: the module opens READ-ONLY (View works; Add / Edit / Delete do not; no Excel Import)', async () => {
    await setSet([...BASE, 'View_LabelTypes']);
    const o = await observe();
    console.log(`view only: nav=${JSON.stringify(o.nav)} actions=${JSON.stringify(o.actions)}`);
    expect(o.tile).toBe(true);
    expect(o.nav.view, 'View works').toBe(true);
    expect(o.nav.add, 'no Add without Web_LabelTypes').toBe(false);
    expect(o.nav.edit, 'no Edit without Web_LabelTypes').toBe(false);
    expect(o.nav.del, 'Delete is never offered').toBe(false);
    // Unlike Template Management (flagged items) the Excel Import item is simply NOT RENDERED without Web_LabelTypes (it is in the
    // DOM but hidden, so a text-only read of the menu still lists it -- check real visibility).
    expect(o.actions).toEqual(['Excel Export', 'Audit', 'Save Search', 'Load Search', 'Adjust Page Size']);
    expect(o.importOpened, 'Excel Import cannot be opened').toBeFalsy();
  });

  await test.step('+ Web_LabelTypes: Add, Edit and Excel Import appear; Delete is still never offered', async () => {
    await setSet([...BASE, 'View_LabelTypes', 'Web_LabelTypes']);
    const o = await observe();
    console.log(`view + web: nav=${JSON.stringify(o.nav)} actions=${JSON.stringify(o.actions)}`);
    expect(o.nav).toEqual({ add: true, edit: true, view: true, del: false });
    expect(o.actions).toEqual(['Excel Import', 'Excel Export', 'Audit', 'Save Search', 'Load Search', 'Adjust Page Size']);
  });

  await test.step('cleanup: the fixture group is left with no authorizations', async () => {
    await setSet([]);
  });
});
