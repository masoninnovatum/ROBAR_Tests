// Multi Document Printing x Printer Control (live 2026-10-27, TST703, Claude01, HEADED). Exploration of how Printer Control rows drive the Labeling grid
// (ValMaster MDP.180418.F.15.7 / F.25.1 / F.25.13, script MDP_PrinterControl-1.10). Creates Printer Control rows for THIS workstation only (never touches the
// shared `* * * * N None` row) and deletes them again. NEVER clicks Print: only the grid is read, so no label / PDF is produced and no real printer is used.
// Results go to RESULT_FILE (json lines). Needs the Sentinel client on this machine (the module prompts "Open SentinelLauncher?" which is confirmed with FlaUI).

import { test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import { openDynamicUi, openFormDialog, submitForm, cancelForm, formError, retrieve, rows, selectGridRow, clearCriteria } from '../support/dynamic-ui';
import * as bartender from '../support/bartender';

test.use({ headless: false, actionTimeout: 20_000 });

const RESULT_FILE = process.env.MDP_PCM_OUT || 'C:/Users/Mason/AppData/Local/Temp/claude/C--DB-Copies-703-20198/e4ec88ac-6090-437d-9cae-956f20f41198/scratchpad/pcm_results.jsonl';
const WS = (process.env.COMPUTERNAME || 'MASON-LAPTOP').toUpperCase();
const ITEM = 'MI080301';
const TPL = 'A1TemplateMT';
const PDF = 'Microsoft Print to PDF';
const Z2 = 'Zebra 110Xi4 (300 dpi)';
const BAD = 'CLNoSuchPrinter';

type Row = { t: string; item: string; ws?: string; printer: string };
const SCENARIOS: { id: string; title: string; rows: Row[] }[] = [
  { id: 'S0', title: 'no Printer Control row for this workstation (baseline)', rows: [] },
  { id: 'S1', title: 'one specific row: item / template / workstation / PDF', rows: [{ t: TPL, item: ITEM, printer: PDF }] },
  { id: 'S2', title: 'wildcard-Item row only: * / template / workstation / PDF (item has no row of its own)', rows: [{ t: TPL, item: '*', printer: PDF }] },
  { id: 'S3', title: 'only an invalid printer name for the item', rows: [{ t: TPL, item: ITEM, printer: BAD }] },
  { id: 'S4', title: 'invalid specific row + valid wildcard-Item row (UAT step 8 shape)', rows: [{ t: TPL, item: ITEM, printer: BAD }, { t: TPL, item: '*', printer: PDF }] },
  { id: 'S5', title: 'two specific rows, same item/template, two printers (UAT step 10 shape)', rows: [{ t: TPL, item: ITEM, printer: PDF }, { t: TPL, item: ITEM, printer: Z2 }] },
  { id: 'S6', title: 'specific row (Zebra 110) + wildcard-Item row (PDF): union or specific-wins?', rows: [{ t: TPL, item: ITEM, printer: Z2 }, { t: TPL, item: '*', printer: PDF }] },
  { id: 'S7', title: 'Printer = * (wildcard printer)', rows: [{ t: TPL, item: ITEM, printer: '*' }] },
  { id: 'S8', title: 'Template = * (wildcard template)', rows: [{ t: '*', item: ITEM, printer: PDF }] },
  { id: 'S9', title: 'Workstation = * (wildcard workstation)', rows: [{ t: TPL, item: ITEM, ws: '*', printer: PDF }] },
  { id: 'S10', title: 'row for a different item only', rows: [{ t: TPL, item: 'CLOTHERITEM', printer: PDF }] },
  { id: 'S11', title: 'row for a template the item does not use', rows: [{ t: 'ADHOC1', item: ITEM, printer: PDF }] },
];

const rec = (o: unknown) => fs.appendFileSync(RESULT_FILE, JSON.stringify(o) + '\n');

test('MDP labeling grid vs Printer Control rows (no printing)', async ({ page }) => {
  test.setTimeout(1_500_000);
  fs.writeFileSync(RESULT_FILE, '');
  const pc = await openDynamicUi(page, 'Printer Control');
  let g: Frame | undefined;
  let pid = 0;
  const settle = async () => { if (!pid) pid = await bartender.resolveBrowserPid(page); await bartender.confirmSentinelLaunchPrompt(page, pid); };
  const pcTab = async () => { await settle(); await page.locator('li.ui-tabs-tab:has-text("Printer Control")').click({ timeout: 5000 }); await settle(); };
  const mdpTab = async () => {
    await settle();
    await page.getByRole('link', { name: 'Multi Document Printing' }).click({ timeout: 8000 });
    await page.waitForTimeout(1500);
    await settle();
    for (let i = 0; i < 20; i++) {
      const x = page.frames().filter((y) => y.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop();
      if (x && (await x.locator('input[name="FlexLot_OrderNum"]').isVisible().catch(() => false))) { g = x; return; }
      await page.waitForTimeout(1000);
    }
    throw new Error('MDP tab did not come to the front');
  };

  const mine = async (): Promise<string[]> => {
    await pcTab();
    return retrieve(page, pc, 'Workstation', 'Exactly Matches', WS, { expectRows: false });
  };
  const deleteMine = async () => {
    for (let i = 0; i < 12; i++) {
      const r = await mine();
      rec({ deleteMineIter: i, rows: r, delEnabled: await pc.locator('#del_grdJqGrid').getAttribute('class').catch(() => '?') });
      if (!r.length) return;
      void selectGridRow;
      // the grid is multi-select by checkbox column: tick the first data row's checkbox and wait for the Delete icon to enable
      await settle();
      const cb = pc.locator('tr.jqgrow').first().locator('input.cbox, input[type="checkbox"]').first();
      if (!(await cb.isChecked().catch(() => false))) await cb.click({ timeout: 5000 });
      await pc.locator('#del_grdJqGrid:not(.ui-state-disabled)').waitFor({ timeout: 8000 });
      await pc.click('#del_grdJqGrid', { timeout: 5000 });
      await pc.locator('#dData').click({ timeout: 8000 });
      await page.waitForTimeout(1500);
    }
    throw new Error('could not delete all my Printer Control rows');
  };
  const addRow = async (r: Row): Promise<string> => {
    await pcTab();
    // the grid (and its Add icon) is only drawn when Retrieve returns rows: with the shared "* * * * N None" row there is always at least one
    await settle();
    await retrieve(page, pc, 'Workstation', 'Exactly Matches', '*', { expectRows: true });
    const d = await openFormDialog(pc, 'add');
    await d.locator('#Template').selectOption({ label: r.t });
    await d.locator('#Item').fill(r.item);
    await d.locator('#Workstation').fill(r.ws ?? WS);
    await d.locator('#Printer').fill(r.printer);
    await submitForm(pc);
    const err = await formError(pc);
    if (err) await cancelForm(pc).catch(() => {});
    return err;
  };

  const openMdp = async (): Promise<Frame> => {
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await page.getByRole('button', { name: 'Multi Document Printing', exact: true }).click({ timeout: 10_000 });
    await page.waitForTimeout(4000);
    const pid = await bartender.resolveBrowserPid(page);
    await bartender.confirmSentinelLaunchPrompt(page, pid);
    for (let i = 0; i < 25; i++) {
      const x = page.frames().filter((y) => y.url().includes('MultiDocPrinting/MultiDocumentPrinting')).pop();
      if (x && (await x.locator('input[name="FlexLot_OrderNum"]').count()) > 0) return x;
      await page.waitForTimeout(1000);
    }
    throw new Error('MDP page did not load');
  };

  const readGrid = async (): Promise<unknown> => {
    const out: Record<string, unknown> = {};
    const dlg = page.locator('.ui-dialog:visible, [role="dialog"]:visible');
    out.dialog = (await dlg.count()) ? (await dlg.allInnerTexts()).join(' | ').replace(/\s+/g, ' ').slice(0, 300) : '';
    const trs = g!.locator('tr').filter({ has: g!.locator('select') });
    const n = await trs.count();
    const list: unknown[] = [];
    for (let i = 0; i < n; i++) {
      const tds = (await trs.nth(i).locator('td').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      if (tds.length < 8) continue;
      const sels = await trs.nth(i).locator('select').evaluateAll((els) => els.map((e: any) => ({ sel: e.selectedOptions[0]?.text, dis: e.disabled, n: e.options.length })));
      list.push({ printer: tds[tds.length - 1], template: tds[tds.length - 6], sels });
    }
    out.rows = list;
    const body = (await g!.locator('body').innerText()).replace(/s+/g, ' ');
    out.bodyHasLoaded = /Labeling/.test(body);
    out.bodySnippet = body.slice(0, 700);
    await page.screenshot({ path: RESULT_FILE.replace('.jsonl', `_${Date.now()}.png`) }).catch(() => {});
    return out;
  };

  const runMdp = async (id: string): Promise<unknown> => {
    await mdpTab();
    const stamp = Date.now().toString().slice(-5);
    await g!.locator('select').first().selectOption({ label: 'ROBAR' }).catch(() => {});
    await g!.locator('input[name="FlexLot_OrderNum"]').fill(`CLPCO${id}${stamp}`);
    await g!.locator('input[name="FlexLot_LotNum"]').fill(`CLPCL${id}${stamp}`);
    await g!.locator('input[name="FlexLot_ItemNumber"]').fill(ITEM);
    await g!.locator('input[name="FlexLot_ItemNumber"]').press('Tab');
    await g!.getByRole('button', { name: 'Next' }).click();
    await page.waitForTimeout(4000);
    await settle();
    await page.waitForTimeout(3000);
    const res = await readGrid();
    // dismiss a dialog if one is up, then reset
    for (const nm of [/^Continue$/, /^OK$/, /^Close$/]) {
      const b = g!.getByRole('button', { name: nm });
      if (await b.first().isVisible().catch(() => false)) { await b.first().click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(4000); await settle(); }
    }
    await g!.getByRole('button', { name: 'Reset' }).click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    await settle();
    return res;
  };

  try {
    await deleteMine(); // start clean (only rows of this workstation)
    g = await openMdp();
    const only = (process.env.MDP_PCM_ONLY || '').split(',').filter(Boolean);
    for (const s of SCENARIOS.filter((x) => !only.length || only.includes(x.id))) {
      await deleteMine();
      const errs: string[] = [];
      for (const r of s.rows) errs.push(await addRow(r));
      const pcRows = await mine();
      const result = await runMdp(s.id);
      rec({ id: s.id, title: s.title, rows: s.rows, addErrors: errs.filter(Boolean), pcRows, result });
    }
  } finally {
    await deleteMine().catch((e) => rec({ cleanupError: String(e) }));
    const left = await mine().catch(() => ['?']);
    rec({ cleanupLeftForWorkstation: left });
    await clearCriteria(page, pc).catch(() => {});
  }
  void (null as unknown as Page);
});
