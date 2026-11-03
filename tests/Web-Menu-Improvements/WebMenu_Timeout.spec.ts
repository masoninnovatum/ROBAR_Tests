// New web menu - inactivity timeout: WebTimeoutInMinutes (Global Setting, owner Innovatum.WebMenu), the 60-second countdown, activity cancels it, "Timed out due to inactivity".
// Requirements (docs/agents/valmaster-web-menu-improvements.md): U.8, F.8.1, F.8.2, F.8.3 (+ F.11.1 PageTitle value).
// Confirmed live 2026-11-02 on TST703. Source: MainMenuLayout.cshtml - the page keeps a cookie `InnoSession_PageTimeout` (= now + WebTimeoutInMinutes) that RefreshTimeout() resets on every
// mousemove over #webMenuBody; CheckTimeout() runs every 3 s: <= 60 s left shows #timeoutWarningDiv (countdown `#timeoutTimeLeft`), <= 0 (or a changed `InnoSession_CurrentUser` cookie) submits
// the hidden form to Account/TimedOut, which logs a Timeout Activity record and redirects to the login page with errorKey errTimedOut = "Timed out due to inactivity".
// The spec does NOT wait the real timeout and does NOT touch the Global Setting (settings are the user's): it moves the cookie, which is what the page itself uses.
// Fixture user CLPROp01 (seed password) does the timing; the seed user only reads the Global Settings.

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import * as du from '../support/dynamic-ui';
import { PASSWORD, USERNAME } from '../support/robar';
import { loginNew, openModuleNew, moduleFrame, closeModuleTab } from '../support/new-web-menu';
import { OP } from '../Password-Management/pr-fixtures';
import { deviation } from './wm-helpers';

test.use({ actionTimeout: 20_000 });

/** Reads a Global Setting from Global Settings Management on the new menu (read only). */
async function readSetting(page: Page, name: string, owner: string): Promise<string | undefined> {
  await openModuleNew(page, 'Global Settings Management');
  const f = await moduleFrame(page, 'DynamicUI');
  await f.locator('#btnRetrieveData').waitFor();
  await page.waitForTimeout(2500);
  await du.clearCriteria(page, f);
  await du.retrieve(page, f, 'SettingName', 'Exactly Matches', name, { expectRows: false });
  await page.waitForTimeout(4000);
  const rows = await du.rows(f);
  await closeModuleTab(page, 'Global Settings Management');
  // a row reads "<SettingName> <Value> <ValueEncrypted> <LastTouch> <SettingOwner>"; the value may contain blanks
  for (const r of rows) {
    const m = r.match(new RegExp('^' + name + ' (.*?) ?(True|False) \\d+/\\d+/\\d{4} ' + owner.replace(/\./g, '\\.') + '$'));
    if (m) return m[1];
  }
  return undefined;
}

const cookieValue = (p: Page, name: string) => p.evaluate((n) => (document.cookie.split('; ').find((c) => c.startsWith(n + '=')) ?? '').split('=').slice(1).join('='), name);
const setTimeoutIn = (p: Page, seconds: number) => p.evaluate((s) => { document.cookie = 'InnoSession_PageTimeout=' + new Date(Date.now() + s * 1000).toUTCString() + '; path=/'; }, seconds);

