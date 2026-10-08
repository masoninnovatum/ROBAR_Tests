// Follow-up: PasswordNeedsLetters = N and PasswordNeedsNumbers = N (user-applied + restart): is either rule still enforced on ANY surface? One-off.
import { test } from '@playwright/test';
import { PASSWORD, USERNAME } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';
import * as sec from '../support/security';
import { Admin, attemptLogin, epSubmit, pcSubmit, record, PRURL } from './pw-helpers';

test.use({ actionTimeout: 20_000 });

// passwords that would violate each rule if it were on (all >= 5 chars so MinLength 5 is not the cause)
const PWS: Array<[string, string]> = [['digits-only', '12345678'], ['letters-only', 'abcdefgh'], ['symbols-only', '!!!!!!!!'], ['mixed-case-letters', 'AbCdEfGh']];

test('NeedsLetters N / NeedsNumbers N on every surface', async ({ page, browser }) => {
  test.setTimeout(2_400_000);
  const stamp = Date.now().toString().slice(-6);
  const A = 'abc12345';
  const admin = new Admin(page);
  await admin.open();

  // exact stored values (owner LegacySettings)
  const vals: Record<string, string | undefined> = {};
  for (const n of ['PasswordNeedsLetters', 'PasswordNeedsNumbers', 'PasswordMinLength']) vals[n] = await readGlobalSetting(page, n, 'LegacySettings');
  await page.goto(PRURL);
  await page.waitForSelector('#btnSubmit', { timeout: 90_000 });
  const hidden = await page.evaluate(() => ({ minLength: (document.getElementById('minLength') as HTMLInputElement)?.value, needsLetters: (document.getElementById('needsLetters') as HTMLInputElement)?.value, needsNumbers: (document.getElementById('needsNumbers') as HTMLInputElement)?.value }));
  record('N-settings', `GlobalSettings (LegacySettings): ${JSON.stringify(vals)}; Password Reset hidden fields: ${JSON.stringify(hidden)}`, String(hidden.needsLetters).toLowerCase() === 'false' && String(hidden.needsNumbers).toLowerCase() === 'false' ? 'Pass' : 'Blocked', 'confirms both rules are OFF in the page that reads them');

  const mk = async (suffix: string, reset: boolean, pw = A) => { const u = `MBPWN${suffix}_${stamp}`; const r = await admin.addUser(u, pw, pw, reset); if (!r.added) throw new Error(`add ${u}: ${JSON.stringify(r.messages)}`); return u; };

  // SM: add users with each weak password; then the user logs in with it (NL)
  for (const [label, pw] of PWS) {
    const u = await mk(`S${label.slice(0, 2)}`, false, pw);
    const l = await attemptLogin(browser, u, pw);
    record(`N-SM-${label}`, `Security Management add user "${pw}" -> added; new login -> ${l.kind} ${l.text}`, l.kind === 'MENU' ? 'Pass' : 'Gap', 'accepted (Security Management never checks) and logs in');
    await l.ctx.close();
  }

  // EP: one expired user per password
  for (const [label, pw] of PWS) {
    const u = await mk(`E${label.slice(0, 2)}`, true);
    const a = await attemptLogin(browser, u, A);
    const x = await epSubmit(a.page, A, pw, pw);
    record(`N-EP-${label}`, `Expired Password page, new password "${pw}": ${x.kind} "${x.text}"`, x.kind === 'MENU' ? 'Pass' : 'Gap', 'expected accepted with both rules off');
    await a.ctx.close();
  }

  // PC: successive changes on one user
  const p = await mk('P', false);
  let cur = A;
  for (const [label, pw] of PWS) {
    const t = await pcSubmit(browser, p, cur, pw);
    const ok = /updated successfully/i.test(t);
    record(`N-PC-${label}`, `Password Change, new password "${pw}": "${t}"`, ok ? 'Pass' : 'Gap', 'expected accepted with both rules off');
    if (ok) cur = pw;
  }

  // PR: reset to each (non-temporary so the target stays usable); client dialog + server
  const r = await mk('R', false);
  for (const [label, pw] of PWS) {
    const t = await admin.prReset(r, pw, pw, false, USERNAME, PASSWORD);
    const ok = /reset successfully/i.test(t);
    let loginKind = 'n/a';
    if (ok) { const l = await attemptLogin(browser, r, pw); loginKind = l.kind; await l.ctx.close(); }
    record(`N-PR-${label}`, `Password Reset, new password "${pw}": "${t}"; login with it -> ${loginKind}`, ok && loginKind === 'MENU' ? 'Pass' : 'Gap', 'expected accepted with both rules off');
  }
  void sec;
});
