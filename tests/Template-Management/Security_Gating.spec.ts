// Template Management security gating, observed as a REAL MB user (fixtures `MBPWLoginGrp` group + `MBPWLogin01` user, created by
// Security-Management/Security_Effect_On_Login.spec.ts; only MB* security is ever changed). The admin (seed user) sets the group's
// authorizations; the MB user logs in in a second browser context and Template Management's menus are read:
//   * Web_Template_Management is the page/tile gate; LT_<Label Type> gates which templates are searchable (label type security)
//   * every row/bulk action stays in the menu but carries a tooltip "User not authorized for this task <TM_...>." when its
//     process is missing; each process maps to specific actions (table below)
//   * Replace Template / Edit Attributes are ALSO disabled with "Template is approved." on approved templates, whatever the user holds
// Source: Innovatum.Pages.TemplateManagement.MVC (Controller `IsInRole("TM_...")`, Management.cshtml authMsg) and the WCF service
// (`RequestCheck(signature, ..., _approveSecurityProcess)` re-checks the signing user for Approve/Retire/Send to Workflow).
// Note: the roles are read at LOGIN, so every state needs a fresh login.

import { test, expect } from '@playwright/test';
import type { Browser, Frame } from '@playwright/test';
import * as sec from '../support/security';
import { loginAs, findFrame, openMenuItem, PASSWORD } from '../support/robar';

const GROUP = 'MBPWLoginGrp';
const USER = 'MBPWLogin01';
const NOT_AUTH = (p: string) => `User not authorized for this task ${p}.`;

type Titles = Record<string, string>;

