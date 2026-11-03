// Fixed fixtures for the Password Reset / Password Change specs (TST703). Users and groups can never be deleted, so these are created once (Setup_Fixtures.spec.ts) and reused.
import type { Frame, Page } from '@playwright/test';
import * as sec from '../support/security';
import { ROBAR } from '../../seed';

export const SRV = ROBAR.url.replace(/innovatum\/WebMenu\/?$/i, '');
export const PRURL = SRV + 'Innovatum/PasswordReset/';
export const PCURL = SRV + 'Innovatum/WebMenu/ChangePwd.aspx';

/** Operator group: logs in to the Web Menu and may open Password Reset (nothing else). Specs toggle ResetPassword_* on it and restore it. */
export const OP_GROUP = 'CLPRGrp';
export const OP_PROCESSES = ['Login_WebMenu', 'ResetPassword_Option'];
/** Target users hold only Login_WebMenu (existing legacy group). */
export const TARGET_GROUP = 'MBPWLoginGrp';

export const OP = 'CLPROp01';
export const TGT_A = 'CLPRTgtA01'; // same facility as the operator
export const TGT_B = 'CLPRTgtB01'; // other facility
export const LOCK = 'CLPRLock01'; // spare user for lock / disabled scenarios (same facility)
export const FAC_A = 'Atlanta Test';
export const FAC_B = 'Buford Plant';
/** All fixture users are created with the seed user's password so a login as them is possible (new users reuse it, like the MBPWLogin01 fixture). */
export const FIXTURE_PASSWORD = sec.TEST_PASSWORD;

export const FIXTURE_USERS: Array<{ id: string; facility: string; group: string }> = [
  { id: OP, facility: FAC_A, group: OP_GROUP },
  { id: TGT_A, facility: FAC_A, group: TARGET_GROUP },
  { id: TGT_B, facility: FAC_B, group: TARGET_GROUP },
  { id: LOCK, facility: FAC_A, group: TARGET_GROUP },
];

export async function groupExists(f: Frame, group: string): Promise<boolean> {
  await sec.setView(f, 'GROUP');
  return (await sec.groupRow(f, group).count()) > 0;
}

export async function userExists(f: Frame, user: string): Promise<boolean> {
  await sec.setView(f, 'USER');
  return (await sec.userRow(f, user).count()) > 0;
}

export async function addGroup(page: Page, f: Frame, group: string, description: string): Promise<Frame> {
  sec.assertMb(group);
  await sec.setView(f, 'GROUP');
  const d = await sec.openDialog(f, 'group', 'add');
  await d.locator('#group_input_groupid').fill(group);
  await d.locator('#group_input_description').fill(description);
  await sec.submitDialog(f);
  return sec.refreshFrame(page);
}

/** Adds a user with "Reset password at next logon" OFF (the fixture must be able to log in directly). */
export async function addUser(page: Page, f: Frame, id: string, facility: string, group: string): Promise<Frame> {
  sec.assertMb(id);
  await sec.setView(f, 'USER');
  const d = await sec.openDialog(f, 'user', 'add');
  await d.locator('#users_input_userid').fill(id);
  await d.locator('#users_input_fullname').fill(`Playwright password-module fixture ${id}`);
  await d.locator('#users_input_facility').selectOption({ label: facility }, { timeout: 5000 });
  await d.locator('#users_input_timezone').selectOption({ label: '[+00.00] Greenwich Mean Time' }, { timeout: 5000 });
  await d.locator('#users_input_group').selectOption({ label: group }, { timeout: 5000 });
  await d.locator('#users_input_password').fill(FIXTURE_PASSWORD);
  await d.locator('#users_input_confirmpassword').fill(FIXTURE_PASSWORD);
  await d.locator('#users_input_resetpassword').uncheck();
  await sec.submitDialog(f);
  await page.waitForTimeout(2500);
  const stillOpen = await f.locator('#addEditUserDialog').isVisible().catch(() => false);
  if (stillOpen) {
    const msgs = await sec.dialogMessages(f).catch(() => []);
    await sec.cancelDialog(f).catch(() => {});
    throw new Error(`user ${id} was not added: ${msgs.join(' | ')}`);
  }
  return sec.refreshFrame(page);
}

// ---------------------------------------------------------------------------------------------------------------------------------------------------------------
// Current password per fixture user. PasswordDaysBeforeReuse forbids going back to an older password, so every run sets a NEW password and remembers it here.
import * as fs from 'fs';
import * as path from 'path';
import type { Browser } from '@playwright/test';
import { attemptLogin } from '../Login-Password/pw-helpers';

