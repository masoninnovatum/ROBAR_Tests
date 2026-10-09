// Destination Labeling security gating (live 2026-10-08, headless, TST703). Requirements: DL.171227.F.1.1 (page access), F.5.2 (Create Order), F.19.1 (Print Multiple Copies), F.23.1 (Require Verification),
// F.13.1 (Reset All / Action column: BP_Dest_EditWorklist), F.22.1 (Print All: BP_Dest_PrintAll) -- unauthorized controls must NOT be displayed. The MB fixture group MBPWLoginGrp / user MBPWLogin01 get ONE process more per
// state (second browser context for the MB user, the seed user edits the group; MB only). The tile process is BP_DestinationLabeling (the requirement text says "BP_DestLabeling"). Reset All / Print All / the Action
// column only exist for an order WITH worklist rows (PICKDETAIL rows need an external insert: not testable from the UI). One order is created per run by the MB user (orders cannot be deleted).
// Ends with the group holding no processes.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { loginAs, openMenuItem, PASSWORD } from '../support/robar';
import * as sec from '../support/security';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const BASE = ['Login_WebMenu'];
const frame = (p: Page): Frame => p.frames().filter((x) => /DestLabeling\/DestLabeling/i.test(x.url())).pop()!;

interface Seen { tile: boolean; opened: boolean; body: string; vis: Record<string, boolean>; afterOrder: Record<string, boolean> | null }

async function inspect(browser: Browser, createOrder: boolean): Promise<Seen> {
  const ctx = await browser.newContext();
  const p = await ctx.newPage();
  try {
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2000);
    const tile = (await p.locator('button.menuIcon:has-text("Destination Labeling")').count()) > 0;
    const out: Seen = { tile, opened: false, body: '', vis: {}, afterOrder: null };
    if (!tile) return out;
    await openMenuItem(p, 'Destination Labeling');
    await p.waitForTimeout(8000);
    const f = frame(p);
    if (!f) return out;
    out.opened = true;
    out.body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const sel of ['#orderNumberInput', '#submitOrderNumberButton', '#createOrderButton', '#requireVerification']) out.vis[sel] = await f.locator(sel).isVisible();
    if (createOrder && out.vis['#createOrderButton']) {
      await f.locator('#createOrderButton').click();
      await p.waitForTimeout(5000);
      await f.locator('#destSelect').selectOption({ index: 1 }).catch(() => {});
      await p.waitForTimeout(3000);
      out.afterOrder = {};
      for (const sel of ['#changeCopiesCheckbox', '#autoPrintLabel', '#autoPrintDoc', '#barcodeEntry', '#btnPrintAllWorklist', '#btnResetAllWorklist']) out.afterOrder[sel] = await f.locator(sel).isVisible();
    }
    return out;
  } finally {
    await ctx.close();
  }
}

test('Destination Labeling: each BP_Dest_* process switches on its own control; the tile needs BP_DestinationLabeling', async ({ page, browser }) => {
  test.setTimeout(1_200_000);
  sec.assertMb(GROUP);
  await sec.openSecurity(page); // logs in itself (a second login() would wait for a login form that is not there)
  const state = async (extra: string[]) => { await sec.setGroupProcesses(page, GROUP, [...BASE, ...extra]); };
  const show = (label: string, r: Seen) => console.log(`${label}: tile=${r.tile} opened=${r.opened} vis=${JSON.stringify(r.vis)} afterOrder=${JSON.stringify(r.afterOrder)}`);
  try {
    await test.step('S0: only Login_WebMenu -> no tile (F.1.1)', async () => {
      await state([]);
      const r = await inspect(browser, false);
      show('S0', r);
      expect(r.tile).toBe(false);
    });
    let procs = ['BP_DestinationLabeling'];
    await test.step('S1: + BP_DestinationLabeling -> the page opens with Pick Order; Create Order / Require Verification are NOT displayed (F.5.2, F.23.1)', async () => {
      await state(procs);
      const r = await inspect(browser, false);
      show('S1', r);
      expect(r.tile).toBe(true);
      expect(r.opened).toBe(true);
      for (const t of ['Pick Order', 'Order Number', 'Order Status']) expect(r.body).toContain(t);
      expect(r.vis['#orderNumberInput']).toBe(true);
      expect(r.vis['#submitOrderNumberButton']).toBe(true);
      expect(r.vis['#createOrderButton'], 'F.5.2: Create Order not displayed without BP_Dest_CreateOrder').toBe(false);
      expect(r.vis['#requireVerification'], 'F.23.1: Require Verification not displayed without BP_Dest_RequireVerification').toBe(false);
    });
    await test.step('+ BP_Dest_CreateOrder -> Create Order is displayed', async () => {
      procs = [...procs, 'BP_Dest_CreateOrder'];
      await state(procs);
      const r = await inspect(browser, true);
      show('+CreateOrder', r);
      expect(r.vis['#createOrderButton']).toBe(true);
      expect(r.vis['#requireVerification']).toBe(false);
      expect(r.afterOrder?.['#changeCopiesCheckbox'], 'F.19.1: Print Multiple Copies not displayed without BP_Dest_PrintMultipleCopies').toBe(false);
      expect(r.afterOrder?.['#btnPrintAllWorklist'], 'F.22.1: Print All not displayed without BP_Dest_PrintAll').toBe(false);
      expect(r.afterOrder?.['#btnResetAllWorklist'], 'F.13.1: Reset All not displayed without BP_Dest_EditWorklist').toBe(false);
    });
    await test.step('+ BP_Dest_RequireVerification -> the Require Verification checkbox is displayed (F.23.1)', async () => {
      procs = [...procs, 'BP_Dest_RequireVerification'];
      await state(procs);
      const r = await inspect(browser, false);
      show('+RequireVerification', r);
      expect(r.vis['#requireVerification']).toBe(true);
    });
    await test.step('+ BP_Dest_PrintMultipleCopies -> Print Multiple Copies is displayed once an order and destination are chosen (F.19.1)', async () => {
      procs = [...procs, 'BP_Dest_PrintMultipleCopies'];
      await state(procs);
      const r = await inspect(browser, true);
      show('+PrintMultipleCopies', r);
      expect(r.afterOrder?.['#changeCopiesCheckbox']).toBe(true);
    });
  } finally {
    await test.step('cleanup: the group holds no processes', async () => { await sec.setGroupProcesses(page, GROUP, []).catch(() => {}); });
  }
});
