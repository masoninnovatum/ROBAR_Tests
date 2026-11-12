// Password Change page (Innovatum/WebMenu/ChangePwd.aspx; tile process PasswordChange_Option) against ValMaster module "Password Change" (URS-8.1.19, FRS-8.1.19.1 / .2 / .3,
// docs/agents/valmaster-password-change-reset.md). The page needs NO session (Authenticate() is overridden), so it is driven in fresh contexts; the only user is the fixture CLPRTgtA01
// (Setup_Fixtures.spec.ts). The seed user makes the target's password temporary through Password Reset to produce an EXPIRED password for FRS-8.1.19.3 (legacy login redirect).
// Source: Web/WebMenu/ChangePwd.aspx.cs. Every change uses a NEW password (reuse rule) recorded in test-data/pr-fixture-passwords.json.
import { test, expect, type Browser } from '@playwright/test';
import { PASSWORD, USERNAME, login, loginAs } from '../support/robar';
import { PCURL, TGT_A, loginKind, newPw, openReset, resetUser, savePw, getPw } from './pr-fixtures';

test.use({ actionTimeout: 20_000 });

const deviation = (id: string, description: string) => test.info().annotations.push({ type: `deviation ${id}`, description });
const F = { user: '#ctl00_cphMainContent_Txt_User', cur: '#ctl00_cphMainContent_Txt_CurrentPwd', nw: '#ctl00_cphMainContent_Txt_NewPwd', conf: '#ctl00_cphMainContent_Txt_Confirm', btn: '#ctl00_cphMainContent_Button1', msg: '#ctl00_cphMainContent_Label1' };

/** Fresh anonymous context, fills the form, submits, returns Label1. */
async function change(browser: Browser, user: string, current: string, nw: string, confirm = nw): Promise<string> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    await p.goto(PCURL);
    await p.fill(F.user, user); await p.fill(F.cur, current); await p.fill(F.nw, nw); await p.fill(F.conf, confirm);
    await p.click(F.btn);
    await p.waitForLoadState('networkidle');
    await p.waitForTimeout(800);
    return (await p.locator(F.msg).innerText().catch(() => '')).replace(/\s+/g, ' ').trim();
  } finally { await ctx.close(); }
}

