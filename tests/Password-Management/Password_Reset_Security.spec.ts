// Password Reset security gating: processes ResetPassword_Option (tile + page), ResetPassword_Nontemporary, ResetPassword_AllFacilities, against ValMaster
// PR20121221001F100.0.2 / 0.3 / 0.4 (docs/agents/valmaster-password-change-reset.md). The operator CLPROp01 (Atlanta Test, group CLPRGrp) logs in in a SECOND browser context
// (roles load at login, so every group change needs a new login); the seed user toggles CLPRGrp (only CL* is ever written) and the group is restored in finally.
// Targets: the fixtures CLPRTgtA01 (same facility) and CLPRTgtB01 (Buford Plant). Direct POSTs reuse the operator's session cookies (page.request).
import { test, expect, type Browser, type Page } from '@playwright/test';
import { PASSWORD, USERNAME, login, loginAs } from '../support/robar';
import * as sec from '../support/security';
import { FIXTURE_PASSWORD, OP, OP_GROUP, OP_PROCESSES, PRURL, REASON, TGT_A, TGT_B, getPw, listTexts, loginKind, newPw, openReset, resetUser, savePw } from './pr-fixtures';

test.use({ actionTimeout: 20_000 });

const observation = (id: string, description: string) => test.info().annotations.push({ type: `deviation ${id}`, description });

async function operator(browser: Browser): Promise<{ page: Page; close: () => Promise<void> }> {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 900 } });
  const page = await ctx.newPage();
  await loginAs(page, OP, FIXTURE_PASSWORD);
  return { page, close: () => ctx.close() };
}

async function postReset(page: Page, target: string, pw: string, temporary: boolean, sig: { user: string; pw: string }): Promise<{ status: number; body: string }> {
  const r = await page.request.post(PRURL + 'ResetPassword', {
    headers: { 'X-Requested-With': 'XMLHttpRequest' }, // the page's jQuery sets it; the [AjaxException] filter only returns JSON errors for AJAX requests
    form: { user: target, newPassword: pw, makeTemporary: String(temporary), 'signature.Comment': '', 'signature.Reason': REASON, 'signature.Password': sig.pw, 'signature.UserID': sig.user },
  });
  return { status: r.status(), body: (await r.text()).replace(/\s+/g, ' ').slice(0, 300) };
}

