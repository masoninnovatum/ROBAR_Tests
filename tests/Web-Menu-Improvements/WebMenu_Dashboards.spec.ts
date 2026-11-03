// New web menu - Dashboards: Dashboards Management + Dashboards Link Management (Settings / gear, Dynamic UI) and how the landing page picks and shows them.
// Requirements (docs/agents/valmaster-web-menu-improvements.md): U.5, F.5.1-F.5.12. Not testable here: F.5.13 (a user with NO dashboard: the '*' link of "Demo Power BI" applies to everybody
// and is shared data), F.5.4 IE fields (Chrome only), Power BI content itself (external site; only the iframe `src` is checked).
// Confirmed live 2026-11-02 on TST703. Source: WebMenuController.MainMenu / RetrieveDashboard, WebMenuDB.GetDashboards + GetPrecedenceComparisonRulesForDashboards (user+group+entity,
// user+group, user, group+entity, group, entity, '*' - first rule wins, a dashboard is listed once), MainMenuLayout.cshtml (`#dashboardA` for one, `#dashSelectID` for several),
// DynamicUI definitions "Dashboards" / "DashboardsLink".
// Test data: dashboards `CLDashA<stamp>` / `CLDashB<stamp>` / `CLDashI<stamp>` (URLs to the existing Printwizard.htm page with a query string) and their links to fixture user CLPROp01 (user link)
// and group CLPRGrp; all deleted again in `finally`. The seed user keeps seeing only the shared "Demo Power BI" dashboard (single dashboard case).

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as du from '../support/dynamic-ui';
import { BASE_URL, PASSWORD } from '../support/robar';
import { loginNew, closeModuleTab, openModuleNew } from '../support/new-web-menu';
import { OP } from '../Password-Management/pr-fixtures';
import { deviation, openSettings, closeAllTabs, deleteMatching, addRow } from './wm-helpers';

test.use({ actionTimeout: 20_000 });

const stamp = Date.now().toString().slice(-6);
const DA = 'CLDashA' + stamp;
const DB = 'CLDashB' + stamp;
const DI = 'CLDashI' + stamp;
const ORIGIN = new URL(BASE_URL).origin;
const url = (tag: string) => `${ORIGIN}/innovatum/Printwizard.htm?cl=${tag}${stamp}`;
const DEFAULT = 'Demo Power BI';

const dashOptions = (p: Page) => p.locator('#dashSelectID option').allInnerTexts().then((a) => a.map((s) => s.trim()));
const frameSrc = (p: Page) => p.locator('#dashboardFrame').getAttribute('src');

async function logoff(p: Page) {
  await p.click('#logoffBtnA');
  await p.locator('#userIDInput').waitFor();
}