test('Template Management: tile, label-type visibility and per-process action gating for a real MB user', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  sec.assertMb(USER);
  let f: Frame = await sec.openSecurity(page);
  await sec.setView(f, 'GROUP');
  await sec.selectRow(page, f, sec.groupRow(f, GROUP));
  const names = Object.keys(await sec.readProcesses(f));
  const LT = 'LT_Carton Label'; // the label type of every template this suite creates
  expect(names).toEqual(expect.arrayContaining([LT, 'Web_Template_Management', 'Login_WebMenu', 'TM_Approve_Templates']));

  /** Makes the group hold exactly `procs`. */
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

  interface Observation {
    tiles: string[];
    warning: string;
    rows: number;
    rowTitles: Titles;
    bulkTitles: Titles;
  }

  /** Logs the MB user in (fresh context), searches templates by name, and reads the row-action and bulk-action tooltips. */
  const observe = async (nameContains: string): Promise<Observation> => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, USER, PASSWORD);
      await p.waitForTimeout(2000);
      const tiles = (await p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      const out: Observation = { tiles, warning: '', rows: 0, rowTitles: {}, bulkTitles: {} };
      if (!tiles.includes('Template Management')) return out;
      await openMenuItem(p, 'Template Management');
      const tf = await findFrame(p, 'TemplateManagement');
      await tf.locator('#btnRetrieveData').waitFor({ timeout: 20_000 });
      await p.waitForTimeout(2500);
      if ((await tf.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
        await tf.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
        await p.waitForTimeout(400);
      }
      await tf.locator('select[name="dvFilters[0].Column"]').selectOption('LabelName', { timeout: 5000 });
      await tf.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains', { timeout: 5000 });
      await tf.locator('input[name="dvFilters[0].Value"]').fill(nameContains, { timeout: 5000 });
      await tf.click('#btnRetrieveData', { timeout: 5000 });
      await p.waitForTimeout(3500);
      out.warning = (await tf.locator('body').innerText()).match(/Some search results are not included due to label type security\./)?.[0] ?? '';
      out.rows = await tf.locator('#grdJqGrid tr.jqgrow').count();
      const read = async () =>
        Object.fromEntries(
          await tf.locator('ul:visible li').evaluateAll((lis) =>
            lis.map((li) => [(li as HTMLElement).innerText.trim().split('\n')[0].trim(), li.getAttribute('title') ?? li.querySelector('a')?.getAttribute('title') ?? ''] as [string, string])
          )
        ) as Titles;
      if (out.rows > 0) {
        const first = tf.locator('#grdJqGrid tr.jqgrow').first();
        await first.getByText('Actions', { exact: true }).click();
        await p.waitForTimeout(600);
        out.rowTitles = await read();
        await first.getByText('Actions', { exact: true }).click().catch(() => {});
        await first.locator('input[type=checkbox]').first().check();
        await p.waitForTimeout(500);
        await tf.locator('#drpActions').click({ timeout: 5000 });
        await p.waitForTimeout(500);
        out.bulkTitles = await read();
      }
      return out;
    } finally {
      await ctx.close();
    }
  };

  const BASE = ['Login_WebMenu'];

  await test.step('without Web_Template_Management the tile is not shown', async () => {
    await setSet(BASE);
    const o = await observe('MBGDMD');
    console.log(`no Web_Template_Management: tiles ${JSON.stringify(o.tiles)}`);
    expect(o.tiles).not.toContain('Template Management');
  });

  await test.step('label type security: without LT_Carton Label the Carton Label templates are not searchable', async () => {
    await setSet([...BASE, 'Web_Template_Management']);
    const o = await observe('MBGDMD');
    expect(o.tiles).toContain('Template Management');
    expect(o.rows, 'no label types => no templates').toBe(0);
    expect(o.warning).toBe('Some search results are not included due to label type security.');
  });

  await test.step('with the tile + LT_Carton Label but no TM_* process every action is flagged "User not authorized ... TM_x"', async () => {
    await setSet([...BASE, 'Web_Template_Management', LT]);
    const o = await observe('MBGDMD'); // unapproved templates, so approval does not interfere
    expect(o.rows).toBeGreaterThan(0);
    console.log(`row titles: ${JSON.stringify(o.rowTitles)}`);
    console.log(`bulk titles: ${JSON.stringify(o.bulkTitles)}`);
    expect(o.rowTitles).toEqual({
      'View/Edit Template': '',
      'View/Edit Comments': NOT_AUTH('TM_View_Comments'),
      'View Label Characteristics': '',
      'Replace Template': NOT_AUTH('TM_Edit_Templates'),
      'Edit Attributes': NOT_AUTH('TM_Edit_Attributes'),
      Download: NOT_AUTH('TM_Download_Templates'),
      'Save As New': NOT_AUTH('TM_Edit_Templates'),
    });
    expect(o.bulkTitles).toEqual({
      'Approve Templates': NOT_AUTH('TM_Approve_Templates'),
      'Retire Templates': NOT_AUTH('TM_Retire_Templates'),
      'Submit to Workflow': NOT_AUTH('TM_WorkflowSendTo'),
      Download: NOT_AUTH('TM_Download_Templates'),
    });
  });

  // process -> the actions (row/bulk) it alone enables
  const MAPPING: { process: string; row: string[]; bulk: string[] }[] = [
    { process: 'TM_Approve_Templates', row: [], bulk: ['Approve Templates'] },
    { process: 'TM_Retire_Templates', row: [], bulk: ['Retire Templates'] },
    { process: 'TM_WorkflowSendTo', row: [], bulk: ['Submit to Workflow'] },
    { process: 'TM_Download_Templates', row: ['Download'], bulk: ['Download'] },
    { process: 'TM_Edit_Templates', row: ['Replace Template', 'Save As New'], bulk: [] },
    { process: 'TM_Edit_Attributes', row: ['Edit Attributes'], bulk: [] },
    { process: 'TM_View_Comments', row: ['View/Edit Comments'], bulk: [] },
  ];
  for (const m of MAPPING) {
    await test.step(`${m.process} alone enables exactly: ${[...m.row, ...m.bulk.map((b) => 'bulk ' + b)].join(', ')}`, async () => {
      await setSet([...BASE, 'Web_Template_Management', LT, m.process]);
      const o = await observe('MBGDMD');
      const enabled = (t: Titles) => Object.keys(t).filter((k) => t[k] === '').sort();
      const alwaysOpen = ['View Label Characteristics', 'View/Edit Template'];
      expect(enabled(o.rowTitles), `row actions enabled with only ${m.process}`).toEqual([...alwaysOpen, ...m.row].sort());
      expect(enabled(o.bulkTitles), `bulk actions enabled with only ${m.process}`).toEqual([...m.bulk].sort());
    });
  }

  await test.step('with every TM_* process the menus are open, but approved templates still block Replace Template / Edit Attributes', async () => {
    await setSet([...BASE, 'Web_Template_Management', LT, ...names.filter((n) => /^TM_/.test(n))]);
    const approved = await observe('MBSide'); // approved templates
    expect(approved.rows).toBeGreaterThan(0);
    expect(approved.rowTitles['Replace Template']).toBe('Template is approved.');
    expect(approved.rowTitles['Edit Attributes']).toBe('Template is approved.');
    for (const open of ['View/Edit Template', 'View/Edit Comments', 'View Label Characteristics', 'Download', 'Save As New']) expect(approved.rowTitles[open], open).toBe('');
    for (const b of Object.keys(approved.bulkTitles)) expect(approved.bulkTitles[b], `bulk ${b}`).toBe('');
    const unapproved = await observe('MBGDMD');
    for (const r of Object.keys(unapproved.rowTitles)) expect(unapproved.rowTitles[r], `unapproved template, row ${r}`).toBe('');
  });

  await test.step('cleanup: the fixture group is left with no authorizations', async () => {
    await setSet([]);
  });
});