test('Password Reset security: Option, Nontemporary and AllFacilities processes (UI and direct requests)', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const SEED = { user: USERNAME, pw: PASSWORD };
  const setGroup = async (extra: string[]) => {
    await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx'));
    await sec.setGroupProcesses(page, OP_GROUP, [...OP_PROCESSES, ...extra]);
  };

  try {
    await test.step('baseline: CLPRGrp = Login_WebMenu + ResetPassword_Option', async () => { await setGroup([]); });

    await test.step('Option only: tile is there, the list is limited to the operator\'s facility and the tick is locked (F100.0.2, F100.0.3)', async () => {
      const op = await operator(browser);
      try {
        const body = (await op.page.locator('body').innerText()).replace(/\s+/g, ' ');
        expect(body).toContain('Password Reset');
        expect(body, 'no Password Change tile without PasswordChange_Option').not.toContain('Password Change');
        await openReset(op.page);
        const reset = await listTexts(op.page, '#drpUserReset');
        expect(reset).toContain(TGT_A);
        expect(reset, 'F100.0.3: a user of another facility is not offered').not.toContain(TGT_B);
        await expect(op.page.locator('#chkTemporary')).toBeChecked();
        await expect(op.page.locator('#chkTemporary'), 'F100.0.2: without ResetPassword_Nontemporary the tick cannot be cleared').toBeDisabled();
        expect(await op.page.locator('#nontemporary').inputValue()).toBe('false');

        const nonTemp = await postReset(op.page, TGT_A, newPw(), false, { user: OP, pw: FIXTURE_PASSWORD });
        console.log('direct POST non-temporary without the process:', JSON.stringify(nonTemp));
        expect(nonTemp.body).toMatch(/Not Authorized for: ResetPassword_Nontemporary/);
        expect(nonTemp.status).not.toBe(200);

        const crossOwn = await postReset(op.page, TGT_B, newPw(), true, { user: OP, pw: FIXTURE_PASSWORD });
        console.log('direct POST to another facility, signed by the operator:', JSON.stringify(crossOwn));
        expect(crossOwn.body).toMatch(/not authorized for task/i);
        expect(crossOwn.body).toContain('ResetPassword_AllFacilities');

        // the permission checks of the SERVICE use the SIGNER, not the logged-in operator: the seed user's credentials as signature pass the facility rule
        const pwB = newPw();
        const crossSeed = await postReset(op.page, TGT_B, pwB, true, SEED);
        console.log('direct POST to another facility, signed with the seed user\'s credentials:', JSON.stringify(crossSeed));
        if (crossSeed.status === 200) {
          savePw(TGT_B, pwB);
          observation('PR20121221001F100.0.4', 'ResetPassword_AllFacilities is evaluated for the SIGNATURE user, not the logged-in operator: an operator without the process reset a user of another facility by posting directly with a privileged user\'s signature (the page itself never lists that user)');
        } else {
          console.log('cross-facility reset signed by another user was refused:', crossSeed.body);
        }
      } finally { await op.close(); }
    });

    await test.step('+ ResetPassword_Nontemporary: the tick can be cleared and a permanent reset works (F100.0.2)', async () => {
      await setGroup(['ResetPassword_Nontemporary']);
      const op = await operator(browser);
      try {
        await openReset(op.page);
        await expect(op.page.locator('#chkTemporary')).toBeEnabled();
        const pw = newPw();
        const t = await resetUser(op.page, TGT_A, pw, { temporary: false, sig: { user: OP, pw: FIXTURE_PASSWORD } });
        console.log('permanent reset by the operator:', t);
        expect(t).toContain('Password reset successfully.');
        savePw(TGT_A, pw);
        expect((await loginKind(browser, TGT_A, pw)).kind, 'permanent: the target logs straight in').toBe('MENU');
      } finally { await op.close(); }
    });

    await test.step('+ ResetPassword_AllFacilities: users of other facilities are listed and can be reset (F100.0.4)', async () => {
      await setGroup(['ResetPassword_Nontemporary', 'ResetPassword_AllFacilities']);
      const op = await operator(browser);
      try {
        await openReset(op.page);
        expect(await listTexts(op.page, '#drpUserReset'), 'F100.0.4: the other facility\'s user is now offered').toContain(TGT_B);
        const pw = newPw();
        const t = await resetUser(op.page, TGT_B, pw, { temporary: true, sig: { user: OP, pw: FIXTURE_PASSWORD } });
        expect(t).toContain('Password reset successfully.');
        savePw(TGT_B, pw);
        expect((await loginKind(browser, TGT_B, pw)).kind).toBe('EXPIRED');
      } finally { await op.close(); }
    });

    await test.step('without ResetPassword_Option: no tile, page and requests refused', async () => {
      await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx'));
      await sec.setGroupProcesses(page, OP_GROUP, ['Login_WebMenu']);
      const op = await operator(browser);
      try {
        expect((await op.page.locator('body').innerText()).replace(/\s+/g, ' ')).not.toContain('Password Reset');
        const resp = await op.page.goto(PRURL);
        const text = (await op.page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 300);
        console.log('direct GET without the process: status', resp?.status(), '|', text);
        expect(await op.page.locator('#drpUserReset').count(), 'the page does not render').toBe(0);
        const post = await postReset(op.page, TGT_A, newPw(), true, { user: OP, pw: FIXTURE_PASSWORD });
        console.log('direct POST without the process:', JSON.stringify(post));
        expect(post.body).toMatch(/Not Authorized for: ResetPassword_Option/);
      } finally { await op.close(); }
    });
  } finally {
    await page.goto(page.url().replace(/Innovatum\/.*/i, 'Innovatum/WebMenu/MainMenu.aspx')).catch(() => {});
    await sec.setGroupProcesses(page, OP_GROUP, OP_PROCESSES);
  }
});
