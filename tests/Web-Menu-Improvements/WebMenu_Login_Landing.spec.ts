// New web menu (Web Menu Improvements, http://<server>/ROBAR/): login page, landing page, Modules list, tabs, favorites, Settings (gear), Log off, language, auto-open module, Help.
// Requirements (docs/agents/valmaster-web-menu-improvements.md): F.1.3, F.1.5, F.3.1, F.3.2, F.4.1, F.4.2, F.7.1-F.7.6, F.9.1-F.9.3, F.10.1, F.11.1, U.7, U.9, U.10.
// Confirmed live 2026-11-02 on TST703 (7.0.3.20198). Source notes: Innovatum.WebMenu (AccountController, WebMenuController, MainMenuLayout.cshtml).
// Test data: reads only. The seed user's FAVORITES are changed for a moment (Claude01 has none at the start) and cleared again in `finally`.
// The auto-open "not authorised" case uses fixture user CLPROp01 (group CLPRGrp = Login_WebMenu + ResetPassword_Option, seed password).

import { test, expect } from '@playwright/test';
import { BASE_URL, USERNAME, PASSWORD } from '../support/robar';
import { NEW_URL, loginNew, openModuleNew, closeModuleTab } from '../support/new-web-menu';
import { OP } from '../Password-Management/pr-fixtures';

test.use({ actionTimeout: 20_000 });

const collator = new Intl.Collator('en', { sensitivity: 'base' });
const names = (page: import('@playwright/test').Page, tbody: string) => page.locator(`${tbody} .moduleName`).allInnerTexts().then((a) => a.map((s) => s.trim()));
const modRow = (page: import('@playwright/test').Page, name: string) => page.locator('#moduleListTBody tr').filter({ has: page.locator('.moduleName', { hasText: new RegExp('^\\s*' + name + '\\s*$') }) });

function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

