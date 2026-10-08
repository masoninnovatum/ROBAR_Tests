// Lot Management (live 2026-10-06, Claude01, headless): DynamicUI page `DynamicUI?Heading=Lot_Management&Definition=Lots`. Grid columns Actions, ID, OrderNum, LotNum, ItemNumber, PrintEntity, Expires,
// Manufactured, Reassay, U1-U5, LastTouch; Actions menu: Excel Import, Excel Export, Audit, Save Search, Load Search, Adjust Page Size; jqGrid nav icons add / edit / view / del.
// Edit dialog: ItemNumber, PrintEntity and LastTouch are disabled. One throw-away lot (MBLMO<stamp>/MBLML<stamp>, item MI080301) is added, searched, edited, viewed and deleted again.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login } from '../support/robar';
import * as du from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

test('Lot Management: grid, search, add (validation), edit, view, delete, audit', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const order = `MBLMO${stamp}`;
  const lot = `MBLML${stamp}`;
  const ITEM = 'MI080301';
  let g: Frame;

  const open = async (): Promise<Frame> => {
    const f = await du.reopenDynamicUi(page, 'Lot Management');
    await f.click('#btnReset').catch(() => {});
    await page.waitForTimeout(3000);
    return du.reopenDynamicUi(page, 'Lot Management');
  };
  const search = async (column: string, operator: string, value: string, expectRows = true): Promise<string[]> => {
    const r = await du.retrieve(page, g, column, operator, value, { expectRows: false });
    if (expectRows) await g.locator('tr.jqgrow').first().waitFor({ timeout: 40_000 });
    else await page.waitForTimeout(4000);
    return du.rows(g);
  };
  const fill = async (dlg: import('@playwright/test').Locator, values: Record<string, string>) => {
    for (const [name, value] of Object.entries(values)) await dlg.locator(`[name="${name}"]`).fill(value);
  };

  await test.step('grid anatomy: columns, nav icons, Actions menu', async () => {
    g = await open();
    await search('LotNum', 'Contains', 'MBMDPL');
    const headers = (await g.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(headers).toEqual(['Actions', 'ID', 'OrderNum', 'LotNum', 'ItemNumber', 'PrintEntity', 'Expires', 'Manufactured', 'Reassay', 'U1', 'U2', 'U3', 'U4', 'U5', 'LastTouch']);
    for (const icon of ['add', 'edit', 'view', 'del'] as const) await expect(g.locator(`#${icon}_grdJqGrid`)).toBeVisible();
    await g.locator('a:has-text("Actions")').first().click();
    await page.waitForTimeout(500);
    expect((await g.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Excel Import', 'Excel Export', 'Audit', 'Save Search', 'Load Search', 'Adjust Page Size']);
    await g.locator('a:has-text("Actions")').first().click().catch(() => {});
  });

  await test.step('Add: ItemNumber / PrintEntity defaults; a valid lot is added and found by an exact LotNum search', async () => {
    g = await open();
    await search('LotNum', 'Contains', 'MBMDPL');
    const dlg = await du.openFormDialog(g, 'add');
    expect(await dlg.locator('[name="PrintEntity"]').inputValue()).toBe('ROBAR');
    await fill(dlg, { OrderNum: order, LotNum: lot, ItemNumber: ITEM, U1: 'pw-u1' });
    await du.submitForm(g);
    console.log(`add result error line: "${await du.formError(g)}"`);
    await page.waitForTimeout(2000);
    const rows = await search('LotNum', 'Exactly Matches', lot);
    console.log(`added lot row: ${rows[0]}`);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toContain(order);
    expect(rows[0]).toContain(ITEM);
    expect(rows[0]).toContain('ROBAR');
    expect(rows[0]).toContain('pw-u1');
  });

  /** Add dialog submit: created = the dialog closed; otherwise the form error line is returned and the dialog is cancelled. */
  const tryAdd = async (values: Record<string, string>): Promise<{ created: boolean; error: string }> => {
    const dlg = await du.openFormDialog(g, 'add');
    await fill(dlg, values);
    await du.submitForm(g);
    await page.waitForTimeout(1500);
    if ((await g.locator('.ui-jqdialog:visible').count()) === 0) return { created: true, error: '' };
    const error = await du.formError(g);
    await du.cancelForm(g);
    return { created: false, error };
  };
  /** Selects the row containing `text` (after the caller searched) and deletes it through the trash icon + confirmation. */
  const deleteRow = async (target: string | import('@playwright/test').Locator) => {
    if (typeof target === 'string') await du.selectGridRow(g, target);
    else await target.first().click({ timeout: 5000 });
    await page.waitForTimeout(500);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
  };

  await test.step('Add validation: NO field is required (a blank record is accepted once; a second blank record is "Record already exists"), a duplicate lot is refused', async () => {
    g = await open();
    await search('LotNum', 'Exactly Matches', lot);
    const first = await tryAdd({});
    console.log(`blank add #1: ${JSON.stringify(first)}`);
    const second = await tryAdd({});
    console.log(`blank add #2: ${JSON.stringify(second)}`);
    expect(second.created, 'a second identical (blank) record is refused').toBe(false);
    expect(second.error).toContain('Record already exists');
    const dup = await tryAdd({ OrderNum: order, LotNum: lot, ItemNumber: ITEM });
    console.log(`duplicate lot add: ${JSON.stringify(dup)}`);
    expect(dup.created).toBe(false);
    expect(dup.error).toContain('Record already exists');
    // clean up the blank record we may have just created (today's blank ROBAR record only)
    await search('LotNum', 'Is Blank', '', false);
    await page.waitForTimeout(3000);
    const today = new Date();
    const mdy = `${String(today.getMonth() + 1).padStart(2, '0')}/${String(today.getDate()).padStart(2, '0')}/${today.getFullYear()}`;
    const blanks = (await du.rows(g)).filter((r) => r.startsWith('Actions ROBAR') && r.includes(mdy) && !/hello/.test(r));
    console.log(`blank ROBAR records dated today: ${JSON.stringify(blanks)}`);
    if (blanks.length === 1) {
      // the blank ROBAR record = a row with the ROBAR entity that is not one of the older blank records (those carry "England" / "hello")
      await deleteRow(g.locator('tr.jqgrow').filter({ hasText: 'ROBAR' }).filter({ hasNotText: /England|hello/ }));
      await search('LotNum', 'Is Blank', '', false);
      await page.waitForTimeout(3000);
      expect((await du.rows(g)).filter((r) => r.startsWith('Actions ROBAR') && r.includes(mdy) && !/hello/.test(r)), 'the blank record created today is gone').toEqual([]);
    }
  });

  await test.step('Add with an UNKNOWN item number (observed): the lot is created or refused', async () => {
    g = await open();
    await search('LotNum', 'Contains', 'MBMDPL'); // the nav icons (add / edit / view / del) exist only after a Retrieve
    const unknown = await tryAdd({ OrderNum: `${order}X`, LotNum: `${lot}X`, ItemNumber: 'NOSUCHITEM999' });
    console.log(`unknown item add: ${JSON.stringify(unknown)}`);
    if (unknown.created) {
      await search('LotNum', 'Exactly Matches', `${lot}X`);
      await deleteRow(`${lot}X`);
      expect(await search('LotNum', 'Exactly Matches', `${lot}X`, false)).toEqual([]);
    }
  });

  await test.step('search operators: Contains, Exactly Matches on Order / Item / Print Entity, and no results', async () => {
    g = await open();
    expect((await search('OrderNum', 'Exactly Matches', order)).length).toBe(1);
    expect((await search('LotNum', 'Contains', `MBLML${stamp.slice(0, 4)}`)).some((r) => r.includes(lot))).toBe(true);
    const byItem = await search('ItemNumber', 'Exactly Matches', ITEM);
    expect(byItem.every((r) => r.includes(ITEM))).toBe(true);
    const byEntity = await search('PrintEntity', 'Exactly Matches', 'ROBAR');
    expect(byEntity.every((r) => r.includes('ROBAR'))).toBe(true);
    const none = await search('LotNum', 'Exactly Matches', 'NOLOT-DOES-NOT-EXIST', false);
    expect(none).toEqual([]);
    expect(await g.locator('body').innerText()).toMatch(/No records to view/i);
  });

  await test.step('Edit: ItemNumber, PrintEntity and LastTouch are read-only; changing Expires and U2 updates the grid', async () => {
    g = await open();
    await search('LotNum', 'Exactly Matches', lot);
    await du.selectGridRow(g, lot);
    const dlg = await du.openFormDialog(g, 'edit');
    for (const name of ['ItemNumber', 'PrintEntity', 'LastTouch']) expect(await dlg.locator(`[name="${name}"]`).isDisabled(), `${name} is read-only`).toBe(true);
    await fill(dlg, { U2: 'pw-u2', Expires: '12/31/2030' });
    await du.submitForm(g);
    console.log(`edit result error line: "${await du.formError(g)}"`);
    await page.waitForTimeout(2000);
    const rows = await search('LotNum', 'Exactly Matches', lot);
    console.log(`edited lot row: ${rows[0]}`);
    expect(rows[0]).toContain('pw-u2');
    expect(rows[0]).toMatch(/12\/31\/2030/);
  });

  await test.step('View: the read-only record window shows the lot', async () => {
    g = await open();
    await search('LotNum', 'Exactly Matches', lot);
    await du.selectGridRow(g, lot);
    const dlg = await du.openFormDialog(g, 'view');
    const text = (await dlg.innerText()).replace(/\s+/g, ' ');
    console.log(`view dialog: ${text.slice(0, 260)}`);
    expect(text).toContain(lot);
    await g.locator('.ui-jqdialog:visible #cData, .ui-jqdialog:visible .ui-jqdialog-titlebar-close').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(800);
  });

  await test.step('Audit action opens the audit trail for the lot (observed)', async () => {
    g = await open();
    await search('LotNum', 'Exactly Matches', lot);
    await du.selectGridRow(g, lot);
    await g.locator('a:has-text("Actions")').first().click();
    await page.waitForTimeout(500);
    await g.locator('ul:visible li a').filter({ hasText: 'Audit' }).click({ force: true });
    await page.waitForTimeout(5000);
    const url = page.frames().map((x) => x.url()).filter((u) => /Audit/i.test(u)).pop();
    console.log(`audit frame: ${url}`);
    const af = page.frames().filter((x) => /Audit/i.test(x.url())).pop();
    if (af) console.log(`audit text: ${(await af.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500)}`);
    else console.log(`audit dialogs: ${(await g.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').slice(0, 400)}`);
  });

  await test.step('Delete: asks to confirm; Cancel keeps the lot, Delete removes it', async () => {
    g = await open();
    await search('LotNum', 'Exactly Matches', lot);
    await du.selectGridRow(g, lot);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    const dlg = (await g.locator('.ui-jqdialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
    console.log(`delete dialog: ${dlg}`);
    expect(dlg).toContain('Delete selected record(s)?');
    await g.locator('.ui-jqdialog:visible #eData ~ a, .ui-jqdialog:visible .fm-button').filter({ hasText: 'Cancel' }).first().click();
    await page.waitForTimeout(800);
    expect((await search('LotNum', 'Exactly Matches', lot)).length).toBe(1);
    await du.selectGridRow(g, lot);
    await g.click('#del_grdJqGrid');
    await page.waitForTimeout(1200);
    await g.locator('.ui-jqdialog:visible .fm-button').filter({ hasText: 'Delete' }).first().click();
    await page.waitForTimeout(3000);
    expect(await search('LotNum', 'Exactly Matches', lot, false)).toEqual([]);
  });
});
