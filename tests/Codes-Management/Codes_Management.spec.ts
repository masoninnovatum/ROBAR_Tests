// Codes Management (live 2026-10-08, headless, TST703, seed user). InnoPages/Codes/Management ("Codes Management"): CriteriaFilter `dvFilters[n]` (columns CodeType / Code / Description / Active),
// "Retrieve Data" button, jqGrid #grdJqGrid (Code Type, Code, Description, Active; pager 10 / 20 / 30), Add / Edit icons in the grid footer (no delete), Actions menu = Excel Import only.
// The Add / Edit dialog (#editmodgrdJqGrid) has a select2 "tags" Code Type box, Code, Description and an Active checkbox (Y / N).
// Codes CANNOT be deleted: this spec only creates codes of the type MBCodesTest (one new MBCT<stamp> per run) and only edits those; it never edits seeded codes.
// Gotcha (cost an accidental edit of SendAllWFEmails/Workflow during exploration): for CodeType / Active the "Exactly Matches" Value box is a <select>, other operators use a text input;
// `.fill()` on the wrong kind times out and the grid silently stays unfiltered, so always assert the filtered count before editing the first row.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const TYPE = 'MBCodesTest';

/** A ValMaster requirement (source of truth) the live system does not meet: recorded as a test annotation, not a failure. */
function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