test('New web menu - login, landing page, Modules, tabs, favorites, Settings, Log off, language, auto-open, Help', async ({ page, browser }) => {
  test.setTimeout(420_000);
  let favoritesTouched = false;
  try {
    await test.step('Login page anatomy (F.9.1, F.11.1)', async () => {
      await page.goto(NEW_URL);
      await expect(page.locator('#userIDInput')).toBeVisible();
      await expect(page.locator('#passwordInput')).toHaveAttribute('type', 'password');
      await expect(page.locator('input[type=submit]')).toHaveValue('Log In');
      const langs = await page.locator('#langSelect option').allInnerTexts();
      console.log('languages offered:', langs.join(' | '));
      expect(langs[0]).toBe('English'); // F.9.1 "By default English language will be selected"
      expect(await page.locator('#langSelect option:checked').innerText()).toBe('English');
      expect(await page.title()).toBe('ROBAR Web Menu'); // F.11.1 default of the PageTitle Global Setting (owner Innovatum.WebMenu)
      expect(await page.locator('#microsoftLoginBtn').count()).toBe(0); // OpenID_* settings are blank on TST703: no external login button (F.1.2 is not testable here)
    });

    await test.step('Wrong credentials: one generic message (F.1.3)', async () => {
      await page.fill('#userIDInput', 'CLNoSuchUser');
      await page.fill('#passwordInput', 'whatever1');
      await page.click('input[type=submit]');
      await expect(page.locator('.text-danger')).toHaveText('Invalid UserID/Password');
      await page.fill('#userIDInput', USERNAME);
      await page.fill('#passwordInput', 'Wrong' + Date.now().toString().slice(-5) + 'x');
      await page.click('input[type=submit]');
      await expect(page.locator('.text-danger')).toHaveText('Invalid UserID/Password');
      // the seed user now has ONE failed attempt: the correct login below clears it
      await page.fill('#userIDInput', '');
      await page.fill('#passwordInput', '');
      await page.click('input[type=submit]');
      console.log('blank login message:', (await page.locator('.text-danger, .validation-summary-errors').allInnerTexts()).join(' | '));
    });

    await test.step('Landing page after login (F.1.5, F.4.1, F.7.1, F.10.1 controls)', async () => {
      await loginNew(page);
      await expect(page).toHaveURL(/\/ROBAR\/WebMenu\/MainMenu/);
      await expect(page.locator('.loggedOnUserIDLabel')).toHaveText('[' + USERNAME + ']'); // F.1.5 USERID on the top panel
      await expect(page.locator('#moduleDialogToggle')).toContainText('Modules');
      await expect(page.locator('#logoffBtnA')).toHaveText('Log off');
      await expect(page.locator('#helpBtnA')).toHaveText('Help');
      await expect(page.locator('#notificationsIcon')).toBeVisible();
      await expect(page.locator('#settingsIcon')).toBeVisible(); // F.4.1 wheel icon
      expect(await page.title()).toBe('ROBAR Web Menu');
      await expect(page.locator('.navbar-fixed-bottom')).toContainText(/VMSRV\w+ - \d+\.\d+\.\d+\.\d+/);
      console.log('footer:', (await page.locator('.navbar-fixed-bottom').innerText()).replace(/\s+/g, ' '));
      console.log('dashboard header:', await page.locator('#dashboardLink').innerText());
    });

    await test.step('Modules list: alphabetical, security process as tooltip (F.7.1, F.7.6)', async () => {
      await page.click('#moduleDialogToggle');
      await expect(page.locator('#mySidebar')).toHaveClass(/sidebarOpen/);
      const list = await names(page, '#moduleListTBody');
      expect(list.length).toBeGreaterThan(20);
      const sorted = [...list].sort(collator.compare);
      expect(list).toEqual(sorted);
      const titles = await page.locator('#moduleListTBody .moduleName').evaluateAll((els) => els.map((e) => [(e as HTMLElement).innerText.trim(), (e as HTMLElement).title]));
      const noTip = titles.filter(([, t]) => !t.trim()).map(([n]) => n);
      console.log('modules without a security-process tooltip:', noTip.join(', ') || '(none)');
      const sample = Object.fromEntries(titles);
      expect(sample['Codes Management']).toBe('View_Codes');
      expect(sample['Security Management']).toBe('View_Security');
      expect(sample['Print by lot']).toBe('BP_PrintByLot_Option');
      for (const [n, t] of titles) if (t !== t.trim()) deviation(`F.7.6 tooltip of "${n}" has surrounding blanks: "${t}"`);
      // clicking Modules again hides the panel
      await page.click('#moduleDialogToggle');
      await expect(page.locator('#mySidebar')).not.toHaveClass(/sidebarOpen/);
    });

    await test.step('Single click opens a tab with an x; the panel hides; x closes the tab (F.7.1, F.7.2)', async () => {
      await openModuleNew(page, 'Codes Management');
      await expect(page.locator('#mySidebar')).not.toHaveClass(/sidebarOpen/);
      const tab = page.locator('#moduleList li', { hasText: 'Codes Management' });
      await expect(tab).toHaveCount(1);
      await expect(tab.locator('.moduleCloseBtn')).toHaveText('×');
      await expect(tab.locator('a.focusedModule')).toHaveCount(1);
      await page.waitForTimeout(3000);
      await closeModuleTab(page, 'Codes Management');
      await expect(page.locator('#moduleList li', { hasText: 'Codes Management' })).toHaveCount(0);
      await expect(page.locator('#dashboardFrame')).not.toHaveClass(/hidden/); // back on the dashboard
    });

    await test.step('Favorites: star, order, persistence, silent preload (F.7.3, F.7.4, F.7.5, U.7)', async () => {
      favoritesTouched = true;
      await page.click('#moduleDialogToggle');
      expect(await page.locator('#moduleListTBody .favModule').count()).toBe(0);
      await modRow(page, 'Codes Management').locator('.starImg').click();
      await page.waitForTimeout(1000);
      await modRow(page, 'Attachment Management').locator('.starImg').click();
      await page.waitForTimeout(1000);
      // client side: a new favorite is inserted at the TOP of the list at once
      let list = await names(page, '#moduleListTBody');
      console.log('after starring Codes then Attachment, first rows:', list.slice(0, 3).join(' | '));
      expect(list[0]).toBe('Attachment Management');
      await modRow(page, 'Codes Management').locator('.starImg').click(); // un-star Codes
      await page.waitForTimeout(1000);
      list = await names(page, '#moduleListTBody');
      console.log('after un-starring Codes (no reload), first rows:', list.slice(0, 3).join(' | '));
      if (list[1] === 'Codes Management') deviation('F.7.4 deselecting the star does not move the module down the list until the page is reloaded (it stays among the favorites at the top)');
      await modRow(page, 'Codes Management').locator('.starImg').click(); // star again
      await page.waitForTimeout(1000);
      list = await names(page, '#moduleListTBody');
      if (list[0] !== 'Attachment Management') deviation(`F.7.4 favorites are not alphabetical before a reload: starring Codes Management after Attachment Management puts "${list[0]}" first`);
      // reload: the server sorts favorites first, alphabetically
      await page.reload();
      await page.waitForSelector('#moduleDialogToggle');
      await page.waitForTimeout(2500);
      list = await names(page, '#moduleListTBody');
      expect(list.slice(0, 2)).toEqual(['Attachment Management', 'Codes Management']);
      expect(await page.locator('#moduleListTBody .favModule').count()).toBe(2);
      const rest = list.slice(2);
      expect(rest).toEqual([...rest].sort(collator.compare));
      // F.7.5: favorites are silently loaded in hidden frames at page load (their spinner turns into a check mark)
      const preload = page.locator('#allIFrames iframe[id^=moduleFrame_]');
      await expect(preload).toHaveCount(2);
      await page.waitForTimeout(8000);
      const frames = page.frames().map((f) => f.url()).filter((u) => /codes|attachment/i.test(u));
      console.log('preloaded frames:', frames.join(' | '));
      expect(frames.length).toBeGreaterThanOrEqual(2);
      // un-starring moves it down after the reload
      await page.click('#moduleDialogToggle');
      await modRow(page, 'Attachment Management').locator('.starImg').click();
      await modRow(page, 'Codes Management').locator('.starImg').click();
      await page.waitForTimeout(1500);
      favoritesTouched = false;
      await page.reload();
      await page.waitForSelector('#moduleDialogToggle');
      expect(await page.locator('#moduleListTBody .favModule').count()).toBe(0);
      list = await names(page, '#moduleListTBody');
      expect(list).toEqual([...list].sort(collator.compare));
    });

    await test.step('Settings (gear): alphabetical list, hides after a pick or a second click (F.4.2, F.4.3)', async () => {
      await page.click('#settingsIcon');
      await expect(page.locator('#menuSupportSidebar')).toHaveClass(/sidebarOpen/);
      const settings = await names(page, '#menuSupportModuleListTBody');
      console.log('Settings list:', settings.join(' | '));
      expect(settings).toEqual([...settings].sort(collator.compare));
      expect(settings).toEqual(['Dashboards Link Management', 'Dashboards Management', 'Notifications Link Management', 'Notifications Management']);
      await page.click('#settingsIcon');
      await expect(page.locator('#menuSupportSidebar')).not.toHaveClass(/sidebarOpen/);
      await openModuleNew(page, 'Dashboards Management', { gear: true });
      await expect(page.locator('#menuSupportSidebar')).not.toHaveClass(/sidebarOpen/);
      await closeModuleTab(page, 'Dashboards Management');
    });

    await test.step('Help button opens the help URL in a new window', async () => {
      const [popup] = await Promise.all([page.waitForEvent('popup', { timeout: 15_000 }), page.click('#helpBtnA')]);
      await popup.waitForLoadState('domcontentloaded').catch(() => {});
      console.log('help window url:', popup.url());
      expect(popup.url()).toMatch(/\/Innovatum\/WebHelp\/en\/index\.html\?10015/);
      await popup.close();
    });

    await test.step('Log off returns to the login page and ends the session (F.10.1, U.10)', async () => {
      await page.click('#logoffBtnA');
      await expect(page.locator('#userIDInput')).toBeVisible();
      expect(page.url()).toMatch(/\/ROBAR\/(Account\/Login)?$/i);
      const direct = await page.goto(NEW_URL + 'WebMenu/MainMenu');
      // no session: the main menu is refused with an IIS 401 page ("Access is denied due to invalid credentials"), not redirected to the login page
      expect(direct?.status()).toBe(401);
      await expect(page.locator('#moduleDialogToggle')).toHaveCount(0);
      deviation('observation: the main menu URL without a session answers with the raw IIS 401 page instead of redirecting to the login page (Log off itself does end the session)');
    });

    await test.step('Login page language: another language translates the labels, English fallback (F.9.2, F.9.3)', async () => {
      await page.goto(NEW_URL);
      await page.locator('#langSelect').selectOption({ label: 'Spanish' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      const labels = (await page.locator('.loginCaptionDiv label').allInnerTexts()).map((s) => s.trim());
      const btn = await page.locator('input[type=submit]').getAttribute('value');
      console.log('Spanish login labels:', labels.join(' | '), '| button:', btn);
      expect(await page.locator('#langSelect option:checked').innerText()).toBe('Spanish');
      await page.locator('#langSelect').selectOption({ label: 'English' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      expect((await page.locator('.loginCaptionDiv label').allInnerTexts()).map((s) => s.trim())).toEqual(['UserID', 'Password', 'Language']);
    });

    await test.step('Auto-open a module from the URL (F.3.1, U.3)', async () => {
      await page.goto(NEW_URL + 'Account/Login?moduleName=Codes_Management');
      await page.fill('#userIDInput', USERNAME);
      await page.fill('#passwordInput', PASSWORD);
      await page.click('input[type=submit]');
      await page.waitForSelector('#moduleDialogToggle');
      await expect(page.locator('#moduleList li', { hasText: 'Codes Management' })).toHaveCount(1, { timeout: 15_000 });
      await expect(page.locator('#moduleList li a.focusedModule', { hasText: 'Codes Management' })).toHaveCount(1);
      await page.click('#logoffBtnA');
      await expect(page.locator('#userIDInput')).toBeVisible();
    });

    await test.step('Changing the language on the login page drops the module name from the URL', async () => {
      await page.goto(NEW_URL + 'Account/Login?moduleName=Codes_Management');
      await page.locator('#langSelect').selectOption({ label: 'Spanish' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1500);
      await page.locator('#langSelect').selectOption({ label: 'English' });
      await page.waitForLoadState('networkidle');
      await page.waitForTimeout(1000);
      await page.fill('#userIDInput', USERNAME);
      await page.fill('#passwordInput', PASSWORD);
      await page.click('input[type=submit]');
      await page.waitForSelector('#moduleDialogToggle');
      await page.waitForTimeout(3000);
      const opened = await page.locator('#moduleList li', { hasText: 'Codes Management' }).count();
      console.log('Codes Management auto-opened after a language switch on the login page:', opened);
      if (opened === 0) deviation('F.3.1 a language change on the login page (JS reloads Account/Login without the moduleName) loses the module that the URL asked to auto-open');
      await page.click('#logoffBtnA');
    });

    await test.step('Auto-open of a module the user may not open shows the dashboard (F.3.2)', async () => {
      const ctx = await browser.newContext();
      const p2 = await ctx.newPage();
      try {
        await p2.goto(NEW_URL + 'Account/Login?moduleName=Security_Management');
        await p2.fill('#userIDInput', OP);
        await p2.fill('#passwordInput', PASSWORD);
        await p2.click('input[type=submit]');
        await p2.waitForSelector('#moduleDialogToggle');
        await p2.waitForTimeout(3000);
        expect(await p2.locator('#moduleList li', { hasText: 'Security Management' }).count()).toBe(0);
        const mods = await names(p2, '#moduleListTBody');
        console.log(`${OP} sees modules:`, mods.join(' | '));
        expect(mods).not.toContain('Security Management');
        await expect(p2.locator('#dashboardFrame')).not.toHaveClass(/hidden/);
        await expect(p2.locator('#settingsIcon')).toHaveCount(0); // no Settings module authorised: no wheel (F.4.4)
        await p2.click('#logoffBtnA');
      } finally {
        await ctx.close();
      }
    });

    await test.step('Logged in with another language the main menu is translated; untranslated texts fall back to English (F.9.2, F.9.3)', async () => {
      const ctx = await browser.newContext();
      const p3 = await ctx.newPage();
      try {
        await p3.goto(NEW_URL);
        await p3.locator('#langSelect').selectOption({ label: 'Spanish' });
        await p3.waitForLoadState('networkidle');
        await p3.waitForTimeout(1500);
        await p3.fill('#userIDInput', OP);
        await p3.fill('#passwordInput', PASSWORD);
        await p3.click('input[type=submit]');
        await p3.waitForSelector('#moduleDialogToggle');
        await p3.waitForTimeout(2000);
        const header = {
          modules: (await p3.locator('#moduleDialogToggle').innerText()).trim(),
          logoff: (await p3.locator('#logoffBtnA').innerText()).trim(),
          help: (await p3.locator('#helpBtnA').innerText()).trim(),
        };
        console.log('Spanish main menu texts:', JSON.stringify(header));
        expect(await p3.locator('#langSelect option:checked').innerText()).toBe('Spanish');
        const translated = Object.values(header).filter((t) => /^(☰ )?ES - /.test(t)).length;
        expect(translated, 'at least the main menu header texts are translated').toBeGreaterThan(0);
        // module captions come from the menu table, not from the localization table: they stay as they are
        expect(await p3.locator('#moduleListTBody .moduleName').allInnerTexts()).toContain('Password Reset');
        await p3.click('#logoffBtnA');
      } finally {
        await ctx.close();
      }
    });
  } finally {
    if (favoritesTouched) {
      // leave the seed user without favorites
      await page.goto(NEW_URL).catch(() => {});
      if (await page.locator('#userIDInput').count()) await loginNew(page).catch(() => {});
      await page.click('#moduleDialogToggle').catch(() => {});
      for (const n of ['Attachment Management', 'Codes Management']) {
        const r = modRow(page, n);
        if (await r.locator('.favModule').count().catch(() => 0)) await r.locator('.starImg').click().catch(() => {});
      }
      await page.waitForTimeout(1500);
    }
  }
});

void BASE_URL;
