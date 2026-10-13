// Execution of UAT_6617 (DIT #6617): Flex Printing. When the Flex Printing screen opens, the cursor must already be in the first input field so a scanned
// work order / item number is typed straight into it without clicking first (worked before 7.0.3, regressed in the upgrade).
// HEADED (evidence = OS-level desktop screenshots with the address bar). Nothing is printed or saved; only text is typed into the first field and cleared.
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { login } from '../support/robar';
import * as bartender from '../support/bartender';
// eslint-disable-next-line @typescript-eslint/no-var-requires
const flaui = require('../../scripts/flaui_bridge.js');

test.use({ headless: false, actionTimeout: 20_000 });

const SHOTS = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6617_exec`;
const shot = (n: number): void => {
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/screenshot-desktop.ps1'), '-Path', path.join(SHOTS, `step_${String(n).padStart(2, '0')}.png`)]);
};

const FIRST = 'input[id$="customControl_txtItemNumber"]';

test('UAT 6617 execution', async ({ page }) => {
  test.setTimeout(300_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  await login(page);
  await page.waitForTimeout(2000);
  shot(1); // Main Menu with the Flex Printing tile

  let pid = 0;
  const openFlex = async () => {
    await page.locator('li.ui-tabs-tab:has-text("Flex Printing") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Flex Printing', exact: true }).click();
    await page.waitForTimeout(4000);
    pid = await bartender.resolveBrowserPid(page);
    // Chrome asks "Open SentinelLauncher?" when the print screen opens (the user clicks Open SentinelLauncher); confirm it like a user would
    await bartender.confirmSentinelLaunchPrompt(page, pid).catch(() => {});
    await page.waitForTimeout(3000);
    return page.frames().find((x) => /PrintScreen\.aspx\?ConfigName=FlexPrinting/i.test(x.url()))!;
  };
  const state = async (f: import('@playwright/test').Frame) => f.evaluate(() => {
    const a = document.activeElement as HTMLInputElement | null;
    const inputs = [...document.querySelectorAll('input[type=text]')] as HTMLInputElement[];
    return { activeId: a?.id ?? null, activeIndex: a ? inputs.indexOf(a) : -1, activeValue: a?.value ?? null, hasFocus: document.hasFocus() };
  });

  // Step 1 / 2: open Flex Printing, no click
  let f = await openFlex();
  const s1 = await state(f);
  console.log('OPEN ' + JSON.stringify(s1));
  shot(2);

  // Step 3: type like a scanner, without clicking. CDP keystrokes do not reach the iframe, so real OS key presses are sent (VirtualKeyShort names) to the foreground browser window.
  await page.bringToFront();
  await page.waitForTimeout(800);
  await flaui.sendKeys({ keys: ['KEY_Z', 'KEY_Z', 'KEY_6', 'KEY_6', 'KEY_1', 'KEY_7'] });
  await page.waitForTimeout(600);
  const s2 = await state(f);
  console.log('TYPED ' + JSON.stringify(s2));
  shot(3);

  // Step 4: Reset, then reopen the screen from the Main Menu: cursor again in the first field
  await f.getByRole('button', { name: 'Reset' }).click().catch(() => f.locator('input[value="Reset"]').click());
  await page.waitForTimeout(2500);
  f = await openFlex();
  const s3 = await state(f);
  console.log('REOPEN ' + JSON.stringify(s3));
  shot(4);

  fs.writeFileSync(path.join(SHOTS, 'result.json'), JSON.stringify({ open: s1, typed: s2, reopen: s3 }, null, 2));
  expect.soft(s1.activeIndex, 'cursor already in the first input field when the screen opens').toBe(0);
  expect.soft(s2.activeValue, 'scanned text lands in the first field without a click').toBe('zz6617');
  expect.soft(s3.activeIndex, 'cursor in the first field again after reopening').toBe(0);
});
