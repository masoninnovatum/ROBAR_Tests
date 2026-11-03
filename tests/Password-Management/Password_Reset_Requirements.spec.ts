// Password Reset page (Innovatum/PasswordReset/, process ResetPassword_Option) against ValMaster module "Password Reset" (docs/agents/valmaster-password-change-reset.md).
// Run as the seed user (has ResetPassword_AllFacilities + _Nontemporary). Targets are ONLY the fixtures CLPRTgtA01 / CLPRLock01 (Setup_Fixtures.spec.ts); a login as a target uses the
// NEW login page in a fresh context. Every reset sets a NEW password (reuse rule) and records it in test-data/pr-fixture-passwords.json.
// Never signs with the seed user's password wrongly: a wrong signature password counts as a failed login of the signer, so the negative signature steps use a fixture signer.
// Confirmed live 2026-11-02 / source: PasswordResetController + PasswordResetService (Unlock() sets FailCount 0 AND Enabled = Y).
import { test, expect } from '@playwright/test';
import { PASSWORD, USERNAME, login } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';
import * as sec from '../support/security';
import { LOCK, REASON, TGT_A, getPw, listTexts, loginKind, lockByWrongPasswords, newPw, openReset, resetUser, savePw, submitAndRead, unlockUser } from './pr-fixtures';

test.use({ actionTimeout: 20_000 });

const deviation = (id: string, description: string) => test.info().annotations.push({ type: `deviation ${id}`, description });
const SEED = { user: USERNAME, pw: PASSWORD };

