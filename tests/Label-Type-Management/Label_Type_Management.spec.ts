// Label Type Management (Main Menu tile "Label Type Management" = DynamicUI Definition=LabelTypes), re-derived live 2026-10-04 as
// Claude01. Headless. NOTHING IS CREATED OR DELETED: creating a Label Type auto-provisions an `LT_<name>` security process that is
// ENABLED for every existing group and user (including non-MB ones), so this spec only exercises the Add dialog's validation
// (every submit here is refused) and edits the DESCRIPTION of the MB* fixture MBLT1 (restored at the end).
//   * layout, columns, filter operators, nav icons
//   * View dialog (read-only), Edit dialog (only Description is editable), Add dialog options + validation messages
//   * the Audit page

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as dui from '../support/dynamic-ui';

const TILE = 'Label Type Management';

test('Label Type Management: layout, filters, View/Edit/Add dialogs (validation only) and audit', async ({ page }) => {
  test.setTimeout(300_000);
  let f: Frame = await dui.openDynamicUi(page, TILE);
  const stamp = Date.now().toString().slice(-6);

  await test.step('layout: Actions menu, filter, Limit Results (1000) and grid columns', async () => {
    expect(f.url()).toContain('Definition=LabelTypes');
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(600);
    expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Excel Import', 'Excel Export', 'Audit', 'Save Search', 'Load Search', 'Adjust Page Size']);
    await f.locator('#drpMainActions').click();
    await expect(f.locator('#resultLimitTxt')).toHaveValue('1000');
    const mb = await dui.retrieve(page, f, 'LabelType', 'Contains', 'MB');
    console.log(`MB* label types: ${JSON.stringify(mb)}`);
    expect((await f.locator('select[name="dvFilters[0].Column"] option').allInnerTexts()).map((t) => t.trim())).toEqual(['LabelType', 'FileExtension', 'Description', 'FilePurpose']);
    expect((await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual(['ID', 'LabelType', 'FileExtension', 'Description', 'FilePurpose']);
    for (const lt of ['MBCustom', 'MBDOCX', 'MBINDD', 'MBLT1']) expect(mb.some((r) => r.startsWith(lt + ' ')), lt).toBe(true);
    // fixture facts
    expect(mb.find((r) => r.startsWith('MBDOCX '))).toBe('MBDOCX .docx test Label Requests');
    expect(mb.find((r) => r.startsWith('MBLT1 '))).toBe('MBLT1 .btw MBLT1');
    // operators + exact match
    expect(await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', 'MBLT1')).toEqual(['MBLT1 .btw MBLT1']);
    const blank = await dui.retrieve(page, f, 'FilePurpose', 'Is Blank', '');
    expect(blank.length).toBeGreaterThan(0);
    for (const r of blank) expect(r).toMatch(/\.btw|\.docx|\.indd|\.ai/);
    const docx = await dui.retrieve(page, f, 'FileExtension', 'Exactly Matches', '.docx');
    for (const r of docx) expect(r).toContain('.docx');
    // every non-.btw label type has a purpose, every .btw has none (the validation rule below)
    for (const r of docx) expect(r.replace(/\s+/g, ' ').split(' ').length, 'a .docx row has a FilePurpose').toBeGreaterThan(3);
  });

  await test.step('nav icons: Add is always available; Edit / View / Delete need a selected row', async () => {
    await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', 'MBLT1');
    expect(await dui.navEnabled(f, 'add')).toBe(true);
    for (const i of ['edit', 'view', 'del'] as const) expect(await dui.navEnabled(f, i), `${i} disabled before selecting`).toBe(false);
    await dui.selectGridRow(f, 'MBLT1');
    await page.waitForTimeout(500);
    for (const i of ['add', 'edit', 'view'] as const) expect(await dui.navEnabled(f, i), `${i} enabled after selecting`).toBe(true);
    // Delete (trash) stays DISABLED for this user even with a row selected (observed: Claude01, MBLT1) -- delete needs something
    // this account does not hold (no delete security process was found for Label Types; see tracker). Not exercised: deleting a
    // Label Type would also remove its LT_ security process.
    console.log(`delete icon enabled after selecting MBLT1: ${await dui.navEnabled(f, 'del')}`);
  });

  await test.step('View Record: read-only popup with just a Close button', async () => {
    await dui.selectGridRow(f, 'MBLT1');
    const d = await dui.openFormDialog(f, 'view');
    const text = (await d.innerText()).replace(/\s+/g, ' ');
    expect(text).toContain('View Record');
    expect(text).toMatch(/LabelType MBLT1 FileExtension \.btw Description MBLT1 FilePurpose/);
    expect(await d.locator('input[type=text]:not([name=id]), select, textarea').count(), 'no editable controls').toBe(0);
    await d.locator('.fm-button, a:has-text("Close"), span:has-text("Close")').filter({ hasText: 'Close' }).first().click({ timeout: 5000 });
    await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 5000 });
  });

  await test.step('Edit Record: only Description is editable; the change persists and is restored', async () => {
    await dui.selectGridRow(f, 'MBLT1');
    let d = await dui.openFormDialog(f, 'edit');
    expect(await d.locator('#LabelType').isDisabled(), 'LabelType locked once created').toBe(true);
    expect(await d.locator('#FileExtension').isDisabled(), 'FileExtension locked').toBe(true);
    expect(await d.locator('#FilePurpose').isDisabled(), 'FilePurpose locked').toBe(true);
    expect(await d.locator('#Description').isDisabled(), 'Description editable').toBe(false);
    await expect(d.locator('#Description')).toHaveValue('MBLT1');
    await d.locator('#Description').fill(`MBLT1 edited ${stamp}`);
    await dui.submitForm(f);
    await page.waitForTimeout(1500);
    let after = await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', 'MBLT1');
    expect(after).toEqual([`MBLT1 .btw MBLT1 edited ${stamp}`]);
    // restore
    await dui.selectGridRow(f, 'MBLT1');
    d = await dui.openFormDialog(f, 'edit');
    await d.locator('#Description').fill('MBLT1');
    await dui.submitForm(f);
    await page.waitForTimeout(1500);
    after = await dui.retrieve(page, f, 'LabelType', 'Exactly Matches', 'MBLT1');
    expect(after).toEqual(['MBLT1 .btw MBLT1']);
  });

  await test.step('Add Record: options and validation (every submit below is refused; nothing is created)', async () => {
    const d = await dui.openFormDialog(f, 'add');
    expect(await d.locator('#FileExtension option').allInnerTexts()).toEqual(['.ai', '.btw', '.docx', '.indd']);
    const purposes = (await d.locator('#FilePurpose option').allInnerTexts()).map((t) => t.trim());
    console.log(`FilePurpose options: ${JSON.stringify(purposes)}`);
    expect(purposes).toEqual(expect.arrayContaining(['Approvals', 'Change Report', 'IFU', 'Label Requests', 'Redline', 'Training Certificate', 'Vision Inspection']));

    // every field except FilePurpose is required on the client: "Description: Field is required"
    await d.locator('#LabelType').fill(`MBNoCreate${stamp}`);
    await d.locator('#FileExtension').selectOption('.btw');
    await dui.submitForm(f);
    expect(await dui.formError(f), 'Description is required').toContain('Description: Field is required');
    await d.locator('#LabelType').fill('');
    await d.locator('#Description').fill('MB no create');
    await dui.submitForm(f);
    expect(await dui.formError(f), 'LabelType is required').toContain('LabelType: Field is required');
    await d.locator('#LabelType').fill(`MBNoCreate${stamp}`);

    // .btw + a purpose is refused
    await d.locator('#FileExtension').selectOption('.btw');
    await d.locator('#FilePurpose').selectOption({ label: 'IFU' });
    await dui.submitForm(f);
    console.log(`.btw + purpose: "${await dui.formError(f)}"`);
    expect(await dui.formError(f), 'actual wording differs in case and has no trailing period vs the formal script').toBe('File Purpose value must be blank if File Extension is .btw');
    // a non-.btw extension with a blank purpose is refused
    await d.locator('#FileExtension').selectOption('.docx');
    await d.locator('#FilePurpose').selectOption({ index: 0 });
    await dui.submitForm(f);
    console.log(`.docx + blank purpose: "${await dui.formError(f)}"`);
    expect(await dui.formError(f)).toBe('File Purpose value cannot be blank if File Extension is not .btw');
    // a duplicate Label Type is refused
    await d.locator('#LabelType').fill('MBLT1');
    await d.locator('#FileExtension').selectOption('.btw');
    await d.locator('#FilePurpose').selectOption({ index: 0 });
    await dui.submitForm(f);
    console.log(`duplicate: "${await dui.formError(f)}"`);
    expect(await dui.formError(f)).toBe('Record already exists');
    await dui.cancelForm(f);
    // nothing was created
    expect(await dui.retrieve(page, f, 'LabelType', 'Contains', `MBNoCreate${stamp}`, { expectRows: false })).toEqual([]);
  });

  await test.step('Audit page', async () => {
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actAuditView').click({ force: true });
    await page.waitForTimeout(3500);
    const af = page.frames().find((x) => /DynamicUIAudit/.test(x.url()))!;
    expect(af, 'an audit frame opened').toBeTruthy();
    const text = (await af.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`audit page: ${text.slice(0, 300)}`);
    expect(text).toContain('Audit - Label Type Management');
  });
});