test('New web menu - inactivity timeout and countdown', async ({ page, browser }) => {
  test.setTimeout(300_000);
  const ctx = await browser.newContext();
  const op = await ctx.newPage();
  try {
    let minutes = 0;
    await test.step('Global Settings of the new menu (F.8.1, F.11.1)', async () => {
      await loginNew(page);
      const timeout = await readSetting(page, 'WebTimeoutInMinutes', 'Innovatum.WebMenu');
      const title = await readSetting(page, 'PageTitle', 'Innovatum.WebMenu');
      console.log('WebTimeoutInMinutes =', timeout, '| PageTitle =', title);
      expect(timeout).toBeDefined();
      minutes = Number(timeout);
      expect(title).toBe('ROBAR Web Menu');
      // F.8.1 "By default this value will be set to 30": the install seed (GlobalSettingsDefaultRecords.cs) and the code default (WebMenuGlobalSettings.cs) are both 60; TST703 is configured to 5
      deviation(`F.8.1 default of WebTimeoutInMinutes: requirement 30, install seed and code default 60 (source, 20320); TST703 is configured to ${minutes}`);
    });

    await test.step('The timeout cookie follows the setting', async () => {
      await loginNew(op, OP, PASSWORD);
      const left = async () => (new Date(decodeURIComponent(await cookieValue(op, 'InnoSession_PageTimeout'))).getTime() - Date.now()) / 1000;
      console.log('seconds until timeout the moment the main menu is up:', Math.round(await left()));
      // the page script (window.onload -> RefreshTimeout) writes the cookie from WebTimeoutInMinutes; a cookie set earlier by the server can be read for a moment before that
      await expect.poll(async () => Math.abs((await left()) - minutes * 60), { timeout: 15_000 }).toBeLessThan(120);
    });

    await test.step('60 seconds before the end an inactivity countdown is shown (F.8.2)', async () => {
      await expect(op.locator('#timeoutWarningDiv')).toHaveClass(/hidden/);
      await setTimeoutIn(op, 45);
      await expect(op.locator('#timeoutWarningDiv')).not.toHaveClass(/hidden/, { timeout: 8000 });
      await expect(op.locator('#timeoutWarningDiv')).toContainText('Timeout Approaching');
      const first = Number((await op.locator('#timeoutTimeLeft').innerText()).trim());
      await op.waitForTimeout(3000);
      const second = Number((await op.locator('#timeoutTimeLeft').innerText()).trim());
      console.log('countdown readings:', first, '->', second);
      expect(first).toBeLessThanOrEqual(45);
      expect(second).toBeLessThan(first);
      await expect(op.locator('#timeoutCountdownBackground')).not.toHaveClass(/hidden/);
    });

    await test.step('Any activity during the countdown keeps the session (F.8.3)', async () => {
      await op.mouse.move(400, 300);
      await op.mouse.move(420, 320);
      await expect(op.locator('#timeoutWarningDiv')).toHaveClass(/hidden/, { timeout: 5000 });
      const secondsLeft = (new Date(decodeURIComponent(await cookieValue(op, 'InnoSession_PageTimeout'))).getTime() - Date.now()) / 1000;
      expect(secondsLeft).toBeGreaterThan(minutes * 60 - 120);
      await expect(op.locator('#moduleDialogToggle')).toBeVisible();
    });

    await test.step('Without activity the user is logged out with "Timed out due to inactivity" (F.8.3)', async () => {
      await setTimeoutIn(op, 6);
      await expect(op.locator('#userIDInput')).toBeVisible({ timeout: 30_000 });
      await expect(op.locator('.text-danger')).toHaveText('Timed out due to inactivity');
      expect(op.url()).toMatch(/\/ROBAR\/\?errorKey=errTimedOut/i);
    });

    await test.step('After the timeout the main menu cannot be re-entered by URL', async () => {
      const direct = await op.goto(new URL(op.url()).origin + '/ROBAR/WebMenu/MainMenu');
      const status = direct?.status();
      const back = await op.locator('#moduleDialogToggle').count();
      console.log('direct main menu URL after the timeout: HTTP', status, '| main menu shown:', back);
      if (back) deviation('U.8 after an inactivity timeout the server session is NOT ended (AccountController.PerformLogoffTasks skips currentSession.Logout() when timedOut = true), so the main menu can be opened again by URL without logging in');
      else expect(status).toBe(401);
    });

    await test.step('Logging in as another user in the same browser times out the older tab', async () => {
      // (a hand-edited InnoSession_CurrentUser cookie only produces an IIS "Runtime Error": the cookie is decrypted server side; so a real second login is used)
      await page.click('#logoffBtnA'); // the seed user ends its own session first: never two sessions of one account at once
      await page.locator('#userIDInput').waitFor();
      await loginNew(op, OP, PASSWORD);
      const other = await op.context().newPage();
      await loginNew(other, USERNAME, PASSWORD);
      await expect(op.locator('#userIDInput')).toBeVisible({ timeout: 20_000 });
      await expect(op.locator('.text-danger')).toHaveText('Timed out due to inactivity');
      await other.click('#logoffBtnA');
    });
  } finally {
    await ctx.close();
  }
});
