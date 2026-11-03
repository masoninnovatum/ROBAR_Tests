// New web menu - the Expired Password ("password reset") page shown at login. Requirements (docs/agents/valmaster-web-menu-improvements.md, formal script Web_Menu_Improvements-1.1):
// U.2, F.2.3-F.2.10 (F.2.1 PasswordChangeDays is a Global Setting and F.2.2 AD / SSO users are not testable here; the password-settings matrix of 2026-10-07/09 covered the settings).
// Confirmed live 2026-11-02 on TST703. Source: AccountController.Login (PasswordIsExpired -> ExpiredPassword view) and ExpiredPassword POST (order: confirm, min length, letters, numbers,
// reuse, old password, new != old). Page ids: #oldPasswordInput #newPasswordInput #confirmNewPasswordInput, Submit (input[type=submit]), Reset (#passwordResetResetBtn), message `.text-danger`.
// Test data: fixture user CLPRTgtA01 (Password-Management fixtures). The seed user does a TEMPORARY reset through the Password Reset module, which expires the password; every run ends with a
// NEW password stored in test-data/pr-fixture-passwords.json (PasswordDaysBeforeReuse forbids going back).

import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { PASSWORD, USERNAME, login } from '../support/robar';
import { NEW_URL, loginNew } from '../support/new-web-menu';
import { TGT_A, getPw, newPw, openReset, resetUser, savePw } from '../Password-Management/pr-fixtures';
import { deviation } from './wm-helpers';

test.use({ actionTimeout: 20_000 });

const msg = (p: Page) => p.locator('.text-danger').innerText().then((t) => t.trim());

async function submitExpired(p: Page, o: { old: string; nw: string; confirm?: string }): Promise<string> {
  await p.fill('#oldPasswordInput', o.old);
  await p.fill('#newPasswordInput', o.nw);
  await p.fill('#confirmNewPasswordInput', o.confirm ?? o.nw);
  await p.click('input[type=submit]');
  await p.waitForLoadState('networkidle');
  if (await p.locator('#moduleDialogToggle').count()) return 'MENU';
  return msg(p);
}

