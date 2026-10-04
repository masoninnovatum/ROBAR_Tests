// Field Definitions Management (Main Menu "Field Defs Management" -> InnoPages/FieldDefsManagement/Management), re-derived live
// 2026-10-04 as Claude01. Headless. Only the MB fixture label type MBLT1 is touched (a caption / sharename edit, restored):
// field definitions are per Label Type and renaming one is reflected on every Item Edit page of that label type. NOTHING is created:
// "Create New Field Definitions" is only opened and cancelled (it clones a whole field set and "cannot be undone").
//   * layout: Label Type dropdown, Actions (Create New Field Definitions / Item Screen Layout), criteria widget, Advanced Options
//   * grid (84 definitions for MBLT1), filters
//   * Edit Record dialog: what is editable; edit + restore
//   * Create New Field Definitions dialog: lists, confirmation (cancelled)
// Gotchas: Limit Results is PERSISTED per user (set it explicitly); the persisted criteria row must be removed or filled -- Retrieve
// with a blank row returns nothing (and crashed the tab once).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { openMenuItem, login, findFrame } from '../support/robar';
import * as dui from '../support/dynamic-ui';

const LABEL_TYPE = 'MBLT1';

test('Field Definitions Management: layout, grid, filters, Edit Record (edit + restore) and the Create New dialog', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);
  await openMenuItem(page, 'Field Defs Management');
  let f: Frame = await findFrame(page, 'FieldDefs');
  await f.locator('#ddlLabelTypes').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);

  const selectLabelType = async (name: string) => {
    await f.locator('#ddlLabelTypes').selectOption({ label: name }, { timeout: 5000 });
    await page.waitForTimeout(1500);
  };
  const removeCriteria = async () => {
    while ((await f.locator('.criteriaFilter-Filter').count()) > 0) {
      await f.locator('.criteriaFilter-Filter span:has-text("Remove"), .criteriaFilter-Filter a:has-text("Remove")').first().click({ timeout: 5000 });
      await page.waitForTimeout(400);
    }
  };
  const setLimit = async (n: number) => {
    await f.locator('#txtResultLimit').evaluate((el, v) => {
      const input = el as HTMLInputElement;
      input.value = String(v);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }, n);
  };
  const retrieveAll = async () => {
    await removeCriteria();
    await setLimit(1000);
    await f.click('#btnRetrieveData', { timeout: 5000 });
    await f.locator('tr.jqgrow').first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    return Number(((await f.locator('.ui-paging-info').innerText()).match(/of\s+(\d+)/) ?? [])[1] ?? 0);
  };
  const pagerTotal = async () => Number(((await f.locator('.ui-paging-info').innerText()).match(/of\s+(\d+)/) ?? [])[1] ?? 0);

  await test.step('layout: Label Type dropdown, Actions menu and criteria columns', async () => {
    const labelTypes = (await f.locator('#ddlLabelTypes option').allInnerTexts()).map((t) => t.trim());
    console.log(`label types with field definitions: ${labelTypes.length}`);
    expect(labelTypes[0]).toBe('(Default)');
    expect(labelTypes).toEqual(expect.arrayContaining(['Carton Label', LABEL_TYPE]));
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Create New Field Definitions', 'Item Screen Layout']);
    await f.locator('#drpMainActions').click();
    // criteria columns (the widget instance is "dvFilters", like Template Management)
    await selectLabelType(LABEL_TYPE);
    if ((await f.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
      await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await page.waitForTimeout(400);
    }
    expect((await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).map((t) => t.trim())).toEqual(['Caption', 'Column Name', 'Default Caption', 'File/Form', 'Sharename', 'Tab Name']);
    // Advanced Options: the grid's own column picker
    expect((await f.locator('#selectedLimitColumns option').allInnerTexts()).map((t) => t.trim())).toEqual(['Label Type', 'File/Form', 'Caption', 'Default Caption', 'Sharename']);
    expect(await f.locator('#availableLimitColumns option').allInnerTexts()).toEqual(
      expect.arrayContaining(['Column Name', 'Field Type', 'Tab Name', 'Sample Data', 'Drop Down', 'Read Only', 'Drop Down Language', 'Validate', 'Translate', 'Decimals', 'Fixed Length', 'Column'])
    );
  });

  await test.step('grid: all field definitions of MBLT1, with the persisted-limit pitfall', async () => {
    const total = await retrieveAll();
    console.log(`MBLT1 field definitions: ${total}`);
    expect(total, 'MBLT1 carries a full cloned set of field definitions').toBe(84);
    expect(await f.locator('tr.jqgrow').count(), 'default page size 10').toBe(10);
    const headers = (await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
    expect(headers.slice(0, 6)).toEqual(['Id', 'Label Type', 'File/Form', 'Caption', 'Default Caption', 'Sharename']);
    // a small Limit Results truncates silently
    await setLimit(25);
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(3000);
    expect(await pagerTotal(), 'Limit Results 25 caps the retrieve').toBe(25);
    await retrieveAll();
  });

  await test.step('criteria: File/Form, Column Name and Sharename filters', async () => {
    await setLimit(1000);
    const containers = await dui.retrieve(page, f, 'FileForm', 'Exactly Matches', 'containers');
    expect(containers.length).toBeGreaterThan(0);
    for (const r of containers) expect(r).toContain('containers');
    const containersTotal = await pagerTotal();
    const lot = await dui.retrieve(page, f, 'ReplacementString', 'Exactly Matches', 'C_Lot');
    console.log(`C_Lot rows: ${JSON.stringify(lot)}`);
    expect(lot.length).toBe(1);
    expect(lot[0]).toContain('C_Lot');
    const bySharename = await dui.retrieve(page, f, 'ReplacementString', 'Contains', 'C_Lo');
    expect(bySharename.length).toBe(1);
    // OBSERVED: the underscore in a Contains value acts as a single-character WILDCARD (SQL LIKE, not escaped): "C_" matches
    // "F_City" (C + any char = "Ci"), not only sharenames that contain the literal "C_".
    const wild = await dui.retrieve(page, f, 'ReplacementString', 'Contains', 'C_');
    const nonLiteral = wild.filter((r) => !r.includes('C_'));
    console.log(`Contains "C_" total ${await pagerTotal()}; rows without a literal "C_": ${nonLiteral.length} e.g. ${JSON.stringify(nonLiteral.slice(0, 2))}`);
    test.info().annotations.push({ type: 'observation', description: `Contains "C_" also matches ${nonLiteral.length} row(s) without a literal "C_" -- "_" is a LIKE wildcard` });
    expect(containersTotal).toBeLessThan(84);
    await removeCriteria();
  });

  await test.step('Edit Record: Caption, Sharename, Sample Data, Drop Down and Validate are editable; Column Name / Field Type / Read Only / Translate are not', async () => {
    const rows = await dui.retrieve(page, f, 'ReplacementString', 'Exactly Matches', 'C_Lot');
    expect(rows.length).toBe(1);
    await dui.selectGridRow(f, 'C_Lot');
    const d = await dui.openFormDialog(f, 'edit');
    const text = (await d.innerText()).replace(/\s+/g, ' ');
    expect(text).toMatch(/File\/Form containers Column Name LotNum Field Type S/);
    const state = await d.locator('input, select').evaluateAll((els) => Object.fromEntries(els.filter((e) => (e as HTMLInputElement).id && (e as HTMLInputElement).id !== 'id_g').map((e) => [(e as HTMLInputElement).id, (e as HTMLInputElement).disabled ? 'disabled' : 'enabled'])));
    console.log(`edit dialog control states: ${JSON.stringify(state)}`);
    expect(state).toMatchObject({ CurrentCaption: 'enabled', ReplacementString: 'enabled', SampleData: 'enabled', IsDropDown: 'enabled', Validate: 'enabled', ReadOnly: 'disabled', Translate: 'disabled', DropDownLanguage: 'disabled' });
    await expect(d.locator('#CurrentCaption')).toHaveValue('Lot Number');
    await expect(d.locator('#ReplacementString')).toHaveValue('C_Lot');
    await expect(d.locator('#SampleData')).toHaveValue('Lot123456');
    expect((await d.locator('#DropDownLanguage option').allInnerTexts()).length, 'a long list of dictionary languages').toBeGreaterThan(10);

    // Edit caption + sample data, save, see it in the grid, then restore
    await d.locator('#CurrentCaption').fill('Lot Number PW');
    await d.locator('#SampleData').fill('LotPW999');
    await dui.submitForm(f);
    await page.waitForTimeout(2000);
    let after = await dui.retrieve(page, f, 'ReplacementString', 'Exactly Matches', 'C_Lot');
    console.log(`after edit: ${JSON.stringify(after)}`);
    expect(after[0]).toContain('Lot Number PW');
    await dui.selectGridRow(f, 'C_Lot');
    const d2 = await dui.openFormDialog(f, 'edit');
    await d2.locator('#CurrentCaption').fill('Lot Number');
    await d2.locator('#SampleData').fill('Lot123456');
    await dui.submitForm(f);
    await page.waitForTimeout(2000);
    after = await dui.retrieve(page, f, 'ReplacementString', 'Exactly Matches', 'C_Lot');
    expect(after[0]).not.toContain('Lot Number PW');
    expect(after[0]).toContain('Lot Number');
  });

  await test.step('Create New Field Definitions: dialog lists and the confirmation (cancelled -- nothing is created)', async () => {
    await removeCriteria();
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actNewFd').click({ force: true });
    await page.waitForTimeout(2000);
    const dialog = f.locator('#newFieldDefsDialog');
    await expect(dialog).toBeVisible();
    const nonFds = (await f.locator('#ddlNonFdsLabelTypes option').allInnerTexts()).map((t) => t.trim());
    const orig = (await f.locator('#ddlOrigLabelTypes option').allInnerTexts()).map((t) => t.trim());
    console.log(`create targets (label types WITHOUT field definitions): ${nonFds.length}; copy sources: ${orig.length}`);
    // the targets are exactly the label types that are not in the main dropdown
    await f.locator('#btnCancelNewFds').click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const main = (await f.locator('#ddlLabelTypes option').allInnerTexts()).map((t) => t.trim());
    expect(nonFds.filter((n) => main.includes(n)), 'no label type is both a target and already defined').toEqual([]);
    expect(nonFds).toEqual(expect.arrayContaining(['MBINDD', 'MBCustom', 'MBDOCX']));
    expect(orig).toEqual(expect.arrayContaining(['(Default)', 'Carton Label', LABEL_TYPE]));
    await expect(f.locator('#newFieldDefsDialog')).toBeHidden();
  });
});
