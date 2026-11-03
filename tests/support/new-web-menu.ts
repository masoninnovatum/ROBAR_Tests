// Helpers for the NEW web menu ("Web Menu Improvements", `http://<server>/ROBAR/`, project Innovatum.WebMenu): an alternate login + landing page
// (Dashboard, Notifications, Settings) for the same ROBAR system. Live-confirmed 2026-11-02 on TST703.
//
// Anatomy: login `#userIDInput` / `#passwordInput` / `#langSelect` / `input[type=submit]` ("Log In"), error `.text-danger`. Main menu `/ROBAR/WebMenu/MainMenu`: header `☰ Modules`
// (`#moduleDialogToggle`) opens the sidebar `#mySidebar` (rows `#moduleListTBody tr`, name `.moduleName` whose `title` = the security process, star `.starImg`, favorites carry
// `.favModule` and sort first); gear `#settingsIcon` opens `#menuSupportSidebar` (rows in `#menuSupportModuleListTBody`); bell `#notificationsIcon` loads `#notificationsDiv`;
// dashboards `#dashboardLink` (`#dashboardA` for one, `#dashSelectID` for several); open modules are header tabs `#moduleList li` (close `.moduleCloseBtn`) whose iframes sit in `#allIFrames`.
// Session timeout is a cookie `InnoSession_PageTimeout` refreshed on `mousemove` over `#webMenuBody`.

import type { Frame, Page } from '@playwright/test';
import { BASE_URL, USERNAME, PASSWORD } from './robar';

export const NEW_URL = new URL(BASE_URL).origin + '/ROBAR/';

/** Logs in on the new web menu. Resolves when the main menu is up (or the page shows an error / the expired-password page: check with `loginOutcome`). */
export async function loginNew(page: Page, user: string = USERNAME, password: string = PASSWORD): Promise<void> {
  await page.goto(NEW_URL);
  await page.locator('#userIDInput').waitFor({ timeout: 60_000 });
  await page.fill('#userIDInput', user);
  await page.fill('#passwordInput', password);
  await page.click('input[type=submit]');
  await page.waitForSelector('#moduleDialogToggle, .text-danger, #newPasswordInput', { timeout: 60_000 });
  if (await page.locator('#moduleDialogToggle').count()) await page.waitForTimeout(2000);
}

/** The frame (iframe URL substring) of an open module, polling for it. */
export async function moduleFrame(page: Page, urlIncludes: string, attempts = 40): Promise<Frame> {
  for (let i = 0; i < attempts; i++) {
    const f = page.frames().filter((x) => x.url().toLowerCase().includes(urlIncludes.toLowerCase())).pop();
    if (f) return f;
    await page.waitForTimeout(500);
  }
  throw new Error(`Frame containing "${urlIncludes}" never appeared`);
}

/** Opens a module from the Modules list (`gear: true` for the Settings list) and returns once its tab exists. */
export async function openModuleNew(page: Page, name: string, { gear = false }: { gear?: boolean } = {}): Promise<void> {
  const [toggle, sidebar, list] = gear
    ? ['#settingsIcon', '#menuSupportSidebar.sidebarOpen', '#menuSupportModuleListTBody']
    : ['#moduleDialogToggle', '#mySidebar.sidebarOpen', '#moduleListTBody'];
  if (!(await page.locator(sidebar).count())) await page.click(toggle);
  await page.locator(`${list} .moduleName`, { hasText: new RegExp('^\\s*' + name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*$') }).click();
  await page.locator('#moduleList li', { hasText: name }).first().waitFor({ timeout: 10_000 });
}

export async function closeModuleTab(page: Page, name: string): Promise<void> {
  await page.locator('#moduleList li', { hasText: name }).first().locator('.moduleCloseBtn').click({ timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(600);
}