test('New web menu - dashboards: management, links, precedence, selection', async ({ page, browser }) => {
  test.setTimeout(600_000);
  const ctx = await browser.newContext();
  const op = await ctx.newPage();
  try {
    await loginNew(page);

    await test.step('Dashboards Management: dialog fields, defaults, validation (F.5.1, F.5.3, F.5.4)', async () => {
      const f = await openSettings(page, 'Dashboards Management');
      expect((await du.rows(f)).some((r) => r.includes(DEFAULT))).toBe(true);
      const d = await du.openFormDialog(f, 'add');
      const labels = (await d.locator('td.CaptionTD').allInnerTexts()).filter(Boolean);
      expect(labels.slice(0, 5)).toEqual(['Name', 'SourceURL', 'PlaceholderURLForIE', 'IECompatible', 'Active']);
      expect(await d.locator('#IECompatible').inputValue()).toBe('Y');
      expect(await d.locator('#Active').inputValue()).toBe('Y');
      expect((await d.locator('#IECompatible option').allInnerTexts()).sort()).toEqual(['N', 'Y']);
      await du.submitForm(f);
      expect(await du.formError(f)).toContain('Name: Field is required');
      await d.locator('#Name').fill('x');
      await du.submitForm(f);
      expect(await du.formError(f)).toContain('SourceURL: Field is required');
      await du.cancelForm(f);
      // F.5.3 the page offers Add / Edit / View / Delete, search, saved filters, page size; Excel import / export are off in the definition
      for (const icon of ['add', 'edit', 'view', 'del']) await expect(f.locator(`#${icon}_grdJqGrid`)).toHaveCount(1);
      await f.click('#drpMainActions');
      const actions = (await f.locator('#drpMainActions ~ * a, .actionsMenu a, .ui-menu-item:visible').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      console.log('Actions menu:', actions.join(' | '));
      await page.keyboard.press('Escape');
      await closeModuleTab(page, 'Dashboards Management');
    });

    await test.step('Create dashboards and links (F.5.4, F.5.5, F.5.7, F.5.8)', async () => {
      let f = await openSettings(page, 'Dashboards Management');
      await addRow(f, { Name: DA, SourceURL: url('A') });
      await addRow(f, { Name: DB, SourceURL: url('B'), PlaceholderURLForIE: url('Bie'), IECompatible: 'N' });
      await addRow(f, { Name: DI, SourceURL: url('I'), Active: 'N' });
      await du.retrieve(page, f, 'Name', 'Contains', stamp);
      const rows = await du.rows(f);
      console.log('dashboard rows:', rows.join(' || '));
      expect(rows.length).toBe(3);
      // the name is the key: a second dashboard with the same name is refused
      const d = await du.openFormDialog(f, 'add');
      await d.locator('#Name').fill(DA);
      await d.locator('#SourceURL').fill(url('dup'));
      await du.submitForm(f);
      console.log('duplicate name message:', await du.formError(f));
      expect(await du.formError(f)).not.toBe('');
      await du.cancelForm(f);
      await closeModuleTab(page, 'Dashboards Management');

      f = await openSettings(page, 'Dashboards Link Management');
      const dl = await du.openFormDialog(f, 'add');
      const names = await dl.locator('#DashboardName option').allInnerTexts();
      expect(names).toEqual(expect.arrayContaining([DEFAULT, DA, DB]));
      expect(names).not.toContain(DI); // only ACTIVE dashboards can be linked
      expect(await dl.locator('#Active').inputValue()).toBe('Y');
      expect((await dl.locator('#UserID option').allInnerTexts())[0]).toBe('*');
      expect((await dl.locator('#GroupID option').allInnerTexts())[0]).toBe('*');
      expect((await dl.locator('#PrintEntity option').allInnerTexts())).toContain('*');
      await du.cancelForm(f);
      await addRow(f, { UserID: OP, GroupID: '*', PrintEntity: '*', DashboardName: DA });
      await addRow(f, { UserID: '*', GroupID: 'CLPRGrp', PrintEntity: '*', DashboardName: DB });
      await du.retrieve(page, f, 'UserID', 'Is Not Blank', '');
      const links = (await du.rows(f)).filter((r) => r.includes(stamp));
      console.log('link rows:', links.join(' || '));
      expect(links.length).toBe(2);
      await closeModuleTab(page, 'Dashboards Link Management');
    });

    await test.step('A user who is linked to several dashboards gets a drop-down in precedence order and the first one loads (F.5.12, F.5.10)', async () => {
      await loginNew(op, OP, PASSWORD);
      await expect(op.locator('#dashSelectID')).toHaveCount(1);
      const opts = await dashOptions(op);
      console.log('dashboards of', OP, ':', opts.join(' | '));
      // user link (A) before group link (B) before the '*' default
      expect(opts).toEqual([DA, DB, DEFAULT]);
      expect(await frameSrc(op)).toBe(url('A'));
      await expect(op.locator('#dashboardFrame')).not.toHaveClass(/hidden/);
      // only one dashboard is displayed at a time: pick B
      await op.locator('#dashSelectID').selectOption({ label: DB });
      await expect.poll(() => frameSrc(op), { timeout: 10_000 }).toBe(url('B'));
      const after = await dashOptions(op);
      expect(after[0]).toBe(DB); // the picked one moves to the top (and is remembered for the next login)
      await logoff(op);
      await loginNew(op, OP, PASSWORD);
      expect((await dashOptions(op))[0]).toBe(DB);
      expect(await frameSrc(op)).toBe(url('B'));
    });

    await test.step('The seed user is linked to the default dashboard only: no drop-down (F.5.9, F.5.11)', async () => {
      await expect(page.locator('#dashSelectID')).toHaveCount(0);
      await expect(page.locator('#dashboardA')).toHaveText(DEFAULT);
      expect(await frameSrc(page)).toContain('app.powerbi.com');
    });

    await test.step('Dashboard link opens the dashboard again after a module tab (F.5.10)', async () => {
      await openModuleNew(op, 'Prompt Samples');
      await expect(op.locator('#dashboardFrame')).toHaveClass(/hidden/);
      await op.locator('#dashboardLink').click({ position: { x: 5, y: 5 } }).catch(() => {});
      // a drop-down is covered by `#dashboardSelectCoverDiv`, which switches back to the dashboard
      await op.locator('#dashboardSelectCoverDiv').click({ timeout: 5000 }).catch(() => {});
      await expect(op.locator('#dashboardFrame')).not.toHaveClass(/hidden/);
      await closeModuleTab(op, 'Prompt Samples');
    });

    await test.step('Inactive links and inactive dashboards are not shown (F.5.4 Active flag)', async () => {
      let f = await openSettings(page, 'Dashboards Link Management');
      await du.retrieve(page, f, 'UserID', 'Is Not Blank', '');
      await du.selectGridRow(f, DA);
      let d = await du.openFormDialog(f, 'edit');
      await d.locator('#Active').selectOption({ label: 'N' });
      await du.submitForm(f);
      expect(await du.formError(f)).toBe('');
      await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
      await closeModuleTab(page, 'Dashboards Link Management');
      await op.reload();
      await op.waitForSelector('#moduleDialogToggle');
      expect(await dashOptions(op)).toEqual([DB, DEFAULT]);

      f = await openSettings(page, 'Dashboards Management');
      await du.retrieve(page, f, 'Name', 'Contains', stamp);
      await du.selectGridRow(f, DB);
      d = await du.openFormDialog(f, 'edit');
      await d.locator('#Active').selectOption({ label: 'N' });
      await du.submitForm(f);
      await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
      await closeModuleTab(page, 'Dashboards Management');
      await op.reload();
      await op.waitForSelector('#moduleDialogToggle');
      expect(await op.locator('#dashSelectID').count()).toBe(0); // only the default is left: single dashboard, no drop-down
      await expect(op.locator('#dashboardA')).toHaveText(DEFAULT);
      expect(await frameSrc(op)).toContain('app.powerbi.com');
      console.log('after the user\'s remembered dashboard became inactive the default one is shown');
    });
  } finally {
    try {
      await closeAllTabs(page);
      let f = await openSettings(page, 'Dashboards Link Management');
      await du.retrieve(page, f, 'UserID', 'Is Not Blank', '', { expectRows: false });
      console.log('cleanup: links deleted', await deleteMatching(f, stamp));
      await closeModuleTab(page, 'Dashboards Link Management');
      f = await openSettings(page, 'Dashboards Management');
      await du.retrieve(page, f, 'Name', 'Contains', stamp, { expectRows: false });
      console.log('cleanup: dashboards deleted', await deleteMatching(f, stamp));
      await closeModuleTab(page, 'Dashboards Management');
    } catch (e) {
      console.log('CLEANUP FAILED (delete the CLDash*' + stamp + ' dashboards and their links by hand):', String(e).slice(0, 300));
    }
    await ctx.close();
  }
});

void deviation;
