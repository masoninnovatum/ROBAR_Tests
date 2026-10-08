// Lot Management security (headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only). Processes: LE_View_Lots (module), LE_Add_Lots (Add), LE_Chg_Lots (Edit; also decides Edit vs View window on
// double-click), LE_Del_Lots (Delete), EI_Lots (Excel Import). The MB user also needs a Print Entity (ROBAR) to see any lot (user absent from UserPrintEntity = no records).
// Part 1: icon / menu state per process. Part 2 (documented gap, see the DIT tracker): the Add / Edit / Delete actions are NOT re-checked on the server -- a user with ONLY LE_View_Lots posts
// AddRecord (oper add / edit) and calls DeleteRecord from his own page and the changes happen. Throw-away lots MBLSEC<n><stamp> are created by the test user and deleted again.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Locator, Page } from '@playwright/test';
import { login, loginAs, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as du from '../support/dynamic-ui';
import { setUserPrintEntities } from '../support/print-entity';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const ITEM = 'MI080301';
const BASE = ['Login_WebMenu', 'LE_View_Lots'];

test('Lot Management security: icons per process, view-only window, and the missing server-side checks', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  const stamp = Date.now().toString().slice(-6);
  const lots = { L1: `MBLSEC1${stamp}`, L2: `MBLSEC2${stamp}`, L3: `MBLSEC3${stamp}`, L4: `MBLSEC4${stamp}` };
  let g: Frame;

  const fill = async (dlg: Locator, values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) await dlg.locator(`[name="${name}"]`).fill(value);
  };
  const search = async (f: Frame, p: Page, column: string, operator: string, value: string, expectRows = true) => {
    await du.retrieve(p, f, column, operator, value, { expectRows: false });
    if (expectRows) await f.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
    else await p.waitForTimeout(4000);
    return du.rows(f);
  };
  const openLots = async (p: Page, reset = true): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    if (!reset) return f;
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    return du.reopenDynamicUi(p, 'Lot Management');
  };
  /** the MB user in a second context with Lot Management open and pageID captured from the GridSessionStart request */
  const asMb = async () => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    let pageID = '';
    p.on('request', (r) => {
      if (r.url().includes('/DynamicUI/GridSessionStart') && r.method() === 'POST') {
        const body = r.postData() ?? '';
        try {
          pageID = (JSON.parse(body).pageID as string) || pageID;
        } catch {
          pageID = (body.match(/pageID=([0-9A-F]+)/i) ?? [])[1] ?? pageID;
        }
      }
    });
    let gridSession = '';
    p.on('response', async (r) => {
      if (r.url().includes('/DynamicUI/GridSessionStart') && r.request().method() === 'POST') gridSession = (await r.text().catch(() => '')).slice(0, 400);
    });
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2000);
    const f = await openLots(p);
    return { p, f, getPageID: () => pageID, getGridSession: () => gridSession, close: () => ctx.close() };
  };
  const navState = async (f: Frame) => {
    const out: Record<string, boolean> = {};
    for (const icon of ['add', 'edit', 'view', 'del'] as const) out[icon] = await du.navEnabled(f, icon);
    return out;
  };
  /** Excel Import menu item visible? (rendered in the DOM but display:none without EI_Lots) */
  const importVisible = async (f: Frame, p: Page) => {
    await f.locator('a:has-text("Actions")').first().click();
    await p.waitForTimeout(500);
    const visible = await f.locator('ul li a').filter({ hasText: 'Excel Import' }).first().isVisible();
    await f.locator('a:has-text("Actions")').first().click().catch(() => {});
    return visible;
  };
  const adminAdd = async (lot: string) => {
    const dlg = await du.openFormDialog(g, 'add');
    await fill(dlg, { OrderNum: `${lot}O`, LotNum: lot, ItemNumber: ITEM });
    await du.submitForm(g);
    await page.waitForTimeout(1500);
  };
  const adminDelete = async (lot: string) => {
    g = await openLots(page);
    const rows = await search(g, page, 'LotNum', 'Exactly Matches', lot, false);
    if (rows.length === 0) return;
    await du.selectGridRow(g, lot);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
  };

  try {
    await test.step('setup: group = Login_WebMenu + LE_View_Lots; the MB user gets the ROBAR Print Entity; the test user adds lots L1, L2, L3', async () => {
      await login(page);
      await sec.setGroupProcesses(page, GROUP, BASE);
      await setUserPrintEntities(page, MB, ['ROBAR']);
      g = await openLots(page);
      await search(g, page, 'LotNum', 'Contains', 'MBMDPL');
      for (const lot of [lots.L1, lots.L2, lots.L3]) await adminAdd(lot);
      const rows = await search(g, page, 'LotNum', 'Contains', `MBLSEC`);
      expect(rows.filter((r) => r.includes(stamp))).toHaveLength(3);
    });

    await test.step('LE_View_Lots only: the user sees the lots (Print Entity ROBAR), Add / Edit / Delete icons are disabled, double-click opens the read-only View window, Excel Import is hidden', async () => {
      const u = await asMb();
      try {
        const rows = await search(u.f, u.p, 'LotNum', 'Contains', 'MBLSEC');
        expect(rows.filter((r) => r.includes(stamp))).toHaveLength(3);
        const nav = await navState(u.f);
        console.log(`S0 nav icons enabled: ${JSON.stringify(nav)}`);
        expect(nav.add).toBe(false);
        expect(nav.edit).toBe(false);
        expect(nav.del).toBe(false);
        await u.f.locator('tr.jqgrow').filter({ hasText: lots.L2 }).dblclick();
        await u.p.waitForTimeout(2500);
        const title = (await u.f.locator('.ui-jqdialog:visible').first().innerText()).replace(/\s+/g, ' ').slice(0, 60);
        console.log(`S0 double-click window: ${title}`);
        expect(title).toContain('View Record');
        await u.f.locator('.ui-jqdialog:visible #cData, .ui-jqdialog:visible .ui-jqdialog-titlebar-close').first().click({ timeout: 5000 }).catch(() => {});
        expect(await importVisible(u.f, u.p), 'Excel Import hidden without EI_Lots').toBe(false);
      } finally {
        await u.close();
      }
    });

    await test.step('SERVER-SIDE (documented gap): with ONLY LE_View_Lots the user can still edit L2, add L4 and delete L1 by calling the endpoints from his page', async () => {
      const u = await asMb();
      try {
        await search(u.f, u.p, 'LotNum', 'Contains', 'MBLSEC');
        const pageID = u.getPageID();
        console.log(`captured pageID: ${pageID}`);
        expect(pageID).toBeTruthy();
        const post = (body: Record<string, string>) =>
          u.f.evaluate(async (b) => {
            const r = await fetch('/InnoPages/DynamicUI/AddRecord', { method: 'POST', body: new URLSearchParams(b), headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, credentials: 'same-origin' });
            return `${r.status} ${(await r.text()).slice(0, 200)}`;
          }, body);
        const today = new Date();
        const mdy = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
        // edit L2 (no Edit authorization)
        const l2Id = (await u.f.locator('tr.jqgrow').filter({ hasText: lots.L2 }).first().getAttribute('id')) ?? '';
        const edit = await post({ oper: 'edit', id: l2Id, grdJqGrid_id: l2Id, DUI_PageID: pageID, OrderNum: `${lots.L2}O`, LotNum: lots.L2, ItemNumber: ITEM, PrintEntity: 'ROBAR', Expires: mdy, Manufactured: mdy, Reassay: mdy, U1: '', U2: '', U3: 'srv-edit', U4: '', U5: '' });
        console.log(`edit without LE_Chg_Lots -> ${edit}`);
        // add L4 (no Add authorization)
        // (no separate `id` key: the real Add dialog posts only grdJqGrid_id=_empty, and an extra `id` made the INSERT list the Id column twice)
        const add = await post({ oper: 'add', grdJqGrid_id: '_empty', DUI_PageID: pageID, OrderNum: `${lots.L4}O`, LotNum: lots.L4, ItemNumber: ITEM, PrintEntity: 'ROBAR', Expires: mdy, Manufactured: mdy, Reassay: mdy, U1: '', U2: '', U3: '', U4: '', U5: '' });
        console.log(`add without LE_Add_Lots -> ${add}`);
        // delete L1: select its row (grid session) then DeleteRecord (no Delete authorization)
        await u.f.locator('tr.jqgrow').filter({ hasText: lots.L1 }).first().click();
        await u.p.waitForTimeout(1000);
        const gs = u.getGridSession();
        console.log(`GridSessionStart response: ${gs}`);
        const l1Id = (await u.f.locator('tr.jqgrow').filter({ hasText: lots.L1 }).first().getAttribute('id')) ?? '';
        // the page's own delete call uses the DYNAMIC UI PAGE id as sessionId (ResumeSession reads Session["DynamicUI.*." + id]) and the selected grid row(s)
        const gridSessionId = gs.replace(/"/g, '');
        const tryDelete = (sid: string) =>
          u.f.evaluate(async ([rowId, s]) => {
            const r = await fetch(`/InnoPages/DynamicUI/DeleteRecord?id=${rowId}&oper=del&sessionId=${s}`, { credentials: 'same-origin' });
            return `${r.status} ${(await r.text()).replace(/\s+/g, ' ').slice(0, 120)}`;
          }, [l1Id, sid]);
        let del = await tryDelete(gridSessionId);
        console.log(`delete without LE_Del_Lots, sessionId = grid session id -> ${del}`);
        if (!del.startsWith('200')) del = await tryDelete(pageID);
        console.log(`delete without LE_Del_Lots -> ${del}`);
      } finally {
        await u.close();
      }
      // what happened, seen by the test user
      g = await openLots(page);
      const rows = await search(g, page, 'LotNum', 'Contains', 'MBLSEC');
      const mine = rows.filter((r) => r.includes(stamp));
      console.log(`lots after the server-side attempts: ${JSON.stringify(mine)}`);
      // CURRENT behaviour (documented gap, DIT tracker): with ONLY LE_View_Lots all three server calls took effect. If these assertions start failing the server-side checks were added.
      expect(mine.some((r) => r.includes(lots.L2) && r.includes('srv-edit')), 'edit without LE_Chg_Lots took effect').toBe(true);
      expect(mine.some((r) => r.includes(lots.L4)), 'add without LE_Add_Lots took effect').toBe(true);
      expect(mine.some((r) => r.includes(lots.L1)), 'delete without LE_Del_Lots took effect (the call itself answers HTTP 500 AFTER deleting)').toBe(false);
    });
  } finally {
    await test.step('cleanup: delete the throw-away lots, remove the Print Entity from the MB user, leave the group without processes', async () => {
      try {
        for (const lot of Object.values(lots)) await adminDelete(lot);
      } catch (e) {
        console.log(`lot cleanup skipped: ${String(e).slice(0, 160)}`);
      }
      await setUserPrintEntities(page, MB, []).catch((e) => console.log(`entity cleanup skipped: ${String(e).slice(0, 120)}`));
      await sec.setGroupProcesses(page, GROUP, []);
    });
  }
});
