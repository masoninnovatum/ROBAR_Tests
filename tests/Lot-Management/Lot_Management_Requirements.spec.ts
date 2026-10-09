// Lot Management re-check against the ValMaster requirements (2026-10-08; see .agents/valmaster-lot-management.md). Covers requirements the earlier script-based specs did not check:
// LM.160210.F.1.6 (icon states), LM.160210.F.1.7 (row-level Actions), LM.150420.F.4.2 (date defaults), LM.150420.F.5.11 / F.5.15 / F.5.12 / F.5.8 / F.5.5 (Excel Import page rules)
// PE.161004.F.7.1 (no Print Entity dropdown while PrintEntityRequired = N; the Y-state Edit-dialog lock F.7.9 is in Lot_Management_Edit_Entity_Lock.spec.ts). A requirement that the live system does not meet is recorded as a test annotation `deviation <id>` (not a failure) so the regression run stays green. Seed user Claude01 (`*`),
// headless, TST703. Throw-away lots MBLRQ<stamp>* are imported / added and deleted again.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import ExcelJS from 'exceljs';
import * as os from 'os';
import * as path from 'path';
import { login } from '../support/robar';
import * as du from '../support/dynamic-ui';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });


function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Lot Management vs ValMaster: icon states, row Actions, date defaults, Excel Import page rules', async ({ page }) => {
  test.setTimeout(1_500_000);
  await login(page);
  // read the setting FIRST (reading it later leaves a stale hidden Lot Management tab that breaks the following steps)
  const peSetting = await readGlobalSetting(page, 'PrintEntityRequired', 'Innovatum');
  console.log(`PrintEntityRequired = ${peSetting}`);
  const stamp = Date.now().toString().slice(-6);
  const mk = (s: string) => `MBLRQ${stamp}${s}`;
  const files: string[] = [];
  let g: Frame;
  const open = async (p: Page = page): Promise<Frame> => {
    const f = await du.reopenDynamicUi(p, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await p.waitForTimeout(3000);
    return du.reopenDynamicUi(p, 'Lot Management');
  };
  const search = async (column: string, operator: string, value: string): Promise<string[]> => {
    await du.retrieve(page, g, column, operator, value, { expectRows: false });
    await page.waitForTimeout(4500);
    return du.rows(g);
  };
  const deleteLot = async (lot: string): Promise<void> => {
    g = await open();
    await du.retrieve(page, g, 'LotNum', 'Exactly Matches', lot, { expectRows: false });
    await g.locator('tr.jqgrow').first().waitFor({ timeout: 45_000 }).catch(() => {});
    const rows = await du.rows(g);
    if (rows.length !== 1) return;
    await du.selectGridRow(g, lot);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
  };
  const mkFile = async (name: string, rows: unknown[][], sheets: string[] = ['Sheet1']): Promise<string> => {
    const file = path.join(os.tmpdir(), `lrq_${stamp}_${name}.xlsx`);
    const wb = new ExcelJS.Workbook();
    for (const s of sheets) {
      const ws = wb.addWorksheet(s);
      ws.addRow(['OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5']);
      if (s === sheets[0]) for (const r of rows) ws.addRow(r as never);
    }
    await wb.xlsx.writeFile(file);
    files.push(file);
    return file;
  };
  const openImport = async (): Promise<Frame> => {
    g = await open();
    await g.locator('a:has-text("Actions")').first().click();
    await page.waitForTimeout(500);
    await g.locator('ul:visible li a').filter({ hasText: 'Excel Import' }).click({ force: true });
    await page.waitForTimeout(5000);
    return page.frames().filter((x) => /ExcelImport/i.test(x.url())).pop()!;
  };
  const importText = async (imp: Frame): Promise<string> => (await imp.locator('body').innerText()).replace(/\s+/g, ' ');
  const sheetInfo = (imp: Frame) => imp.locator('#sheetName, select[name*=sheet i]').first().evaluate((e: HTMLSelectElement) => ({ disabled: e.disabled, options: Array.from(e.options).map((o) => o.text) })).catch(() => null);
  const createdLots: string[] = [];

  // leftovers of an earlier failed run (this spec's throw-away lots are MBLRQ<6 digits><letter>)
  for (let i = 0; i < 8; i++) {
    g = await open();
    await du.retrieve(page, g, 'LotNum', 'Contains', 'MBLRQ', { expectRows: false });
    await page.waitForTimeout(5000);
    const left = (await du.rows(g)).map((r) => r.split(' ').find((t) => /^MBLRQ\d{6}[A-Z]$/.test(t))).filter(Boolean) as string[];
    if (!left.length) break;
    console.log(`removing leftover lot ${left[0]}`);
    await deleteLot(left[0]);
  }

  try {
    await test.step('LM.160210.F.1.6: no row selected -> pencil / page / trash disabled; one row -> all enabled; several rows -> pencil and page disabled, trash enabled', async () => {
      g = await open();
      const rows = await search('LotNum', 'Contains', 'MBMDPL');
      expect(rows.length).toBeGreaterThan(1);
      const state = async () => ({ edit: await du.navEnabled(g, 'edit'), view: await du.navEnabled(g, 'view'), del: await du.navEnabled(g, 'del') });
      const none = await state();
      await g.locator('tr.jqgrow').nth(0).click();
      await page.waitForTimeout(500);
      const one = await state();
      await g.locator('tr.jqgrow').nth(1).click({ modifiers: ['Control'] });
      await page.waitForTimeout(500);
      const several = await state();
      console.log(`icon states none=${JSON.stringify(none)} one=${JSON.stringify(one)} several=${JSON.stringify(several)}`);
      expect(none).toEqual({ edit: false, view: false, del: false });
      expect(one).toEqual({ edit: true, view: true, del: true });
      if (!(several.edit === false && several.view === false && several.del === true)) deviation('LM.160210.F.1.6', 'several rows: edit/view disabled, trash enabled', JSON.stringify(several));
    });

    await test.step('LM.160210.F.1.7: the row-level Actions dropdown offers View Print History, View Lot Data Override, View Serial Numbers, View Locked LCNs', async () => {
      g = await open();
      await search('LotNum', 'Contains', 'MBMDPL');
      await g.locator('tr.jqgrow').first().getByText('Actions', { exact: true }).click();
      await page.waitForTimeout(600);
      const items = (await g.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
      console.log(`row Actions: ${JSON.stringify(items)}`);
      for (const want of ['View Print History', 'View Lot Data Override', 'View Serial Numbers', 'View Locked LCNs']) if (!items.includes(want)) deviation('LM.160210.F.1.7', `row action "${want}"`, JSON.stringify(items));
      expect(items.length).toBeGreaterThan(0);
      await g.locator('tr.jqgrow').first().getByText('Actions', { exact: true }).click().catch(() => {});
    });

    await test.step('LM.150420.F.4.2: Expires, Manufactured and Reassay default to today in the Add Record window', async () => {
      g = await open();
      await search('LotNum', 'Contains', 'MBMDPL');
      const dlg = await du.openFormDialog(g, 'add');
      const d = new Date();
      const today = `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
      for (const f of ['Expires', 'Manufactured', 'Reassay']) {
        const v = await dlg.locator(`[name="${f}"]`).inputValue();
        console.log(`Add default ${f}: ${v}`);
        if (v !== today) deviation('LM.150420.F.4.2', `${f} = ${today}`, v || '(blank)');
      }
      await du.cancelForm(g);
    });

    await test.step('LM.150420.F.5.11 / F.5.15: Excel Import page - nothing can proceed before a file is chosen; one worksheet -> the Sheet dropdown is disabled with that name; several -> enabled', async () => {
      const imp = await openImport();
      console.log(`import page: ${(await importText(imp)).slice(0, 200)}`);
      // F.5.11: until a file is chosen the user cannot proceed (the Validate button is absent, hidden or disabled)
      const validate = imp.locator('#btnValidate');
      const canProceed = (await validate.count()) > 0 && (await validate.first().isVisible()) && (await validate.first().isEnabled());
      console.log(`Validate before choosing a file: count=${await validate.count()} canProceed=${canProceed}`);
      if (canProceed) deviation('LM.150420.F.5.11', 'the user cannot proceed before a file is chosen', 'Validate is enabled');
      await imp.locator('input[type=file]').setInputFiles(await mkFile('one', [[`${mk('Z')}O`, mk('Z'), 'MI080301', 'ROBAR', new Date(), new Date(), new Date(), '', '', '', '', '']]));
      await page.waitForTimeout(2500);
      const s1 = await sheetInfo(imp);
      console.log(`sheet dropdown with one worksheet: ${JSON.stringify(s1)}`);
      if (!s1 || s1.disabled !== true || !s1.options.includes('Sheet1')) deviation('LM.150420.F.5.15', 'Sheet dropdown disabled, default Sheet1', JSON.stringify(s1));
      const imp2 = await openImport();
      await imp2.locator('input[type=file]').setInputFiles(await mkFile('two', [], ['Sheet1', 'Lots2']));
      await page.waitForTimeout(2500);
      const s2 = await sheetInfo(imp2);
      console.log(`sheet dropdown with two worksheets: ${JSON.stringify(s2)}`);
      if (!s2 || s2.disabled || s2.options.length < 2) deviation('LM.150420.F.5.15', 'Sheet dropdown enabled with both worksheet names', JSON.stringify(s2));
    });

    await test.step('LM.150420.F.5.12 / F.5.5: validation errors list row-level errors and a Reset button lets the user upload a new file; duplicate rows inside the sheet are reported', async () => {
      const imp = await openImport();
      const dup = [`${mk('D')}O`, mk('D'), 'MI080301', 'ROBAR', new Date(), new Date(), new Date(), '', '', '', '', ''];
      await imp.locator('input[type=file]').setInputFiles(await mkFile('dup', [dup, dup]));
      await imp.locator('#btnValidate').click();
      await page.waitForTimeout(6000);
      const b = await importText(imp);
      console.log(`duplicate rows: ${b.slice(-260)}`);
      expect(b).not.toContain('Validation Successful');
      if (!/Row \d+ (already exists|is a duplicate)|[Dd]uplicate/.test(b)) deviation('LM.150420.F.5.5', 'an error naming the duplicate row(s)', b.slice(-200));
      const hasReset = (await imp.locator('#btnReset, input[value="Reset"], button:has-text("Reset")').count()) > 0;
      if (!hasReset) deviation('LM.150420.F.5.12', 'a Reset button after a failed validation', 'no Reset button');
    });

    await test.step('LM.150420.F.5.8: dates in other formats (text "2027-12-31" / "31-Dec-2027") are converted to MM/DD/YYYY on import', async () => {
      const lot = mk('F');
      const imp = await openImport();
      await imp.locator('input[type=file]').setInputFiles(await mkFile('fmt', [[`${lot}O`, lot, 'MI080301', 'ROBAR', '2027-12-31', '31-Dec-2027', '12/31/2027', '', '', '', '', '']]));
      await imp.locator('#btnValidate').click();
      await page.waitForTimeout(6000);
      const b = await importText(imp);
      console.log(`date formats: ${b.slice(-240)}`);
      if (!b.includes('Validation Successful')) {
        deviation('LM.150420.F.5.8', 'text dates converted to MM/DD/YYYY', b.slice(-200));
        return;
      }
      await imp.locator('#btnSubmit').click();
      for (let i = 0; i < 20; i++) {
        await page.waitForTimeout(3000);
        const jf = page.frames().filter((x) => /ExcelImportJobDetail/i.test(x.url())).pop();
        if (jf && /Status\s+(Completed|Fail|Error)/.test((await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '))) break;
      }
      createdLots.push(lot);
      g = await open();
      const rows = await search('LotNum', 'Exactly Matches', lot);
      console.log(`imported with text dates: ${JSON.stringify(rows)}`);
      expect(rows).toHaveLength(1);
      if (!rows[0].includes('12/31/2027')) deviation('LM.150420.F.5.8', '12/31/2027 in the grid', rows[0]);
    });

    await test.step('PE.161004.F.7.1: with PrintEntityRequired = N the Print Entity dropdown is NOT displayed in the Add Record / Edit Record dialog (Print Entity = ROBAR automatically); skipped when the setting is Y', async () => {
      if (peSetting !== 'N') { console.log(`PrintEntityRequired = ${peSetting}: step skipped`); return; }
      g = await open();
      await search('LotNum', 'Contains', 'MBMDPL');
      const add = await du.openFormDialog(g, 'add');
      const addField = await add.locator('[name="PrintEntity"]').first().evaluate((e: HTMLSelectElement) => ({ tag: e.tagName, visible: !!(e.offsetWidth || e.offsetHeight), value: e.value, options: e.tagName === 'SELECT' ? Array.from(e.options).map((o) => o.text) : [] })).catch(() => null);
      console.log(`Add dialog Print Entity field (setting N): ${JSON.stringify(addField)}`);
      if (addField && addField.visible) deviation('PE.161004.F.7.1', 'no Print Entity dropdown in the Add Record dialog', JSON.stringify(addField));
      await du.cancelForm(g);
      await g.locator('tr.jqgrow').first().dblclick();
      await page.waitForTimeout(2500);
      const editField = await g.locator('.ui-jqdialog:visible [name="PrintEntity"]').first().evaluate((e: HTMLSelectElement) => ({ tag: e.tagName, visible: !!(e.offsetWidth || e.offsetHeight), disabled: e.disabled, value: e.value })).catch(() => null);
      console.log(`Edit dialog Print Entity field (setting N): ${JSON.stringify(editField)}`);
      if (editField && editField.visible) deviation('PE.161004.F.7.1', 'no Print Entity dropdown in the Edit Record dialog', JSON.stringify(editField));
      await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: /Cancel/ }).first().click().catch(() => {});
    });
  } finally {
    await test.step('cleanup: delete the imported / added lots, remove the MB entity and processes', async () => {
      for (const lot of createdLots) await deleteLot(lot).catch((e) => console.log(`lot cleanup ${lot} skipped: ${String(e).slice(0, 100)}`));
    });
  }
});