const frameOf = (page: Page): Frame => page.frames().filter((x) => /InnoPages\/Codes\/Management/i.test(x.url())).pop()!;
const rowsOf = async (page: Page): Promise<string[]> => (await frameOf(page).locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
const infoOf = async (page: Page): Promise<string> => (await frameOf(page).locator('.ui-paging-info').allInnerTexts()).join(' ').trim();
const totalOf = async (page: Page): Promise<number> => Number(/of (\d+)/.exec(await infoOf(page))?.[1] ?? NaN);

async function retrieve(page: Page): Promise<void> {
  const f = frameOf(page);
  await Promise.all([page.waitForResponse((r) => r.url().includes('GridSessionStart'), { timeout: 20_000 }).catch(() => null), f.click('#btnRetrieveData')]);
  await page.waitForTimeout(2500);
}

/** One criteria row (added when missing). Exactly Matches on CodeType / Active shows a <select>; every other operator a text box; Is (Not) Blank hides the Value box. */
async function filter(page: Page, column: string, operator: string, value?: string): Promise<void> {
  const f = frameOf(page);
  if ((await f.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(500);
  }
  await f.locator('select[name="dvFilters[0].Column"]').selectOption(column);
  await f.locator('select[name="dvFilters[0].Operator"]').selectOption(operator);
  await page.waitForTimeout(500);
  if (value !== undefined) {
    // the Value editor is rebuilt when the column / operator changes: wait until either kind is present
    const sel = f.locator('select[name="dvFilters[0].Value"]');
    const txt = f.locator('input[name="dvFilters[0].Value"]:visible');
    for (let i = 0; i < 20 && (await sel.count()) + (await txt.count()) === 0; i++) await page.waitForTimeout(250);
    if (await sel.count()) await sel.selectOption(value);
    else await txt.first().fill(value);
  }
  await retrieve(page);
}

async function openAdd(page: Page): Promise<Frame> {
  const f = frameOf(page);
  await f.click('#add_grdJqGrid');
  await expect(f.locator('#editmodgrdJqGrid')).toBeVisible();
  await page.waitForTimeout(1200);
  return f;
}
async function submitDialog(page: Page): Promise<string> {
  const f = frameOf(page);
  await f.locator('#sData').click();
  await page.waitForTimeout(2500);
  return (await f.locator('#FormError:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ').trim();
}
async function cancelDialog(page: Page): Promise<void> {
  const f = frameOf(page);
  await f.locator('#cData').click();
  await expect(f.locator('#editmodgrdJqGrid')).toBeHidden();
}
async function pickType(page: Page, type: string): Promise<void> {
  const f = frameOf(page);
  await f.locator('.select2-selection').first().click();
  await f.locator('.select2-search__field').first().fill(type);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(600);
}

test('Codes Management: anatomy, filters, sort / paging, Add validations and create, Edit rules', async ({ page }) => {
  test.setTimeout(900_000);
  const stamp = Date.now().toString().slice(-6);
  const CODE = `MBCT${stamp}`;
  await login(page);
  await openMenuItem(page, 'Codes Management');
  await findFrame(page, 'InnoPages/Codes/Management');
  await page.waitForTimeout(4000);

  await test.step('page anatomy: heading, grid columns, pager, Actions = Excel Import only', async () => {
    const f = frameOf(page);
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    for (const t of ['Codes Management', 'Actions', 'Add Filter', 'Code Type', 'Code', 'Description', 'Active']) expect(body).toContain(t);
    await expect(f.locator('#btnRetrieveData')).toHaveValue('Retrieve Data');
    // the grid loads all codes on open (no Retrieve needed)
    expect(await totalOf(page)).toBeGreaterThan(100);
    expect((await rowsOf(page)).length).toBe(10);
    expect(await f.locator('select.ui-pg-selbox option').allInnerTexts()).toEqual(['10', '20', '30']);
    await expect(f.locator('#add_grdJqGrid')).toBeVisible();
    await expect(f.locator('#edit_grdJqGrid')).toBeVisible();
    expect(await f.locator('#del_grdJqGrid').count(), 'there is no delete icon').toBe(0);
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(400);
    expect(await f.locator('ul:visible li a').allInnerTexts()).toEqual(['Excel Import']);
    await page.keyboard.press('Escape');
    await f.locator('body').click({ position: { x: 5, y: 5 } }).catch(() => {});
  });

  await test.step('filter columns and operators', async () => {
    const f = frameOf(page);
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(500);
    expect(await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).toEqual(['CodeType', 'Code', 'Description', 'Active']);
    expect(await f.locator('select[name="dvFilters[0].Operator"] option').allInnerTexts()).toEqual(['Contains', 'Does Not Match', 'Does Not Contain', 'In', 'Not In', 'Greater Than', 'Less Than', 'Exactly Matches', 'Is Blank', 'Is Not Blank']);
  });

  await test.step('Contains / In / Exactly Matches (dropdown) / Is Blank / Active', async () => {
    await filter(page, 'Code', 'Is Not Blank'); // "all" (a Contains with an EMPTY value does not reload the grid: the previous result stays)
    const all = await totalOf(page);
    expect(all).toBeGreaterThan(100);
    await filter(page, 'CodeType', 'Contains', 'Reprint');
    const contains = await totalOf(page);
    expect(contains).toBeGreaterThan(0);
    expect(contains).toBeLessThan(all);
    expect((await rowsOf(page)).every((r) => /reprint/i.test(r))).toBe(true);
    await filter(page, 'CodeType', 'Does Not Contain', 'Reprint');
    expect(await totalOf(page), 'Contains + Does Not Contain = all').toBe(all - contains);
    await filter(page, 'CodeType', 'In', 'Symbols,Rules');
    const inCount = await totalOf(page);
    expect((await rowsOf(page)).every((r) => /^(Symbols|Rules) /.test(r))).toBe(true);
    await filter(page, 'CodeType', 'Not In', 'Symbols,Rules');
    expect(await totalOf(page)).toBe(all - inCount);
    await filter(page, 'CodeType', 'Exactly Matches', 'Symbols');
    expect((await rowsOf(page)).every((r) => r.startsWith('Symbols '))).toBe(true);
    await filter(page, 'Description', 'Is Blank');
    const blank = await totalOf(page);
    await filter(page, 'Description', 'Is Not Blank');
    expect(await totalOf(page), 'Is Blank + Is Not Blank = all').toBe(all - blank);
    await filter(page, 'Active', 'Exactly Matches', 'N');
    expect((await rowsOf(page)).every((r) => / N$/.test(r))).toBe(true);
    await filter(page, 'Active', 'Exactly Matches', 'Y');
    expect((await rowsOf(page)).every((r) => / Y$/.test(r))).toBe(true);
    await filter(page, 'Code', 'Greater Than', '0185');
    const gt = await totalOf(page);
    await filter(page, 'Code', 'Less Than', '0185');
    console.log(`Greater Than 0185: ${gt}; Less Than 0185: ${await totalOf(page)}; all ${all}`);
  });

  await test.step('sort by a column header toggles ascending / descending; page size 20 / 30', async () => {
    const f = frameOf(page);
    await filter(page, 'Code', 'Is Not Blank');
    await f.locator('#jqgh_grdJqGrid_code').click();
    await page.waitForTimeout(2500);
    const asc = (await rowsOf(page)).map((r) => r);
    await f.locator('#jqgh_grdJqGrid_code').click();
    await page.waitForTimeout(2500);
    const desc = (await rowsOf(page)).map((r) => r);
    console.log(`first row asc: ${asc[0]} | desc: ${desc[0]}`);
    expect(asc[0]).not.toBe(desc[0]);
    await f.locator('select.ui-pg-selbox').selectOption('30');
    await page.waitForTimeout(2500);
    expect((await rowsOf(page)).length).toBe(30);
    await f.locator('select.ui-pg-selbox').selectOption('10');
    await page.waitForTimeout(2000);
  });

  await test.step('Add dialog: required fields, duplicate, too long, Active defaults ticked, existing type typed in the select2 box', async () => {
    let f = await openAdd(page);
    expect(await f.locator('#active').isChecked(), 'Active defaults to ticked').toBe(true);
    expect(await f.locator('#codetype').isDisabled()).toBe(false);
    expect(await submitDialog(page)).toContain('Code Type: Field is required');
    deviation('CM.160202.F.2.4', '"CodeType: Field is required"', '"Code Type: Field is required" (with a space)');
    await pickType(page, 'Symbols'); // an existing type typed into the tags box selects the existing option
    expect(await f.locator('#codetype').inputValue()).toBe('Symbols');
    expect((await f.locator('#codetype option').allInnerTexts()).filter((t) => t === 'Symbols').length, 'no duplicate option created').toBe(1);
    expect(await submitDialog(page)).toContain('Code: Field is required');
    await f.locator('#code').fill('0169');
    expect(await submitDialog(page)).toContain('CodeType/Code combination already exists');
    deviation('CM.160202.F.2.9', 'This CodeType/Code combination already exists', 'CodeType/Code combination already exists (no "This")');
    await expect(f.locator('#editmodgrdJqGrid')).toBeVisible();
    await f.locator('#code').fill('X'.repeat(300));
    expect(await submitDialog(page)).toContain('Code exceeds the maximum allowed 30 characters length');
    await cancelDialog(page);
    f = await openAdd(page);
    await pickType(page, 'T'.repeat(300));
    await f.locator('#code').fill('toolong');
    const typeErr = await submitDialog(page);
    console.log(`Code Type too long -> ${typeErr}`);
    expect(typeErr).toMatch(/maximum allowed/i);
    await cancelDialog(page);
  });

  await test.step(`create ${TYPE} / ${CODE}: appears unfiltered-by-Active, Active Y`, async () => {
    const f = await openAdd(page);
    await pickType(page, TYPE);
    expect(await f.locator('#codetype').inputValue()).toBe(TYPE);
    await f.locator('#code').fill(CODE);
    await f.locator('#description').fill('Playwright code');
    await f.locator('#sData').click();
    await expect(f.locator('#editmodgrdJqGrid')).toBeHidden({ timeout: 10_000 });
    await filter(page, 'Code', 'Contains', CODE); // the test type keeps growing (codes cannot be deleted): look up this run's codes only
    const rows = (await rowsOf(page)).filter((r) => r.includes(CODE));
    expect(rows).toEqual([`${TYPE} ${CODE} Playwright code Y`]);
  });

  await test.step('creating a second code in the SAME type keeps one type option; blank description is allowed', async () => {
    const f = await openAdd(page);
    expect(await f.locator('#codetype option').allInnerTexts()).toContain(TYPE);
    await pickType(page, TYPE);
    await f.locator('#code').fill(`${CODE}B`);
    await f.locator('#active').uncheck();
    await f.locator('#sData').click();
    await expect(f.locator('#editmodgrdJqGrid')).toBeHidden({ timeout: 10_000 });
    await filter(page, 'Code', 'Contains', CODE);
    expect((await rowsOf(page)).filter((r) => r.includes(`${CODE}B`))).toEqual([`${TYPE} ${CODE}B N`]);
  });

  await test.step('Edit: Code Type and Code are read-only, Description / Active editable; double-click opens Edit; edit persists', async () => {
    await filter(page, 'Code', 'Contains', CODE);
    const f = frameOf(page);
    const row = f.locator(`#grdJqGrid tr.jqgrow:has(td[aria-describedby$="_code"]:text-is("${CODE}"))`).first(); // textContent has no spaces between cells, so match the Code cell exactly
    await row.dblclick();
    await expect(f.locator('#editmodgrdJqGrid')).toBeVisible();
    await page.waitForTimeout(1200);
    expect(await f.locator('#codetype').isDisabled()).toBe(true);
    expect(await f.locator('#code').isDisabled()).toBe(true);
    expect(await f.locator('#code').inputValue()).toBe(CODE);
    expect(await f.locator('#description').isDisabled()).toBe(false);
    await f.locator('#description').fill('Playwright code (edited)');
    await f.locator('#active').uncheck();
    await f.locator('#sData').click();
    await expect(f.locator('#editmodgrdJqGrid')).toBeHidden({ timeout: 10_000 });
    await filter(page, 'Code', 'Contains', CODE);
    expect((await rowsOf(page)).filter((r) => r.includes(`${CODE} `))).toContain(`${TYPE} ${CODE} Playwright code (edited) N`);
    // Edit icon with no row selected
    await f.locator('#grdJqGrid tr.jqgrow').first().click();
    await f.click('#edit_grdJqGrid');
    await expect(f.locator('#editmodgrdJqGrid')).toBeVisible();
    await cancelDialog(page);
  });

  await test.step('CM.160202.F.1.9 / F.1.10 / F.1.8 / F.1.3: several criteria rows with AND / OR drop-downs; "No records to view" when nothing matches; the grid is shown on open (not only after Retrieve Data)', async () => {
    const f = frameOf(page);
    await filter(page, 'Code', 'Contains', 'zzzz-no-match-zzzz');
    const body = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`no match: rows=${(await rowsOf(page)).length}; "No records to view" shown=${body.includes('No records to view')}`);
    if (!body.includes('No records to view')) deviation('CM.160202.F.1.10', 'a "No records to view" message when the criteria match nothing', `${(await rowsOf(page)).length} rows, ${await infoOf(page)}`);
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(600);
    const selects = await f.locator('#dvFilters select').evaluateAll((els) => els.map((e: any) => `${e.name}|${Array.from(e.options).map((o: any) => o.text).join('/')}`));
    console.log(`two criteria rows: ${JSON.stringify(selects)}`);
    const hasAndOr = selects.some((s) => /AND/i.test(s) && /OR/i.test(s));
    if (!hasAndOr) deviation('CM.160202.F.1.9', 'an AND / OR drop-down between criteria rows', JSON.stringify(selects));
    deviation('CM.160202.F.1.8', 'no results until Retrieve Data is selected', 'the grid already shows all codes when the module opens (F.1.3 says the grid is displayed by default)');
  });

  await test.step('a new page load starts with the full grid and no criteria row (filters are not remembered)', async () => {
    await page.locator('li.ui-tabs-tab:has-text("Codes Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'Codes Management');
    await findFrame(page, 'InnoPages/Codes/Management');
    await page.waitForTimeout(4000);
    const f = frameOf(page);
    expect(await f.locator('select[name="dvFilters[0].Column"]').count()).toBe(0);
    expect(await totalOf(page)).toBeGreaterThan(100);
  });
});
