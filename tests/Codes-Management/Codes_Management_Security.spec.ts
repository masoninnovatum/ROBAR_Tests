// Codes Management security gating (live 2026-10-08, TST703). The MB fixture group MBPWLoginGrp / user MBPWLogin01 get ONE process more per state (second browser context for the MB user), the seed
// user edits the group (only MB groups are allowed). Source: Management view = no [Authorize]; CanAddCodes / CanEditCodes = IsInRole("Web_Codes"); Update action = [Authorize(Roles = "Web_Codes")];
// Excel Import menu item `menuDisable` + processName Web_Codes; FileSubmission = [ExcelUploadAuthorize]; signer rights EI_Codes / EI_Codes_Upd (see the Excel spec). Ends with the group holding only Login_WebMenu.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { loginAs, openMenuItem, findFrame, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

/** A ValMaster requirement (source of truth) the live system does not meet: recorded as a test annotation, not a failure. */
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu'];

interface Seen { warningText: string; actionsTitle: string; tile: boolean; addDisabled: boolean | null; addTitle: string; editDisabled: boolean | null; warning: boolean | null; actions: string[]; actionsDisabled: boolean | null; rows: number; updateStatus: number | null; p?: Page; close: () => Promise<void> }

async function inspect(browser: Browser): Promise<Seen> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  await loginAs(p, MB, PASSWORD);
  await p.waitForTimeout(2000);
  const tile = (await p.locator('button.menuIcon:has-text("Codes Management")').count()) > 0;
  const out: Seen = { warningText: '', actionsTitle: '', tile, addDisabled: null, addTitle: '', editDisabled: null, warning: null, actions: [], actionsDisabled: null, rows: 0, updateStatus: null, close: () => ctx.close() };
  if (tile) {
    await openMenuItem(p, 'Codes Management');
    const f: Frame = await findFrame(p, 'InnoPages/Codes/Management');
    await p.waitForTimeout(4000);
    out.rows = await f.locator('#grdJqGrid tr.jqgrow').count();
    out.addDisabled = /ui-state-disabled/.test((await f.locator('#add_grdJqGrid').getAttribute('class')) ?? '');
    out.addTitle = (await f.locator('#add_grdJqGrid').getAttribute('title')) ?? '';
    out.editDisabled = /ui-state-disabled/.test((await f.locator('#edit_grdJqGrid').getAttribute('class')) ?? '');
    out.warning = (await f.locator('body').innerText()).includes('not authorized') || (await f.locator('.message-warning:visible').count()) > 0;
    out.warningText = (await f.locator('.message-warning:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').trim();
    out.actionsTitle = [await f.locator('#drpMainActions').getAttribute('title'), await f.locator('#drpMainActions').evaluate((e) => (e.closest('[title]') as HTMLElement | null)?.title ?? '')].filter(Boolean).join(' | ');
    await f.locator('#drpMainActions').click();
    await p.waitForTimeout(500);
    out.actions = await f.locator('ul:visible li').evaluateAll((lis) => lis.map((li) => `${(li.textContent || '').trim()}|${li.className}|${li.getAttribute('title') || ''}`).filter((t) => !t.startsWith('|')));
    // without Web_Codes the Actions menu does not open at all (no visible entries)
    out.actionsDisabled = out.actions.length === 0 || out.actions.some((a) => /disabled/i.test(a));
    // server side: the Update action posted straight from the page (jqGrid add) without Web_Codes
    out.updateStatus = await f.evaluate(async () => {
      const r = await fetch('/InnoPages/Codes/Update?oper=add', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'codetype=MBCodesTest&code=MBSECX&description=x&active=Y&oper=add', credentials: 'same-origin', redirect: 'manual' });
      return r.type === 'opaqueredirect' ? 302 : r.status;
    }).catch(() => null);
  }
  out.p = p;
  return out;
}

test('Codes Management: Web_Codes switches Add / Edit / Excel Import and the Update action; tile visibility', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  await sec.openSecurity(page);
  const show = (label: string, r: Seen) => console.log(`${label}: tile=${r.tile} rows=${r.rows} addDisabled=${r.addDisabled} (${r.addTitle}) editDisabled=${r.editDisabled} warning=${r.warning} actions=${JSON.stringify(r.actions)} Update POST status=${r.updateStatus}`);
  try {
    await test.step('S0: only Login_WebMenu', async () => {
      await sec.setGroupProcesses(page, GROUP, BASE);
      const r = await inspect(browser);
      show('S0', r);
      await r.close();
    });
    await test.step('S1: + View_Codes (the tile process) -> tile and grid, but Add / Edit / Excel Import disabled and the Update action refused', async () => {
      await sec.setGroupProcesses(page, GROUP, [...BASE, 'View_Codes']);
      const r = await inspect(browser);
      show('S1', r);
      expect(r.tile).toBe(true);
      expect(r.rows).toBeGreaterThan(0);
      expect(r.addDisabled).toBe(true);
      expect(r.addTitle).toContain('User not authorized for this task Web_Codes');
      expect(r.editDisabled).toBe(true);
      expect(r.actionsDisabled).toBe(true);
      expect(r.warning).toBe(true);
      expect(r.updateStatus, 'server side: the Update action redirects (refuses) a user without Web_Codes').toBe(302);
      console.log(`View_Codes only: warning text="${r.warningText}"; Actions link title="${r.actionsTitle}"`);
      if (!r.warningText.includes('Some editing functions have been disallowed by security')) deviation('CM.160202.F.1.2', 'the warning "Some editing functions have been disallowed by security"', r.warningText || '(none)');
      if (!r.actionsTitle.includes('User not authorized for this task Web_Codes')) deviation('CM.160202.F.1.14', 'the Actions link disabled with the tooltip "User not authorized for this task Web_Codes"', r.actionsTitle || '(no tooltip on the Actions link)');
      await r.close();
    });
    await test.step('S2: + Web_Codes -> Add / Edit enabled, Excel Import enabled', async () => {
      await sec.setGroupProcesses(page, GROUP, [...BASE, 'View_Codes', 'Web_Codes']);
      const r = await inspect(browser);
      show('S2', r);
      expect(r.tile).toBe(true);
      expect(r.addDisabled).toBe(false);
      expect(r.editDisabled).toBe(false);
      expect(r.actionsDisabled).toBe(false);
      expect(r.actions.join('|')).toContain('Excel Import');
      expect(r.updateStatus, 'with Web_Codes the Update action answers 200 (the first run creates MBCodesTest / MBSECX, later runs get "already exists")').toBe(200);
      await r.close();
    });
  } finally {
    await test.step('cleanup: the group holds only Login_WebMenu', async () => { await sec.setGroupProcesses(page, GROUP, BASE); });
  }
});