const STATE = path.join(__dirname, '..', '..', 'test-data', 'pr-fixture-passwords.json');
export function getPw(user: string): string {
  try { return JSON.parse(fs.readFileSync(STATE, 'utf8'))[user] ?? FIXTURE_PASSWORD; } catch { return FIXTURE_PASSWORD; }
}
export function savePw(user: string, pw: string): void {
  let all: Record<string, string> = {};
  try { all = JSON.parse(fs.readFileSync(STATE, 'utf8')); } catch { /* first run */ }
  all[user] = pw;
  fs.writeFileSync(STATE, JSON.stringify(all, null, 2));
}
/** A password that satisfies min length 8 + letters + numbers (unique per call). */
export function newPw(): string { return 'Pr' + Date.now().toString().slice(-6) + 'a1'; }

export const REASON = 'QA Review';

export async function openReset(page: Page): Promise<void> {
  await page.goto(PRURL);
  await page.waitForSelector('#drpUserReset', { timeout: 60_000 });
}

export async function listTexts(page: Page, select: '#drpUserReset' | '#drpUserUnlock'): Promise<string[]> {
  return (await page.locator(`${select} option`).allInnerTexts()).map((s) => s.replace(/\s+/g, ' ').trim());
}

async function pick(page: Page, select: string, user: string): Promise<void> {
  const idx = await page.locator(`${select} option`).evaluateAll((os, t) => os.findIndex((o) => (o.textContent || '').trim().toLowerCase().split(/\s+/)[0] === String(t).toLowerCase()), user);
  if (idx < 0) throw new Error(`user ${user} is not in ${select}`);
  await page.selectOption(select, { index: idx });
}

export interface Sig { user: string; pw: string; reason?: string | null; comment?: string }

async function fillSig(page: Page, sig: Sig): Promise<void> {
  await page.fill('#SignatureModel_UserName', sig.user);
  await page.fill('#SignatureModel_Password', sig.pw);
  if (sig.reason !== null) await page.selectOption('#SignatureModel_ReasonCode', { label: sig.reason ?? REASON }).catch(() => {});
  if (sig.comment !== undefined) await page.fill('#SignatureModel_Comment', sig.comment);
}

/** Clicks Submit and returns the text of the dialog(s) that open (error or success), then clicks OK. */
export async function submitAndRead(page: Page): Promise<string> {
  await page.click('#btnSubmit');
  await page.locator('.ui-dialog:visible').first().waitFor({ timeout: 20_000 }).catch(() => {});
  await page.waitForTimeout(500);
  const t = (await page.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').trim();
  await page.locator('.ui-dialog:visible button').filter({ hasText: /^Ok$/i }).first().click({ timeout: 3000 }).catch(() => {});
  await page.waitForTimeout(800);
  return t;
}

/** Reset (the page must be open): returns the dialog text. temporary = state of the "Require user to change password on login" tick. */
export async function resetUser(page: Page, target: string, pw: string, o: { confirm?: string; temporary: boolean; sig: Sig }): Promise<string> {
  await page.check('#radReset');
  await pick(page, '#drpUserReset', target);
  const tick = page.locator('#chkTemporary');
  if (!(await tick.isDisabled())) await tick.setChecked(o.temporary);
  await page.fill('#txtNewPassword', pw);
  await page.fill('#txtConfirmPassword', o.confirm ?? pw);
  await fillSig(page, o.sig);
  return submitAndRead(page);
}

export async function unlockUser(page: Page, target: string, sig: Sig): Promise<string> {
  await page.check('#radUnlock');
  await pick(page, '#drpUserUnlock', target);
  await fillSig(page, sig);
  return submitAndRead(page);
}

/** Logs in on the NEW login page in a fresh context and returns what it shows (MENU / EXPIRED / ERROR / OTHER + text); the context is closed. */
export async function loginKind(browser: Browser, user: string, pw: string): Promise<{ kind: string; text: string }> {
  const a = await attemptLogin(browser, user, pw);
  await a.ctx.close();
  return { kind: a.kind, text: a.text };
}

/** `failCount` CONSECUTIVE wrong-password logins (a correct login in between would clear the counter), then one login with the right password that must be refused. */
export async function lockByWrongPasswords(browser: Browser, user: string, rightPw: string, failCount: number): Promise<string> {
  for (let n = 1; n <= failCount; n++) await loginKind(browser, user, 'Wrong' + n + 'x9z');
  const r = await loginKind(browser, user, rightPw);
  if (r.kind === 'MENU' || r.kind === 'EXPIRED') throw new Error(`${user} was not locked after ${failCount} wrong attempts`);
  return r.text;
}
