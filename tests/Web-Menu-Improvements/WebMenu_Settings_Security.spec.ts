// New web menu - security gating of the Settings (gear) menu: each Settings module is gated by its own process; the wheel is absent when the user holds none of them.
// Requirements (docs/agents/valmaster-web-menu-improvements.md): U.4, F.4.1-F.4.4, F.5.1, F.5.5, F.6.1, F.6.6, F.7.6 (tooltip = security process).
// Confirmed live 2026-11-02 on TST703. Source: WebMenuController.MainMenu (modules the user may not open are skipped; Settings modules are the ones named in the app setting
// SettingsModule1..n), MenuWebIntegrationDefaultRecords.cs (processes Dashboards_Management, Dashboards_Link_Management, Notifications_Management, Notifications_Link_Management).
// Fixture operator CLPROp01 (group CLPRGrp = Login_WebMenu + ResetPassword_Option) logs in in a SECOND browser context after every group change (roles load at login); the seed user
// toggles CLPRGrp through the legacy Security Management (only CL* is ever written) and the group is restored in `finally`.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, login } from '../support/robar';
import * as sec from '../support/security';
import { loginNew } from '../support/new-web-menu';
import { OP, OP_GROUP, OP_PROCESSES } from '../Password-Management/pr-fixtures';
import { deviation } from './wm-helpers';

test.use({ actionTimeout: 20_000 });

const MODULES: Array<[string, string]> = [
  ['Dashboards Link Management', 'Dashboards_Link_Management'],
  ['Dashboards Management', 'Dashboards_Management'],
  ['Notifications Link Management', 'Notifications_Link_Management'],
  ['Notifications Management', 'Notifications_Management'],
];

/** DynamicUI Definition name of each Settings process (MenuWebIntegrationDefaultRecords.cs: "Heading=<process>&Definition=<name>"). */
const DEFINITION: Record<string, string> = {
  Dashboards_Link_Management: 'DashboardsLink',
  Dashboards_Management: 'Dashboards',
  Notifications_Link_Management: 'NotificationsLink',
  Notifications_Management: 'Notifications',
};

const collator = new Intl.Collator('en', { sensitivity: 'base' });
const settingsList = (p: Page) => p.locator('#menuSupportModuleListTBody .moduleName').evaluateAll((els) => els.map((e) => [(e as HTMLElement).innerText.trim(), (e as HTMLElement).title]));

test('New web menu - Settings menu security: one process per module, no wheel without any', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const setGroup = async (extra: string[]) => {
    await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx'));
    await sec.setGroupProcesses(page, OP_GROUP, [...OP_PROCESSES, ...extra]);
  };
  const asOperator = async (check: (p: Page) => Promise<void>) => {
    const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
    const p = await ctx.newPage();
    try {
      await loginNew(p, OP, PASSWORD);
      await check(p);
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('No Settings process: no wheel, Settings modules are not in the Modules list either (F.4.4)', async () => {
      await setGroup([]);
      await asOperator(async (p) => {
        await expect(p.locator('#settingsIcon')).toHaveCount(0);
        await expect(p.locator('#notificationsIcon')).toHaveCount(1); // the bell is always there (F.6.12)
        const mods = (await p.locator('#moduleListTBody .moduleName').allInnerTexts()).map((s) => s.trim());
        for (const [name] of MODULES) expect(mods).not.toContain(name);
        // direct request of a Settings page without the process: does the server refuse?
        const origin = new URL(p.url()).origin;
        for (const [, proc] of MODULES) {
          const r = await p.request.get(`${origin}/InnoPages/DynamicUI/DynamicUI?Heading=${proc}&Definition=${DEFINITION[proc]}`);
          const body = await r.text();
          console.log(`direct GET ${proc} without the process: HTTP ${r.status()}, grid page rendered: ${body.includes('btnRetrieveData')}`);
          if (r.status() === 200 && body.includes('btnRetrieveData')) deviation(`F.5.1/F.5.5/F.6.1/F.6.6 ${proc}: without the process the Dynamic UI page is still served when its URL is requested directly (the gear only hides the entry; the page has no server-side process check, as on the other Dynamic UI modules)`);
        }
      });
    });

    for (const [name, proc] of MODULES) {
      await test.step(`Only ${proc}: the wheel lists just "${name}" with the process as tooltip (F.4.3, F.4.4)`, async () => {
        await setGroup([proc]);
        await asOperator(async (p) => {
          await expect(p.locator('#settingsIcon')).toHaveCount(1);
          await p.click('#settingsIcon');
          const list = await settingsList(p);
          console.log(`${proc}:`, JSON.stringify(list));
          expect(list).toEqual([[name, proc]]);
          await p.locator('#menuSupportModuleListTBody .moduleName').click();
          await expect(p.locator('#moduleList li', { hasText: name })).toHaveCount(1);
          await p.waitForTimeout(4000);
          const frame = p.frames().find((f) => /DynamicUI/i.test(f.url()));
          expect(frame, 'the module page loaded').toBeTruthy();
          await expect(frame!.locator('#btnRetrieveData')).toBeVisible({ timeout: 20_000 });
        });
      });
    }

    await test.step('All four: alphabetical list (F.4.3)', async () => {
      await setGroup(MODULES.map(([, proc]) => proc));
      await asOperator(async (p) => {
        await p.click('#settingsIcon');
        const list = (await settingsList(p)).map(([n]) => n);
        expect(list).toEqual(MODULES.map(([n]) => n));
        expect(list).toEqual([...list].sort(collator.compare));
      });
    });
  } finally {
    try {
      await setGroup([]);
    } catch (e) {
      console.log('RESTORE FAILED: set group CLPRGrp back to Login_WebMenu + ResetPassword_Option in Security Management:', String(e).slice(0, 300));
    }
  }
});
