// Execution of UAT_6512 (DIT #6512): Security Management must enforce PasswordMinLength / PasswordNeedsLetters / PasswordNeedsNumbers when a new user is added.
// Run HEADED (evidence = OS-level desktop screenshots so the address bar / environment is visible). Prereq: PasswordMinLength 5, NeedsLetters Y, NeedsNumbers Y (user-set, restart done).
import { test, expect } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { readGlobalSetting } from '../support/global-settings';
import * as sec from '../support/security';
import { Admin, SRV } from '../Login-Password/pw-helpers';

test.use({ actionTimeout: 20_000 });

const SHOTS = String.raw`C:\Users\Mason\AppData\Local\Temp\claude\C--DB-Copies-703-20198\a480f2e1-948d-42ae-aee0-d197f8c859fc\scratchpad\uat6512_exec`;

function shot(n: number): string {
  const p = path.join(SHOTS, `step_${String(n).padStart(2, '0')}.png`);
  execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/screenshot-desktop.ps1'), '-Path', p]);
  return p;
}

test('UAT 6512 execution', async ({ page }) => {
  test.setTimeout(900_000);
  fs.mkdirSync(SHOTS, { recursive: true });
  const stamp = Date.now().toString().slice(-6);
  const admin = new Admin(page);
  await admin.open();
  const vals: Record<string, string | undefined> = {};
  for (const n of ['PasswordMinLength', 'PasswordNeedsLetters', 'PasswordNeedsNumbers']) vals[n] = await readGlobalSetting(page, n, 'LegacySettings');
  console.log('SETTINGS ' + JSON.stringify(vals));
  expect(vals).toEqual({ PasswordMinLength: '5', PasswordNeedsLetters: 'Y', PasswordNeedsNumbers: 'Y' });

  const results: any[] = [];
  const attempt = async (n: number, id: string, pw: string) => {
    if (!page.url().toLowerCase().includes('innovatum/webmenu/mainmenu')) await page.goto(SRV + 'Innovatum/WebMenu/MainMenu.aspx');
    let f = await sec.reopenSecurity(page);
    await sec.setView(f, 'USER');
    const d = await sec.openDialog(f, 'user', 'add');
    await d.locator('#users_input_userid').fill(id);
    await d.locator('#users_input_fullname').fill(`UAT 6512 ${id}`);
    await d.locator('#users_input_timezone').selectOption({ label: '[+00.00] Greenwich Mean Time' }, { timeout: 5000 });
    await d.locator('#users_input_group').selectOption({ label: 'MBPWLoginGrp' }, { timeout: 5000 });
    await d.locator('#users_input_password').fill(pw);
    await d.locator('#users_input_confirmpassword').fill(pw);
    await d.locator('#users_input_resetpassword').uncheck();
    await sec.submitDialog(f);
    await page.waitForTimeout(2500);
    const messages = await sec.dialogMessages(f).catch(() => [] as string[]);
    const stillOpen = await f.locator('#addEditUserDialog').isVisible().catch(() => false);
    if (!stillOpen) { // success: show the new user in the grid
      f = await sec.refreshFrame(page);
      await sec.filterUsers(f, 'USERID', id);
      await page.waitForTimeout(1500);
    }
    const file = shot(n);
    results.push({ step: n, id, pw, stillOpen, messages, file });
    console.log(`STEP ${n}: ${JSON.stringify({ id, pw, stillOpen, messages })}`);
    if (stillOpen) await sec.cancelDialog(f).catch(() => {});
    return { stillOpen, messages };
  };

  // Step 1: Security Management, Users view
  await page.goto(SRV + 'Innovatum/WebMenu/MainMenu.aspx');
  const f1 = await sec.reopenSecurity(page);
  await sec.setView(f1, 'USER');
  await page.waitForTimeout(1500);
  shot(1);

  const r2 = await attempt(2, `MB6512A${stamp}`, 'a1b2');
  expect(r2.stillOpen).toBe(true);
  const r3 = await attempt(3, `MB6512B${stamp}`, '12345678');
  expect(r3.stillOpen).toBe(true);
  const r4 = await attempt(4, `MB6512C${stamp}`, 'abcdefgh');
  expect(r4.stillOpen).toBe(true);
  const r5 = await attempt(5, `MB6512D${stamp}`, 'abc12345');
  expect(r5.stillOpen).toBe(false);

  fs.writeFileSync('test-data/uat6512-results.json', JSON.stringify({ stamp, vals, results }, null, 2));
});
