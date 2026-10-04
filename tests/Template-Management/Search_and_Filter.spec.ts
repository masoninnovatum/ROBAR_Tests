// Template Management search & filter (TM_Search&Filter-1.5, re-derived live 2026-10-04 as Claude01): Column/Operator/Value rows
// (widget instance "dvFilters"), the Approved dropdown (#drpApprove), Latest Version Only / Effective Only, Filter by Data Source
// (#chkFilterByDataSource + the multi-select share-name list), Limit Results, paging and Reset. Headless -- nothing is created or
// changed. Needs templates whose names start with MBGDMD (Get_Data_Master_Data.spec.ts creates them; this spec only reads) and
// MBSide (Cross-Module/Template_Item_MDM_LCN_Release.spec.ts): UNAPPROVED, bound to md_brand (from A1SuperTemplate) vs APPROVED,
// bound to I_Num only.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test('Template Management search and filter: criteria rows, operators, Approved dropdown, data source, limits, paging, reset', async ({ page }) => {
  test.setTimeout(420_000);
  await login(page);
  await openMenuItem(page, 'Template Management');
  let f: Frame = await findFrame(page, 'TemplateManagement');
  await page.waitForTimeout(3000);

  const reset = async () => {
    await f.click('#btnReset', { timeout: 5000 });
    await page.waitForTimeout(1500);
    f = await findFrame(page, 'TemplateManagement');
    // Reset does NOT clear "Filter by Data Source" (the checkbox and its selection are persisted per user and survive Reset),
    // so put it back explicitly -- otherwise a stale data-source filter silently narrows every later query.
    // The last search is persisted on Retrieve, so unchecking alone comes back after the next reload: untick, run one Retrieve to
    // persist it, then Reset again.
    await page.waitForTimeout(1500);
    if (await f.locator('#chkFilterByDataSource').isChecked()) {
      await f.locator('#chkFilterByDataSource').uncheck();
      await page.waitForTimeout(500);
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), f.click('#btnRetrieveData', { timeout: 5000 })]);
      await page.waitForTimeout(2000);
      await f.click('#btnReset', { timeout: 5000 });
      await page.waitForTimeout(2500);
      f = await findFrame(page, 'TemplateManagement');
    }
  };
  const addRow = async () => {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await page.waitForTimeout(400);
  };
  const setRow = async (i: number, column: string, operator: string, value?: string) => {
    await f.locator(`select[name="dvFilters[${i}].Column"]`).selectOption(column, { timeout: 5000 });
    await f.locator(`select[name="dvFilters[${i}].Operator"]`).selectOption(operator, { timeout: 5000 });
    if (value !== undefined) await f.locator(`input[name="dvFilters[${i}].Value"]`).fill(value, { timeout: 5000 });
  };
  /** Retrieve Data; returns the rows of the CURRENT page as { name, cells } and the pager total. */
  const retrieve = async () => {
    await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), f.click('#btnRetrieveData', { timeout: 5000 })]);
    await page.waitForTimeout(2500);
    const texts = (await f.locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').replace('Actions', '').trim());
    const info = (await f.locator('.ui-paging-info').allInnerTexts()).join(' ');
    const total = Number((info.match(/of\s+(\d+)/) ?? [])[1] ?? texts.length);
    return { rows: texts, names: texts.map((t) => t.split(' ')[0]), total, info };
  };

  await test.step('page layout: Main Actions, filter controls and grid columns', async () => {
    await reset();
    await expect(f.locator('#drpApprove option')).toHaveText(['Approved Only', 'Unapproved Only', 'Approved and Unapproved']);
    expect(await f.locator('#drpApprove').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text), 'default').toBe('Approved and Unapproved');
    for (const id of ['#chkLatestVersion', '#chkEffectiveOnly', '#chkFilterByDataSource']) await expect(f.locator(id), `${id} is off by default`).not.toBeChecked();
    await expect(f.locator('#txtResultLimit')).toHaveValue('500');
    await expect(f.locator('#dataSourceDropdownContainer'), 'the data source list is hidden until the checkbox is ticked').toBeHidden();
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Create New Template']);
    await f.locator('#drpMainActions').click();
    await expect(f.locator('#drpActions'), 'Bulk Actions are not available before a search').toBeHidden();

    await addRow();
    expect(await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).toEqual([
      'Approval Date Time', 'Approved By', 'Description', 'Document Owner', 'Effective Begin', 'Effective End', 'Label Type', 'Template Name', 'Version',
    ]);
    // The operator list depends on the column's type: the default first column (Approval Date Time) has no Is Blank / Is Not Blank.
    const operatorsFor = async (column: string) => {
      await f.locator('select[name="dvFilters[0].Column"]').selectOption(column, { timeout: 5000 });
      await page.waitForTimeout(500);
      return (await f.locator('select[name="dvFilters[0].Operator"] option').allInnerTexts()).map((t) => t.trim());
    };
    const textOps = ['Contains', 'Does Not Match', 'Does Not Contain', 'In', 'Not In', 'Greater Than', 'Less Than', 'Exactly Matches', 'Is Blank', 'Is Not Blank'];
    expect(await operatorsFor('LabelName'), 'text column').toEqual(textOps);
    console.log(`operators for ApprovalDateTime: ${JSON.stringify(await operatorsFor('ApprovalDateTime'))}`);
    console.log(`operators for VersionNumber: ${JSON.stringify(await operatorsFor('VersionNumber'))}`);
    await setRow(0, 'LabelName', 'Contains', 'MBGDMD');
    const r = await retrieve();
    expect((await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual([
      'Id', 'Actions', 'Template Name', 'Label Type', 'Version', 'Description', 'Effective Begin', 'Effective End', 'Approved By', 'Approval Date Time', 'Document Owner',
    ]);
    expect(r.total, 'at least the templates Get_Data_Master_Data created').toBeGreaterThanOrEqual(3);
    for (const n of r.names) expect(n).toMatch(/^MBGDMD/);
    // unapproved templates show an empty Approved By and the 1/1/1900 sentinel date
    expect(r.rows[0]).toContain('1/1/1900');

    await f.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual([
      'View/Edit Template', 'View/Edit Comments', 'View Label Characteristics', 'Replace Template', 'Edit Attributes', 'Download', 'Save As New',
    ]);
    await f.locator('#grdJqGrid tr.jqgrow').first().getByText('Actions', { exact: true }).click();
    await f.locator('#grdJqGrid tr.jqgrow input[type=checkbox]').first().check();
    await expect(f.locator('#drpActions')).toBeVisible({ timeout: 5000 });
    await f.locator('#drpActions').click();
    await page.waitForTimeout(500);
    expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Approve Templates', 'Retire Templates', 'Submit to Workflow', 'Download']);
    await f.locator('#drpActions').click();
  });

  await test.step('operators on Template Name', async () => {
    await reset();
    await addRow();
    await setRow(0, 'LabelName', 'Contains', 'MBGDMD');
    const base = await retrieve();
    const [a, b] = base.names;
    await setRow(0, 'LabelName', 'ExactlyMatches', a);
    expect((await retrieve()).names).toEqual([a]);
    await setRow(0, 'LabelName', 'In', `${a},${b}`);
    expect((await retrieve()).names.sort()).toEqual([a, b].sort());
    await setRow(0, 'LabelName', 'In', `${a};${b}`);
    expect((await retrieve()).total, 'a semicolon is NOT a list separator for In (comma only)').toBe(0);
    await setRow(0, 'LabelName', 'NotIn', `${a},${b}`);
    await f.locator('select[name="dvFilters[0].Operator"]').selectOption('NotIn');
    const notIn = await retrieve();
    expect(notIn.names).not.toContain(a);
    expect(notIn.names).not.toContain(b);
    await setRow(0, 'LabelName', 'DoesNotContain', 'MB');
    const dnc = await retrieve();
    for (const n of dnc.names) expect(n).not.toContain('MB');
    await setRow(0, 'LabelName', 'DoesNotMatch', a);
    expect((await retrieve()).names).not.toContain(a);
    // two rows combine (default AND): name contains MBGDMD AND Approved By blank
    await setRow(0, 'LabelName', 'Contains', 'MBGDMD');
    await addRow();
    await setRow(1, 'ApprovedBy', 'IsBlank');
    const blank = await retrieve();
    expect(blank.total).toBe(base.total);
    await setRow(1, 'ApprovedBy', 'IsNotBlank');
    expect((await retrieve()).total, 'none of the MBGDMD templates is approved').toBe(0);
  });

  await test.step('Approved dropdown combines with the criteria rows (AND)', async () => {
    await reset();
    await addRow();
    await setRow(0, 'LabelName', 'Contains', 'MB');
    await expect(f.locator('.criteriaFilter-Filter')).toHaveCount(1);
    await f.locator('#drpApprove').selectOption({ label: 'Unapproved Only' });
    await page.waitForTimeout(1500);
    // CHANGED since the 2026-09-14 note / formal script: the criteria row is NOT removed any more and there is no "Filter will take
    // precedence" dialog -- the dropdown and the criteria rows are simply combined (AND).
    await expect(f.locator('.criteriaFilter-Filter'), 'the criteria row stays').toHaveCount(1);
    await expect(f.locator('.ui-dialog:visible'), 'no confirmation dialog').toHaveCount(0);
    const un = await retrieve();
    await expect(f.locator('.ui-dialog:visible')).toHaveCount(0);
    for (const row of un.rows) expect(row.toLowerCase(), 'both filters apply: name contains MB').toContain('mb');
    expect(un.total).toBeGreaterThan(0);
    for (const row of un.rows) expect(row, 'unapproved: no approval date').toContain('1/1/1900');
    await f.locator('#drpApprove').selectOption({ label: 'Approved Only' });
    const ap = await retrieve();
    expect(ap.total).toBeGreaterThan(0);
    for (const row of ap.rows) expect(row, 'approved: a real approval date').not.toContain('1/1/1900');
    await f.locator('#drpApprove').selectOption({ label: 'Approved and Unapproved' });
    const both = await retrieve();
    expect(both.total).toBeGreaterThanOrEqual(ap.total + un.total - 1);
  });

  await test.step('Limit Results, Latest Version Only, Effective Only and paging', async () => {
    await reset();
    await addRow();
    await setRow(0, 'LabelName', 'Contains', 'MBGDMD');
    const all = await retrieve();
    expect(all.total).toBeGreaterThanOrEqual(3);
    await f.locator('#txtResultLimit').fill('2');
    expect((await retrieve()).total, 'Limit Results caps the retrieve').toBe(2);
    await f.locator('#txtResultLimit').fill('500');
    await f.locator('#chkLatestVersion').check();
    expect((await retrieve()).total, 'every MBGDMD template has a single version, so Latest Version Only keeps them all').toBe(all.total);
    await f.locator('#chkLatestVersion').uncheck();
    await f.locator('#chkEffectiveOnly').check();
    expect((await retrieve()).total, 'effective 10/4/2026 - 12/31/2099 = effective now').toBe(all.total);
    await f.locator('#chkEffectiveOnly').uncheck();

    // paging: 10 per page by default; the page-size select (class .ui-pg-selbox) offers 10 / 20 / 30
    await reset();
    await f.locator('#drpApprove').selectOption({ label: 'Approved and Unapproved' });
    const wide = await retrieve();
    console.log(`all templates: ${wide.info}`);
    expect(wide.rows.length).toBe(10);
    expect(wide.total).toBeGreaterThan(10);
    expect(await f.locator('.ui-pg-selbox').first().locator('option').evaluateAll((o) => o.map((x) => (x as HTMLOptionElement).value))).toEqual(['10', '20', '30']);
    await f.locator('.ui-pg-selbox').first().selectOption('30');
    await page.waitForTimeout(2500);
    expect(await f.locator('#grdJqGrid tr.jqgrow').count()).toBe(30);
  });

  await test.step('Filter by Data Source: the multi-select share-name list narrows the templates', async () => {
    await reset();
    await f.locator('#chkFilterByDataSource').check();
    await expect(f.locator('#dataSourceDropdownContainer')).toBeVisible();
    await f.locator('#dataSourceSelector').click();
    await expect(f.locator('#dataSourceDropdown')).toBeVisible({ timeout: 5000 });
    const names = (await f.locator('#dataSourceDropdown li span').allInnerTexts()).map((t) => t.trim());
    console.log(`data sources listed: ${names.length}`);
    expect(names[0]).toBe('Select All');
    expect(names).toEqual(expect.arrayContaining(['I_Num', 'I_Desc', 'md_brand', 'md_primedi', 'L_LotNumber']));
    const box = (n: string) => f.locator('#dataSourceDropdown li').filter({ has: f.locator('span', { hasText: new RegExp('^' + n + '$') }) }).locator('input');
    await box('md_brand').check();
    await f.locator('#dataSourceSelector').click().catch(() => {});
    // combine with a Template Name row so the result is the (few) templates this suite created
    await addRow();
    await setRow(0, 'LabelName', 'Contains', 'MBGDMD');
    const withBrand = await retrieve();
    console.log(`md_brand + name MBGDMD: ${withBrand.total}`);
    expect(withBrand.total, 'the MBGDMD templates (from A1SuperTemplate) are bound to md_brand').toBeGreaterThanOrEqual(3);
    await setRow(0, 'LabelName', 'Contains', 'MBSide');
    expect((await retrieve()).total, 'MBSide templates bind only I_Num, not md_brand').toBe(0);

    await f.locator('#dataSourceSelector').click();
    await box('md_brand').uncheck();
    await box('I_Num').check();
    await f.locator('#dataSourceSelector').click().catch(() => {});
    const withNum = await retrieve();
    expect(withNum.total, 'MBSide templates bind I_Num').toBeGreaterThanOrEqual(1);
    for (const n of withNum.names) expect(n).toMatch(/^MBSide/);

    // ticking the checkbox OFF means the data source selection is ignored again
    await f.locator('#chkFilterByDataSource').uncheck();
    await setRow(0, 'LabelName', 'Contains', 'MBGDMD');
    expect((await retrieve()).total).toBeGreaterThanOrEqual(3);
  });

  await test.step('Reset restores the defaults', async () => {
    await f.locator('#drpApprove').selectOption({ label: 'Approved Only' });
    await f.locator('#chkLatestVersion').check();
    await f.locator('#txtResultLimit').fill('7');
    await f.locator('#chkFilterByDataSource').check();
    await f.click('#btnReset', { timeout: 5000 });
    await page.waitForTimeout(2500);
    f = await findFrame(page, 'TemplateManagement');
    const dataSourceAfterReset = await f.locator('#chkFilterByDataSource').isChecked();
    console.log(`after a raw Reset click, Filter by Data Source is ${dataSourceAfterReset ? 'STILL CHECKED' : 'unchecked'}`);
    test.info().annotations.push({ type: 'observation', description: `Reset leaves "Filter by Data Source" ${dataSourceAfterReset ? 'CHECKED (not reset)' : 'unchecked'}` });
    await reset();
    expect(await f.locator('#drpApprove').evaluate((s) => (s as HTMLSelectElement).selectedOptions[0].text)).toBe('Approved and Unapproved');
    await expect(f.locator('#chkLatestVersion')).not.toBeChecked();
    await expect(f.locator('#txtResultLimit')).toHaveValue('500');
    await expect(f.locator('.criteriaFilter-Filter')).toHaveCount(0);
  });
});