test('Password Change: page, edit checks, success, expired-password redirect', async ({ page, browser }) => {
  test.setTimeout(900_000);
  await login(page);
  const SEED = { user: USERNAME, pw: PASSWORD };

  // an expired password to start from: temporary reset of the fixture by the seed user
  let cur = newPw();
  await test.step('setup: make CLPRTgtA01\'s password temporary (expired) through Password Reset', async () => {
    await openReset(page);
    expect(await resetUser(page, TGT_A, cur, { temporary: true, sig: SEED })).toContain('Password reset successfully.');
    savePw(TGT_A, cur);
  });

  await test.step('FRS-8.1.19.1: a browser page, reachable without a session, with the four fields and a button', async () => {
    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    await p.goto(PCURL);
    console.log('browser tab title: "' + (await p.title()) + '" (empty on TST703)');
    expect((await p.locator('body').innerText()).replace(/\s+/g, ' ')).toContain('Change Password');
    for (const sel of [F.user, F.cur, F.nw, F.conf, F.btn]) await expect(p.locator(sel)).toBeVisible();
    console.log('page text:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200));
    await ctx.close();
  });

  const min = 5; // PasswordMinLength on TST703 at the time of writing; the message is read below instead of hard-coded
  await test.step('FRS-8.1.19.2: the same edit checks as the other password pages (messages, order)', async () => {
    const n = newPw();
    const mism = await change(browser, TGT_A, cur, n, n + 'x');
    console.log('mismatch:', mism);
    expect(mism).toBe('Please reconfirm your new password.');
    const short = await change(browser, TGT_A, cur, 'a1');
    console.log('too short:', short);
    expect(short).toMatch(/^Your password must be at least \d+ characters!$/);
    const both = await change(browser, TGT_A, cur, 'a1', 'a2');
    expect(both, 'the mismatch check comes before the rules').toBe('Please reconfirm your new password.');
    expect(await change(browser, TGT_A, cur, '12345678')).toBe('Your password must contain letters!');
    expect(await change(browser, TGT_A, cur, 'abcdefgh')).toBe('Your password must contain numbers!');
    void min;
  });

  const pwA = newPw();
  await test.step('a wrong current password with a valid new one is refused and changes nothing', async () => {
    const t = await change(browser, TGT_A, 'Wrong1x9z', pwA);
    console.log('wrong current:', t);
    expect(t).toMatch(/Invalid Username\/Password/);
    expect((await loginKind(browser, TGT_A, cur)).kind, 'the old password still works (EXPIRED page = still temporary)').toBe('EXPIRED');
  });

  await test.step('success: "Your password has been updated successfully." and the expired flag is cleared (URS-8.1.19)', async () => {
    const t = await change(browser, TGT_A, cur, pwA);
    console.log('success:', t);
    expect(t).toBe('Your password has been updated successfully.');
    const old = cur; cur = pwA; savePw(TGT_A, cur);
    expect((await loginKind(browser, TGT_A, cur)).kind, 'the user now logs straight in').toBe('MENU');
    const reuse = await change(browser, TGT_A, cur, old);
    console.log('reuse of the previous password:', reuse);
    expect(reuse).toBe('That password cannot be reused at this time!');
  });

  await test.step('new password = CURRENT password is accepted here (the Expired Password page refuses it)', async () => {
    const t = await change(browser, TGT_A, cur, cur);
    console.log('new = current:', t);
    expect(t).toBe('Your password has been updated successfully.');
    deviation('FRS-8.1.19.2', 'Password Change accepts a new password identical to the current one, while the Expired Password page refuses it ("New password must be different than the current password"); the requirement says the same edit checks apply');
  });

  await test.step('FRS-8.1.19.3: an expired password at login is redirected to the Password Change page (legacy Web Menu login)', async () => {
    await openReset(page);
    const tmp = newPw();
    expect(await resetUser(page, TGT_A, tmp, { temporary: true, sig: SEED })).toContain('Password reset successfully.');
    savePw(TGT_A, tmp); cur = tmp;

    const ctx = await browser.newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, TGT_A, cur);
      await p.waitForTimeout(1500);
      console.log('after legacy login of an expired user:', p.url());
      console.log('landing text:', (await p.locator('body').innerText().catch(() => '?')).replace(/\s+/g, ' ').slice(0, 300));
      await p.screenshot({ path: 'test-results/zz-expired-landing.png' }).catch(() => {});
      expect(p.url()).toMatch(/WebMenu\/ChangePwd\.aspx\?Expired=true/i);
      expect((await p.locator(F.msg).innerText()).replace(/\s+/g, ' ').trim()).toBe('Your password has expired. Please update your password now.');
      const pwB = newPw();
      await p.fill(F.user, TGT_A); await p.fill(F.cur, cur); await p.fill(F.nw, pwB); await p.fill(F.conf, pwB);
      await p.click(F.btn);
      await p.waitForLoadState('networkidle');
      expect((await p.locator(F.msg).innerText()).replace(/\s+/g, ' ').trim()).toBe('Your password has been updated successfully.');
      cur = pwB; savePw(TGT_A, cur);
      console.log('page says:', (await p.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200));
      await p.waitForURL((u) => !/ChangePwd/i.test(u.toString()), { timeout: 15_000 });
      await p.waitForLoadState('networkidle');
      await p.waitForTimeout(1500);
      const loginForm = (await p.locator('.userID').count()) > 0;
      console.log('after the redirect: url =', p.url(), '| login form shown =', loginForm);
      if (loginForm) deviation('FRS-8.1.19.3', 'after an expired password is changed the page announces "Redirecting..." to MainMenu.aspx, but the logout script it registers for ?Expired=true wins: the user lands on the login page (Default.aspx?...Logout=true&ForwardURL=MainMenu.aspx) and must log in again');
    } finally { await ctx.close(); }
    expect((await loginKind(browser, TGT_A, cur)).kind).toBe('MENU');
  });

  console.log('Password Change writes no Activity record (source: ChangePwd.aspx.cs has none); not verifiable here without database access. Fixture password now stored for', TGT_A, '=', getPw(TGT_A) === cur);
});
