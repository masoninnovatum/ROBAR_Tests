// Label Control main page re-checked against ValMaster (module "Label Control", LC.161207.*; live 2026-10-11, headless, TST703, seed user Claude01). READ-ONLY: no job is submitted, nothing is edited.
// Differences from a requirement are annotated `deviation <id>` (the spec stays green). Requirements: .agents/valmaster-label-control.md.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import { readGlobalSetting } from '../support/global-settings';

test.use({ actionTimeout: 20_000 });

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

async function openLabelControl(page: Page, reset = true): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Label Control") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Label Control');
  let frame = await findFrame(page, 'LabelControl/Management');
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(3000);
  if (reset) {
    await frame.click('#btnReset');
    await page.waitForTimeout(1500);
    frame = await findFrame(page, 'LabelControl/Management');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await page.waitForTimeout(3000);
  }
  return frame;
}

const optionTexts = async (f: Frame, sel: string) => (await f.locator(`${sel} option`).allInnerTexts()).map((t) => t.trim());

test('Label Control page vs ValMaster: filters, dropdowns, pager, advanced options, grid, row and bulk actions (read-only)', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const mdMustExist = await readGlobalSetting(page, 'LabelControl_MasterDataMustExist', 'Innovatum.Pages.LabelControl').catch(() => undefined);
  console.log(`SETTING LabelControl_MasterDataMustExist = ${mdMustExist} (F.1.33 default Y; the seed in ProcessesDefaultRecords / GlobalSettings defaults is "N")`);
  // the live value may have been changed by a user; the seeded default (Innovatum.Install GlobalSettingsDefaultRecords) is N, not the Y that F.1.33 requires
  deviation('LC.161207.F.1.33', 'LabelControl_MasterDataMustExist enabled (Y) by default', `seed default is N (current value on TST703: ${mdMustExist})`);
  const counter = await readGlobalSetting(page, 'LabelControlCounterName', 'Innovatum').catch(() => undefined);
  console.log(`SETTING LabelControlCounterName = ${counter} (F.7.25)`);

  let f = await openLabelControl(page);

  await test.step('F.1.2 / F.1.7: menu tile; no records until Retrieve Data; F.1.28 reopening restores criteria and results', async () => {
    const rows = await f.locator('#grdLabelControl tr.jqgrow').count();
    console.log(`ROWS before Retrieve: ${rows}`);
    if (rows !== 0) deviation('LC.161207.F.1.7', 'no records before Retrieve Data', `${rows} rows`);
    expect(await f.locator('#btnRetrieveData').isEnabled()).toBe(true);
  });

  await test.step('F.2.1 / F.12.1 / F.17.1: filter drop-downs and defaults', async () => {
    const status = await optionTexts(f, '#drpApproved');
    const att = await optionTexts(f, '#drpAttachments');
    const lm = await optionTexts(f, '#drpLabelMaster');
    console.log(`STATUS ${JSON.stringify(status)} ATT ${JSON.stringify(att)} LM ${JSON.stringify(lm)}`);
    for (const t of ['Active Only', 'Latest Active Only', 'Latest Only', 'Unreleased Only', 'All (LCN Status)']) if (!status.includes(t)) deviation('LC.161207.F.2.1', `status filter "${t}"`, JSON.stringify(status));
    for (const t of ['With Attachments', 'Without Attachments', 'Any (Attachments)']) if (!att.includes(t)) deviation('LC.161207.F.12.1', `attachment filter "${t}"`, JSON.stringify(att));
    for (const t of ['With Label Master', 'Without Label Master', 'Any (Label Masters)']) if (!lm.includes(t)) deviation('LC.161207.F.17.1', `label master filter "${t}"`, JSON.stringify(lm));
    const sel = async (id: string) => (await f.locator(`${id} option:checked`).innerText()).trim();
    const d = [await sel('#drpApproved'), await sel('#drpAttachments'), await sel('#drpLabelMaster')];
    console.log(`DEFAULTS ${JSON.stringify(d)}`);
    if (d[0] !== 'All (LCN Status)') deviation('LC.161207.F.2.5', 'default All (LCN Status)', d[0]);
    if (d[1] !== 'Any (Attachments)') deviation('LC.161207.F.12.4', 'default Any (Attachments)', d[1]);
    if (d[2] !== 'Any (Label Masters)') deviation('LC.161207.F.17.4', 'default Any (Label Masters)', d[2]);
  });

  await test.step('F.1.5 / F.1.8 / F.13.1 / F.15.x: criteria row (column prefixes, And/Or, multiple filters, Field Definitions for Label Type default)', async () => {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(600);
    const cols = (await f.locator("select[name$='Column']").first().locator('option').allInnerTexts()).map((t) => t.trim());
    const prefixes = new Set(cols.map((c) => c.split(' - ')[0]));
    console.log(`COLUMN prefixes ${JSON.stringify([...prefixes])} count=${cols.length}`);
    for (const p of ['Item', 'LC', 'MD']) if (!prefixes.has(p) && !prefixes.has(p.toUpperCase())) deviation('LC.161207.F.1.5', `column drop-down has "${p} - ..." columns`, JSON.stringify([...prefixes]));
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(600);
    const n = await f.locator("select[name$='Column']").count();
    const andOr = await f.locator("select[name$='AndOr']").count();
    console.log(`FILTER ROWS=${n} AndOr selects=${andOr}`);
    expect.soft(n).toBeGreaterThanOrEqual(2);
    if (andOr === 0) deviation('LC.161207.F.1.8', 'AND / OR drop-down between filters', 'none found');
    if (await f.locator('#advancedOptions h3 a').count()) await f.locator('#advancedOptions h3 a').first().click();
    await page.waitForTimeout(800);
    const ftypes = await optionTexts(f, '#drpFieldDefLabelTypes');
    const ftSel = (await f.locator('#drpFieldDefLabelTypes option:checked').innerText().catch(() => '')).trim();
    console.log(`FIELD DEF LABEL TYPES ${JSON.stringify(ftypes)} selected="${ftSel}"`);
    if (ftSel !== 'Default') deviation('LC.161207.F.15.2', 'Field Definitions for Label Type defaults to Default', `"${ftSel}"`);
    const avail = await optionTexts(f, '#availableLimitColumns');
    const selected = await optionTexts(f, '#selectedLimitColumns');
    console.log(`SELECTED FIELDS ${JSON.stringify(selected)} availableCount=${avail.length}`);
    for (const c of ['LC - LCN', 'Item - Item Number']) if (!selected.includes(c)) deviation('LC.161207.F.1.32', `default selected field "${c}"`, JSON.stringify(selected));
    // F.1.32: the two default columns cannot be removed
    await f.locator('#selectedLimitColumns').selectOption({ label: 'LC - LCN' }).catch(() => {});
    await f.locator('#btSelToAvl').click().catch(() => {});
    await page.waitForTimeout(600);
    const after = await optionTexts(f, '#selectedLimitColumns');
    console.log(`SELECTED after trying to remove LC - LCN ${JSON.stringify(after)}`);
    if (!after.includes('LC - LCN')) deviation('LC.161207.F.1.32', 'LC - LCN cannot be removed from Selected Fields', JSON.stringify(after));
    // F.13.1 / F.14.1: unassigned item fields are not offered (informational: list contains no "<unassigned>")
    if (avail.some((a) => /unassigned/i.test(a))) deviation('LC.161207.F.14.1', 'no <unassigned> fields in Available Fields', 'found');
    expect(await f.locator('#txtResultLimit').inputValue()).toBe('500');
  });

  await test.step('F.1.6 / F.1.11 - F.1.17 / F.1.27: retrieve, record checkbox, Select All, page counter, record counter, view X - X, sort, row Actions', async () => {
    await f.locator("input[name$='Column']").count();
    // clear the extra blank filter rows by resetting, then a simple Contains TESTPW retrieve
    await f.click('#btnReset');
    await page.waitForTimeout(3000);
    f = await findFrame(page, 'LabelControl/Management');
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
    await page.waitForTimeout(500);
    await f.locator("select[name$='Column']").first().selectOption('LCV_ItemNumber');
    await f.locator("select[name$='Operator']").first().selectOption('Contains');
    await f.locator("input[name$='Value']").first().fill('TESTPW');
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(6000);
    const rows = f.locator('#grdLabelControl tr.jqgrow');
    const n = await rows.count();
    const info = (await f.locator('.ui-paging-info').first().innerText().catch(() => '')).trim();
    const pager = (await f.locator('#grdPager').innerText().catch(() => '')).replace(/\s+/g, ' ');
    console.log(`GRID rows=${n} view="${info}" pager="${pager.slice(0, 120)}"`);
    expect(n).toBeGreaterThan(0);
    if (!/^View 1 - \d+ of \d+/.test(info.replace('–', '-'))) deviation('LC.161207.F.1.16', 'View X - X of X records', info);
    const pageSizes = (await f.locator('.ui-pg-selbox option').allInnerTexts()).map((t) => t.trim());
    const pageSel = (await f.locator('.ui-pg-selbox option:checked').innerText().catch(() => '')).trim();
    console.log(`PAGE SIZES ${JSON.stringify(pageSizes)} default=${pageSel}`);
    if (pageSel !== '10' || pageSizes.join(',') !== '10,20,30') deviation('LC.161207.F.1.15', 'record counter default 10 with 10 / 20 / 30', `${pageSel} / ${pageSizes}`);
    if (!/Page\s*\d+\s*of\s*\d+/i.test(pager)) {
      const pageText = await f.locator('#grdPager_center').innerText().catch(() => '');
      console.log(`PAGE COUNTER text="${pageText.replace(/\s+/g, ' ')}"`);
      if (!/of/i.test(pageText)) deviation('LC.161207.F.1.14', 'page counter "Page X of X"', pageText);
    }
    const rowChecks = await rows.first().locator('input[type=checkbox]').count();
    const selectAll = await f.locator('#cb_grdLabelControl').count();
    console.log(`ROW CHECKBOX=${rowChecks} SELECT ALL=${selectAll}`);
    if (!rowChecks) deviation('LC.161207.F.1.11', 'a check box next to each record', 'none');
    if (!selectAll) deviation('LC.161207.F.1.12', 'Select All check box in the grid', 'none');
    const bulkBefore = await f.locator('#drpActions').count();
    console.log(`BULK menu present=${bulkBefore}`);
    // row Actions
    const act = rows.first().locator('a:has-text("Actions")').first();
    if (await act.count()) {
      await act.click({ timeout: 5000 }).catch(() => {});
      await page.waitForTimeout(600);
      console.log(`ROW ACTIONS ${JSON.stringify(await f.locator('ul:visible li').allInnerTexts())}`);
      await page.keyboard.press('Escape');
    } else deviation('LC.161207.F.1.17', 'an Actions drop-down per record', 'none');
    // sort by a column header
    const hdr = f.locator('#gview_grdLabelControl th').filter({ hasText: 'Item' }).first();
    await hdr.click().catch(() => {});
    await page.waitForTimeout(2500);
    console.log(`SORT clicked; first row now: ${(await f.locator('#grdLabelControl tr.jqgrow').first().innerText()).replace(/\s+/g, ' ').slice(0, 120)}`);
  });

  await test.step('F.1.18 - F.1.20 / F.1.30 / F.1.31: Bulk Actions menu entries and state; Please select record(s)', async () => {
    const menuItems = await f.locator('#drpActions').locator('xpath=ancestor::*[1]').innerText().catch(() => '');
    const items = await f.locator('[id^="act"]').evaluateAll((els) => els.map((e: any) => `${e.id}|${(e.innerText || '').trim()}|${e.className}|${e.getAttribute('title') || ''}`));
    console.log(`BULK ITEMS ${JSON.stringify(items)}`);
    void menuItems;
    // open menu, click the first enabled bulk action without selecting records
    await f.locator('#drpActions').first().click({ timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(500);
    await f.locator('#actLinkAttachments').click({ force: true, timeout: 5000 }).catch(() => {});
    await page.waitForTimeout(1500);
    const dlg = (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`NO SELECTION dialog="${dlg}"`);
    if (!/Please select record\(s\)/i.test(dlg)) deviation('LC.161207.F.1.19', '"Please select record(s)" dialog', dlg || 'no dialog');
    await f.locator('.ui-dialog:visible button').first().click({ timeout: 2000 }).catch(() => {});
  });

  await test.step('F.1.36: MD fields show N/A when there is no LCN / Master Data version', async () => {
    // Retrieve the Master Data columns for TESTPW items (most have no LCN)
    if (await f.locator('#advancedOptions h3 a').count()) await f.locator('#advancedOptions h3 a').first().click().catch(() => {});
    await page.waitForTimeout(600);
    const want = ['MD - Active', 'MD - Description'];
    for (const w of want) {
      await f.locator('#availableLimitColumns').selectOption({ label: w }).catch(() => {});
      await f.locator('#btAvlToSel').click().catch(() => {});
    }
    await f.click('#btnRetrieveData');
    await page.waitForTimeout(6000);
    const texts = (await f.locator('#grdLabelControl tr.jqgrow').allInnerTexts()).slice(0, 5).map((t) => t.replace(/\s+/g, ' ').trim());
    console.log(`MD COLUMNS rows ${JSON.stringify(texts)}`);
    if (texts.length && !texts.some((t) => /N\/A/.test(t))) deviation('LC.161207.F.1.36', 'N/A in MD columns where LCN is blank / MD version NULL', JSON.stringify(texts.slice(0, 2)));
  });
});