test('Password Reset: reset, temporary / permanent, rules, locked and unlock lists, unlock, e-signature, disabled users', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const failCount = Number(await readGlobalSetting(page, 'PasswordFailLockCount', 'LegacySettings')) || 3;
  console.log('PasswordFailLockCount =', failCount);
  await openReset(page);

  await test.step('page anatomy (U100.0): reset list, unlock list, reasons, default temporary tick (F100.0.1)', async () => {
    const reset = await listTexts(page, '#drpUserReset');
    expect(reset[0]).toBe('(Select user)');
    expect(reset).toContain(TGT_A);
    await expect(page.locator('#radReset')).toBeChecked();
    await expect(page.locator('#chkTemporary'), 'F100.0.1: new resets are temporary (immediately expired) by default').toBeChecked();
    await expect(page.locator('#chkTemporary')).toBeEnabled();
    expect(await listTexts(page, '#SignatureModel_ReasonCode' as any)).toContain(REASON);
    console.log('reset list size', reset.length, '; reasons', JSON.stringify(await listTexts(page, '#SignatureModel_ReasonCode' as any)));
  });

  await test.step('validation dialogs before anything is sent (F100.0.8 + signature fields)', async () => {
    const msg = async () => submitAndRead(page);
    await page.check('#radReset');
    expect(await msg(), 'no user selected').toContain('A user must be selected.');
    await page.selectOption('#drpUserReset', { label: TGT_A }).catch(async () => { await page.selectOption('#drpUserReset', { index: 1 }); });
    expect(await msg(), 'blank passwords').toContain('Password fields cannot be left blank.');
    await page.fill('#txtNewPassword', 'abc123xy'); await page.fill('#txtConfirmPassword', 'abc123xz');
    expect(await msg(), 'mismatch').toContain('Password fields do not match.');
    const min = Number(await page.locator('#minLength').inputValue());
    const letters = (await page.locator('#needsLetters').inputValue()) === 'true';
    const numbers = (await page.locator('#needsNumbers').inputValue()) === 'true';
    const tooShort = 'a1'.slice(0, Math.max(1, min - 1)).padEnd(Math.max(1, min - 1), 'a');
    await page.fill('#txtNewPassword', tooShort); await page.fill('#txtConfirmPassword', tooShort);
    const shortText = await msg();
    console.log('too-short dialog:', shortText);
    expect(shortText).toContain('Password is too short. Required characters:' + min);
    if (letters) { const p = '1'.repeat(min + 2); await page.fill('#txtNewPassword', p); await page.fill('#txtConfirmPassword', p); expect(await msg(), 'no letters').toContain('Password must contain letters.'); }
    if (numbers) { const p = 'a'.repeat(min + 2); await page.fill('#txtNewPassword', p); await page.fill('#txtConfirmPassword', p); expect(await msg(), 'no numbers').toContain('Password must contain numbers.'); }
    const ok = 'Valid1' + 'x'.repeat(Math.max(0, min));
    await page.fill('#txtNewPassword', ok); await page.fill('#txtConfirmPassword', ok);
    expect(await msg(), 'signature user + password blank').toContain('Signature Username and Password fields cannot be left blank.');
    await openReset(page);
  });

  const pw1 = newPw();
  await test.step('reset is temporary by default: the target must change the password at the next login (U100.0, F100.0.1)', async () => {
    const t = await resetUser(page, TGT_A, pw1, { temporary: true, sig: { ...SEED } });
    console.log('reset dialog:', t);
    expect(t).toContain('Password reset successfully.');
    savePw(TGT_A, pw1);
    const l = await loginKind(browser, TGT_A, pw1);
    expect(l.kind, 'a temporary reset leaves the password expired').toBe('EXPIRED');
    await openReset(page);
  });

  const pw2 = newPw();
  await test.step('the seed user may make a reset non-temporary: the target logs straight in (F100.0.2)', async () => {
    const t = await resetUser(page, TGT_A, pw2, { temporary: false, sig: { ...SEED } });
    expect(t).toContain('Password reset successfully.');
    savePw(TGT_A, pw2);
    expect((await loginKind(browser, TGT_A, pw2)).kind).toBe('MENU');
    await openReset(page);
  });

  await test.step('server rejects a password that cannot be reused (F100.0.8: settings rules apply)', async () => {
    const t = await resetUser(page, TGT_A, pw1, { temporary: false, sig: { ...SEED } });
    console.log('reuse dialog:', t);
    expect(t).toContain('The new password was invalid.');
    expect((await loginKind(browser, TGT_A, pw2)).kind, 'the failed reset changed nothing').toBe('MENU');
    await openReset(page);
  });

  await test.step('e-signature checks on the server (F100.0.9 / F100.1.2): signer without the process, wrong signer password', async () => {
    const noProc = await resetUser(page, TGT_A, newPw(), { temporary: true, sig: { user: TGT_A, pw: pw2 } });
    console.log('signer without ResetPassword_Option:', noProc);
    expect(noProc).toMatch(/not authorized for task/i);
    expect((await loginKind(browser, TGT_A, pw2)).kind, 'nothing was reset').toBe('MENU');
    await openReset(page);
    const wrongSig = await resetUser(page, TGT_A, newPw(), { temporary: true, sig: { user: TGT_A, pw: 'Wrong1x9z' } });
    console.log('wrong signer password:', wrongSig);
    expect(wrongSig).toMatch(/invalid/i);
    expect((await loginKind(browser, TGT_A, pw2)).kind, 'a right login clears the signer\'s failed attempt').toBe('MENU');
    await openReset(page);
  });

  let lockPw = getPw(LOCK);
  await test.step('locked users are marked in the reset list and are the only users in the unlock list (F100.0.5, F100.1.3)', async () => {
    const lockedText = await lockByWrongPasswords(browser, LOCK, lockPw, failCount);
    console.log('locked login text:', lockedText);
    await openReset(page);
    const reset = await listTexts(page, '#drpUserReset');
    const unlock = await listTexts(page, '#drpUserUnlock');
    expect(reset, 'F100.0.5: a locked user is visibly distinguishable').toContain(`${LOCK} - Locked`);
    expect(reset, 'an unlocked user has no marker').toContain(TGT_A);
    expect(unlock).toContain(`${LOCK} - Locked`);
    expect(unlock.some((o) => o === TGT_A || o.startsWith(TGT_A + ' ')), 'F100.1.3: only locked users are in the unlock list').toBe(false);
    expect(unlock.every((o) => o === '(Select user)' || / - Locked$/.test(o)), 'every unlock entry is marked').toBe(true);
  });

  await test.step('resetting a locked user unlocks it (F100.0.7)', async () => {
    const pw = newPw();
    const t = await resetUser(page, LOCK, pw, { temporary: false, sig: { ...SEED } });
    expect(t).toContain('Password reset successfully.');
    savePw(LOCK, pw); lockPw = pw;
    expect((await loginKind(browser, LOCK, pw)).kind, 'the account is usable again').toBe('MENU');
    await openReset(page);
    expect(await listTexts(page, '#drpUserUnlock')).not.toContain(`${LOCK} - Locked`);
  });

  await test.step('unlock without changing the password (U100.1, F100.1.2)', async () => {
    await lockByWrongPasswords(browser, LOCK, lockPw, failCount);
    await openReset(page);
    const t = await unlockUser(page, LOCK, { ...SEED });
    console.log('unlock dialog:', t);
    expect(t).toContain('User unlocked successfully.');
    expect((await loginKind(browser, LOCK, lockPw)).kind, 'the SAME password works again').toBe('MENU');
  });

  await test.step('a DISABLED user: listed as "Locked", and a reset or an unlock re-enables the account (source: Unlock() sets Enabled = Y)', async () => {
    let f = await (async () => { await page.goto(page.url().replace(/Innovatum\/PasswordReset.*/i, 'Innovatum/WebMenu/MainMenu.aspx')); return sec.reopenSecurity(page); })();
    await sec.setView(f, 'USER');
    sec.assertMb(LOCK);
    await sec.selectRow(page, f, sec.userRow(f, LOCK));
    const d = await sec.openDialog(f, 'user', 'edit');
    await d.locator('#users_input_active').uncheck();
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    expect(await sec.userRow(f, LOCK).locator('td#userEnabled input').isChecked(), 'LOCK is now disabled').toBe(false);

    await openReset(page);
    const unlock = await listTexts(page, '#drpUserUnlock');
    expect(unlock, 'a disabled user is in the unlock list').toContain(`${LOCK} - Locked`);
    deviation('PR20121221001F100.0.5 / 1.3', 'a DISABLED (not locked) user is labelled "Locked" in both lists, so a disabled and a locked account cannot be told apart');
    expect((await loginKind(browser, LOCK, lockPw)).kind, 'a disabled user cannot log in').not.toBe('MENU');

    const t = await unlockUser(page, LOCK, { ...SEED });
    expect(t).toContain('User unlocked successfully.');
    deviation('PR20121221001F100.1', 'Unlock User also re-ENABLES a disabled account (Unlock() sets Enabled = Y), not only the fail count');
    expect((await loginKind(browser, LOCK, lockPw)).kind, 'unlock re-enabled the account').toBe('MENU');
    f = await (async () => { await page.goto(page.url().replace(/Innovatum\/PasswordReset.*/i, 'Innovatum/WebMenu/MainMenu.aspx')); return sec.reopenSecurity(page); })();
    await sec.setView(f, 'USER');
    expect(await sec.userRow(f, LOCK).locator('td#userEnabled input').isChecked(), 'Active flag is back on in Security Management').toBe(true);
  });

  console.log('Activity table rows for PasswordReset / unlock are NOT verified here (no database access from the test runner).');
});
