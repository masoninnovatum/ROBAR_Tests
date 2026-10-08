// One-off helpers for the password-settings matrix follow-up (TST703, 2026-10-07; NeedsLetters/NeedsNumbers = N on every surface). Not a permanent suite.
import * as fs from 'fs';
import * as path from 'path';
import type { Browser, BrowserContext, Frame, Page } from '@playwright/test';
import { ROBAR } from '../../seed';
import * as sec from '../support/security';

export const SRV = ROBAR.url.replace(/innovatum\/WebMenu\/?$/i, '');
export const NEW = SRV + 'ROBAR/';
export const PCURL = SRV + 'Innovatum/WebMenu/ChangePwd.aspx';
export const PRURL = SRV + 'Innovatum/PasswordReset/';
export const GROUP = 'MBPWLoginGrp';
const RES = path.join(__dirname, '..', '..', 'test-data', 'pwmatrix-results-n.json');

export function record(id: string, actual: string, result: 'Pass' | 'Gap' | 'Blocked' | 'N/A', notes = ''): void {
  const all = fs.existsSync(RES) ? JSON.parse(fs.readFileSync(RES, 'utf8')) : {};
  all[id] = { actual, result, notes, at: new Date().toISOString() };
  fs.writeFileSync(RES, JSON.stringify(all, null, 2));
  console.log(`CASE ${id} [${result}] ${actual}${notes ? ' | ' + notes : ''}`);
}

export type Kind = 'MENU' | 'EXPIRED' | 'ERROR' | 'OTHER';
export interface Attempt { kind: Kind; text: string; page: Page; ctx: BrowserContext }

export async function classify(page: Page): Promise<{ kind: Kind; text: string }> {
  const text = ((await page.locator('.text-danger').allInnerTexts()).join(' | ') || '').replace(/\s+/g, ' ').trim();
  if (page.url().includes('MainMenu')) return { kind: 'MENU', text };
  if ((await page.locator('#newPasswordInput').count()) > 0) return { kind: 'EXPIRED', text };
  if ((await page.locator('#userIDInput').count()) > 0) return { kind: 'ERROR', text };
  return { kind: 'OTHER', text: (await page.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200) };
}

export async function attemptLogin(browser: Browser, user: string, pw: string): Promise<Attempt> {
  const ctx = await browser.newContext({ viewport: { width: 1200, height: 800 } });
  const page = await ctx.newPage();
  await page.goto(NEW);
  await page.fill('#userIDInput', user);
  await page.fill('#passwordInput', pw);
  await page.click('input[type=submit]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  return { ...(await classify(page)), page, ctx };
}

export async function epSubmit(page: Page, oldPw: string, nw: string, confirm = nw): Promise<{ kind: Kind; text: string }> {
  await page.fill('#oldPasswordInput', oldPw);
  await page.fill('#newPasswordInput', nw);
  await page.fill('#confirmNewPasswordInput', confirm);
  await page.click('input[type=submit]');
  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);
  return classify(page);
}

export async function pcSubmit(browser: Browser, user: string, current: string, nw: string, confirm = nw): Promise<string> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await p.goto(PCURL);
  await p.fill('#ctl00_cphMainContent_Txt_User', user);
  await p.fill('#ctl00_cphMainContent_Txt_CurrentPwd', current);
  await p.fill('#ctl00_cphMainContent_Txt_NewPwd', nw);
  await p.fill('#ctl00_cphMainContent_Txt_Confirm', confirm);
  await p.click('#ctl00_cphMainContent_Button1');
  await p.waitForLoadState('networkidle');
  await p.waitForTimeout(800);
  const t = ((await p.locator('#ctl00_cphMainContent_Label1').innerText().catch(() => '')) || (await p.locator('#ctl00_lblErrorMessage').innerText().catch(() => ''))).replace(/\s+/g, ' ').trim();
  await ctx.close();
  return t;
}

export class Admin {
  frame!: Frame;
  constructor(readonly page: Page) {}
  async open(): Promise<void> { this.frame = await sec.openSecurity(this.page); }

  async addUser(id: string, pw: string, confirm: string, reset: boolean, group = GROUP): Promise<{ added: boolean; messages: string[] }> {
    if (!this.page.url().toLowerCase().includes('innovatum/webmenu/mainmenu')) await this.page.goto(SRV + 'Innovatum/WebMenu/MainMenu.aspx');
    this.frame = await sec.reopenSecurity(this.page);
    await sec.setView(this.frame, 'USER');
    const d = await sec.openDialog(this.frame, 'user', 'add');
    await d.locator('#users_input_userid').fill(id);
    await d.locator('#users_input_fullname').fill(`Playwright pw matrix ${id}`);
    await d.locator('#users_input_timezone').selectOption({ label: '[+00.00] Greenwich Mean Time' }, { timeout: 5000 });
    await d.locator('#users_input_group').selectOption({ label: group }, { timeout: 5000 });
    await d.locator('#users_input_password').fill(pw);
    await d.locator('#users_input_confirmpassword').fill(confirm);
    if (reset) await d.locator('#users_input_resetpassword').check(); else await d.locator('#users_input_resetpassword').uncheck();
    await sec.submitDialog(this.frame);
    await this.page.waitForTimeout(2500);
    const messages = await sec.dialogMessages(this.frame).catch(() => []);
    const stillOpen = await this.frame.locator('#addEditUserDialog').isVisible().catch(() => false);
    if (stillOpen) { await sec.cancelDialog(this.frame).catch(() => {}); return { added: false, messages }; }
    this.frame = await sec.refreshFrame(this.page);
    return { added: true, messages };
  }

  async prReset(target: string, nw: string, confirm = nw, temporary = true, sigUser: string, sigPw: string): Promise<string> {
    await this.page.goto(PRURL);
    await this.page.waitForSelector('#drpUserReset', { timeout: 60_000 });
    await this.page.check('#radReset');
    const optionIndex = await this.page.locator('#drpUserReset option').evaluateAll((os, t) => os.findIndex((o) => (o.textContent || '').trim().toLowerCase().startsWith(String(t).toLowerCase())), target);
    if (optionIndex < 0) throw new Error(`user ${target} is not in the Password Reset list`);
    await this.page.selectOption('#drpUserReset', { index: optionIndex });
    if (temporary) await this.page.check('#chkTemporary'); else await this.page.uncheck('#chkTemporary');
    await this.page.fill('#txtNewPassword', nw);
    await this.page.fill('#txtConfirmPassword', confirm);
    await this.page.fill('#SignatureModel_UserName', sigUser);
    await this.page.fill('#SignatureModel_Password', sigPw);
    await this.page.click('#btnSubmit');
    await this.page.waitForTimeout(3500);
    const t = (await this.page.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').trim();
    await this.page.locator('.ui-dialog:visible button').filter({ hasText: /OK|Ok/ }).first().click({ timeout: 3000 }).catch(() => {});
    await this.page.waitForTimeout(500);
    return t || (await this.page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200);
  }
}