test('New web menu - Expired Password page (F.2.3-F.2.10)', async ({ page, browser }) => {
  test.setTimeout(420_000);
  const prev = getPw(TGT_A); // retired by the reset below, so it is a "used" password (reuse check)
  const pw0 = newPw();
  await login(page);
  let rules = { min: 5, letters: true, numbers: false };

  await test.step('Setup: the seed user resets CLPRTgtA01 temporarily (expires the password) and reads the live password rules', async () => {
    await openReset(page);
    rules = {
      min: Number(await page.locator('#minLength').inputValue()),
      letters: (await page.locator('#needsLetters').inputValue()) === 'true',
      numbers: (await page.locator('#needsNumbers').inputValue()) === 'true',
    };
    console.log('live password rules:', JSON.stringify(rules));
    const t = await resetUser(page, TGT_A, pw0, { temporary: true, sig: { user: USERNAME, pw: PASSWORD } });
    expect(t).toContain('Password reset successfully');
    savePw(TGT_A, pw0);
  });

  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  let current = pw0;
  try {
    await test.step('Login with an expired password shows the reset page: UserID, Old / New / Confirm, Submit and Reset, message (F.2.3)', async () => {
      await loginNew(p, TGT_A, pw0);
      await expect(p.locator('#oldPasswordInput')).toBeVisible();
      expect(await msg(p)).toBe('Your password has expired and must be reset');
      await expect(p.locator('#UserID')).toBeDisabled();
      await expect(p.locator('#UserID')).toHaveValue(TGT_A);
      const labels = (await p.locator('.loginCaptionDiv label').allInnerTexts()).map((s) => s.trim());
      expect(labels).toEqual(['UserID', 'Old Password', 'New Password', 'Confirm New Password']);
      await expect(p.locator('input[type=submit]')).toHaveValue('Submit');
      await expect(p.locator('#passwordResetResetBtn')).toHaveValue('Reset');
      expect(await p.title()).toBe('ROBAR Web Menu');
    });

    await test.step('Blank fields: Submit is not disabled; what happens on click (F.2.6)', async () => {
      const submit = p.locator('input[type=submit]');
      const disabledWhenBlank = await submit.isDisabled();
      await submit.click();
      await p.waitForTimeout(1500);
      const shown = (await p.locator('.text-danger, .field-validation-error, .validation-summary-errors').allInnerTexts()).map((s) => s.trim()).filter(Boolean);
      console.log('Submit disabled with blank fields:', disabledWhenBlank, '| messages after clicking it:', shown.join(' | '));
      if (!disabledWhenBlank) deviation('F.2.6 the Submit button is not disabled while UserID / Old / New / Confirm are blank (no script disables it); a click is answered by: ' + (shown.join(' | ') || 'no message'));
      await expect(p.locator('#oldPasswordInput')).toBeVisible();
    });

    await test.step('Messages in the order of the server checks (F.2.4, F.2.5, F.2.7, F.2.8)', async () => {
      const good = newPw();
      expect(await submitExpired(p, { old: pw0, nw: good, confirm: good + 'x' })).toBe('Passwords do not match'); // F.2.5, checked first
      if (rules.min > 1) expect(await submitExpired(p, { old: pw0, nw: 'a'.repeat(rules.min - 1) })).toBe(`Your new password must be at least ${rules.min} characters`); // F.2.7
      if (rules.letters) expect(await submitExpired(p, { old: pw0, nw: '1'.repeat(rules.min + 2) })).toBe('Your new password must contain letters');
      if (rules.numbers) expect(await submitExpired(p, { old: pw0, nw: 'a'.repeat(rules.min + 2) })).toBe('Your new password must contain numbers');
      if (prev && prev !== pw0) {
        const r = await submitExpired(p, { old: pw0, nw: prev });
        console.log('previously used password as the new one:', r);
        expect(r).toBe('That password cannot be reused at this time'); // F.2.8 PasswordDaysBeforeReuse
      }
      expect(await submitExpired(p, { old: 'Wrong' + Date.now().toString().slice(-5) + 'q', nw: good })).toBe('Old Password is incorrect'); // F.2.4
      expect(await submitExpired(p, { old: pw0, nw: pw0 })).toBe('New password must be different than the current password');
      await expect(p.locator('#UserID')).toHaveValue(TGT_A); // the page keeps the user through every refused attempt
    });

    await test.step('Reset button goes back to the login page and the password is not changed (F.2.10)', async () => {
      await p.click('#passwordResetResetBtn');
      await expect(p.locator('#userIDInput')).toBeVisible();
      expect(p.url()).toMatch(/\/ROBAR\/(Account\/Login)?$/i);
      await loginNew(p, TGT_A, pw0); // still pw0 and still expired
      await expect(p.locator('#oldPasswordInput')).toBeVisible();
    });

    await test.step('A valid new password is accepted: main menu, and the next login uses it (F.2.9, U.2)', async () => {
      const pw1 = newPw();
      expect(await submitExpired(p, { old: pw0, nw: pw1 })).toBe('MENU');
      await expect(p.locator('.loggedOnUserIDLabel')).toHaveText('[' + TGT_A + ']');
      current = pw1;
      savePw(TGT_A, pw1);
      await p.click('#logoffBtnA');
      await loginNew(p, TGT_A, pw1);
      await expect(p.locator('#moduleDialogToggle')).toBeVisible(); // not expired any more
      await p.click('#logoffBtnA');
      await p.goto(NEW_URL);
      await p.fill('#userIDInput', TGT_A);
      await p.fill('#passwordInput', pw0);
      await p.click('input[type=submit]');
      await expect(p.locator('.text-danger')).toHaveText('Invalid UserID/Password'); // the old password no longer works
      // a correct login clears the failed-attempt counter again
      await loginNew(p, TGT_A, pw1);
      await expect(p.locator('#moduleDialogToggle')).toBeVisible();
    });
  } finally {
    void current;
    await ctx.close();
  }
});
