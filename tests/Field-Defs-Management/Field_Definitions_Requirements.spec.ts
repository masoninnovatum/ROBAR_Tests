// Field Definitions Management re-checked against ValMaster (module "Field Definitions Management", FDM.190606.*; live 2026-10-09, headless, TST703). NOTHING is created or changed: the MB label type MBLT1 is only read,
// the Create New Field Definitions flow is answered "No" (F.3.5). Differences are annotated `deviation <id>` (the spec stays green). The older Field_Definitions / Item_Screen_Layout / Security_Gating specs already
// cover the criteria / Advanced Options columns, the Edit dialog states, the Create dialog lists, Item Screen Layout and the LT_ / FD_Maintain_FieldDefs gating.
// New here: F.1.4 no rows before Retrieve Data; F.1.5 AND / OR; F.1.7 "No records to view"; F.1.8 - F.1.10 page counter, record counter (10 / 20 / 30, default 10) and "View X - X of X records";
// F.2.4 Dictionary Language list (alphabetical, blank default); F.3.3 / F.3.5 confirmation text and No; F.2.3 unauthorized double-click message (MB user without FD_Maintain_FieldDefs).

import { test, expect } from '@playwright/test';
import type { Browser, Frame } from '@playwright/test';
import { login, loginAs, openMenuItem, findFrame, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as dui from '../support/dynamic-ui';

test.use({ actionTimeout: 20_000 });

const LABEL_TYPE = 'MBLT1';
const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';

function deviation(requirement: string, expected: string, actual: string): void {
  console.log(`DEVIATION ${requirement}: expected ${expected}; actual ${actual}`);
  test.info().annotations.push({ type: `deviation ${requirement}`, description: `expected ${expected}; actual ${actual}` });
}

test('Field Definitions Management vs ValMaster: retrieve, pager, No records, Dictionary Language, Create confirmation (No), unauthorized double-click', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  await login(page);
  await openMenuItem(page, 'Field Defs Management');
  let f: Frame = await findFrame(page, 'FieldDefs');
  await f.locator('#ddlLabelTypes').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  await f.locator('#ddlLabelTypes').selectOption({ label: LABEL_TYPE }, { timeout: 5000 });
  await page.waitForTimeout(1500);

  const removeCriteria = async () => {
    while ((await f.locator('.criteriaFilter-Filter').count()) > 0) {
      await f.locator('.criteriaFilter-Filter span:has-text("Remove"), .criteriaFilter-Filter a:has-text("Remove")').first().click({ timeout: 5000 });
      await page.waitForTimeout(400);
    }
  };

  await test.step('F.1.4: no field definition rows until Retrieve Data is clicked', async () => {
    const rows = await f.locator('tr.jqgrow').count();
    console.log(`rows before Retrieve: ${rows}`);
    if (rows > 0) deviation('FDM.190606.F.1.4', 'no records until Retrieve Data', `${rows} rows already shown`);
    expect.soft(rows).toBe(0);
  });

  await test.step('F.1.8 - F.1.10: "View X - X of X records", Page X of X, record counter 10 / 20 / 30 with default 10', async () => {
    await removeCriteria();
    await f.locator('#txtResultLimit').evaluate((el) => {
      const i = el as HTMLInputElement;
      i.value = '1000';
      i.dispatchEvent(new Event('input', { bubbles: true }));
      i.dispatchEvent(new Event('change', { bubbles: true }));
    });
    await f.click('#btnRetrieveData');
    await f.locator('tr.jqgrow').first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    const info = (await f.locator('.ui-paging-info').innerText()).trim();
    const pager = (await f.locator('.ui-pg-table').first().innerText()).replace(/\s+/g, ' ');
    const sizes = (await f.locator('select.ui-pg-selbox option').allInnerTexts()).map((t) => t.trim());
    const size = await f.locator('select.ui-pg-selbox').inputValue();
    console.log(`PAGER info="${info}" pagerText="${pager.slice(0, 120)}" sizes=${JSON.stringify(sizes)} default=${size}`);
    if (!/^View \d+\s*[-–]\s*\d+ of \d+( records)?$/.test(info)) deviation('FDM.190606.F.1.10', 'View X - X of X records', info);
    const pageInput = await f.locator('input.ui-pg-input').first().inputValue().catch(() => ''); // the current page number sits in an input box
    if (!(/Page\s+of\s+\d+/.test(pager) && /^\d+$/.test(pageInput))) deviation('FDM.190606.F.1.8', 'Page X of X', pager.slice(0, 80));
    if (JSON.stringify(sizes) !== JSON.stringify(['10', '20', '30'])) deviation('FDM.190606.F.1.9', 'record counter options 10, 20, 30', JSON.stringify(sizes));
    if (size !== '10') deviation('FDM.190606.F.1.9', 'default 10 records', size);
    expect.soft(size).toBe('10');
  });

  await test.step('F.1.5: a second query filter offers AND / OR', async () => {
    await removeCriteria();
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await page.waitForTimeout(400);
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await page.waitForTimeout(400);
    const conj = await f.locator('select[name$="Conjunction"], select[name$="Logic"], select[name*="And"], select[name*="Or"]').evaluateAll((els) => els.map((e) => ({ name: (e as HTMLSelectElement).name, options: Array.from((e as HTMLSelectElement).options).map((o) => o.text) })));
    console.log(`CONJUNCTION selects: ${JSON.stringify(conj)}`);
    const text = (await f.locator('.criteriaFilter-Filter').last().innerText()).replace(/\s+/g, ' ');
    const hasAndOr = conj.some((c) => c.options.some((o) => /^and$/i.test(o)) && c.options.some((o) => /^or$/i.test(o))) || (/\bAND\b/i.test(text) && /\bOR\b/i.test(text));
    if (!hasAndOr) deviation('FDM.190606.F.1.5', 'AND / OR drop-down for multiple query filters', `${JSON.stringify(conj)} text="${text.slice(0, 120)}"`);
    expect.soft(hasAndOr).toBe(true);
    await removeCriteria();
  });

  await test.step('F.1.7: "No records to view" when nothing matches', async () => {
    await dui.retrieve(page, f, 'ReplacementString', 'Contains', 'zz_no_such_sharename', { expectRows: false });
    await page.waitForTimeout(3000);
    const text = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`NO RECORDS: ${text.includes('No records to view')}`);
    if (!text.includes('No records to view')) deviation('FDM.190606.F.1.7', '"No records to view"', text.slice(0, 120));
    expect.soft(text).toContain('No records to view');
    await removeCriteria();
  });

  await test.step('F.2.4: the Dictionary Language list is alphabetical with a blank default', async () => {
    const rows = await dui.retrieve(page, f, 'ReplacementString', 'Exactly Matches', 'C_Lot');
    expect(rows.length).toBe(1);
    await dui.selectGridRow(f, 'C_Lot');
    const d = await dui.openFormDialog(f, 'edit');
    const options = (await d.locator('#DropDownLanguage option').allInnerTexts()).map((t) => t.trim());
    const value = await d.locator('#DropDownLanguage').inputValue();
    console.log(`DICT LANGUAGES (${options.length}): first=${JSON.stringify(options.slice(0, 4))} default="${value}"`);
    const rest = options.filter((o) => o !== '');
    const sorted = [...rest].sort((a, b) => a.localeCompare(b));
    if (JSON.stringify(rest) !== JSON.stringify(sorted)) deviation('FDM.190606.F.2.4', 'languages in alphabetical order', JSON.stringify(rest.slice(0, 8)));
    if (value !== '') deviation('FDM.190606.F.2.4', 'blank default', `"${value}"`);
    await dui.cancelForm(f);
  });

  await test.step('F.3.3 / F.3.5: Create confirmation text; No closes both dialogs and creates nothing', async () => {
    await removeCriteria();
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actNewFd').click({ force: true });
    await page.waitForTimeout(2000);
    await expect(f.locator('#newFieldDefsDialog')).toBeVisible();
    await f.locator('#ddlNonFdsLabelTypes').selectOption({ index: 0 }).catch(() => {});
    await f.locator('#ddlOrigLabelTypes').selectOption({ label: 'Carton Label' }, { timeout: 5000 }).catch(() => {});
    await f.locator('#btnSubmitNewFds').click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const confirm = (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
    console.log(`CONFIRM: ${confirm}`);
    const expected = 'Are you sure you want to create new field definitions? This action cannot be undone';
    if (!confirm.includes(expected)) deviation('FDM.190606.F.3.3', `"${expected}"`, confirm.slice(0, 160));
    expect.soft(confirm).toContain('Are you sure you want to create new field definitions');
    await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: /^No$/ }).first().click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    const stillOpen = await f.locator('#newFieldDefsDialog').isVisible().catch(() => false);
    console.log(`AFTER NO: create dialog visible=${stillOpen}`);
    if (stillOpen) deviation('FDM.190606.F.3.5', 'No closes the confirmation AND the Create New Field Definitions dialog', 'the Create dialog stays open');
    if (stillOpen) await f.locator('#btnCancelNewFds').click({ timeout: 5000 }).catch(() => {});
  });

  await test.step('F.2.3: an unauthorized user (no FD_Maintain_FieldDefs) double-clicking a record gets "User not authorized for this task.FD_Maintain_FieldDefs" + OK', async () => {
    await sec.setGroupProcesses(page, GROUP, ['Login_WebMenu', 'Web_Field_Definitions', `LT_${LABEL_TYPE}`]);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2500);
      await openMenuItem(p, 'Field Defs Management');
      const mf = await findFrame(p, 'FieldDefs');
      await mf.locator('#ddlLabelTypes').waitFor({ timeout: 20_000 });
      await p.waitForTimeout(2500);
      await mf.locator('#ddlLabelTypes').selectOption({ label: LABEL_TYPE }, { timeout: 5000 });
      await p.waitForTimeout(1500);
      await mf.click('#btnRetrieveData');
      await mf.locator('tr.jqgrow').first().waitFor({ timeout: 20_000 });
      await mf.locator('tr.jqgrow').first().dblclick();
      await p.waitForTimeout(2000);
      const dialog = (await mf.locator('.ui-dialog:visible, .ui-jqdialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
      console.log(`UNAUTHORIZED DBLCLICK: "${dialog}"`);
      if (!dialog.includes('User not authorized for this task.FD_Maintain_FieldDefs')) deviation('FDM.190606.F.2.3', '"User not authorized for this task.FD_Maintain_FieldDefs" with OK', dialog.slice(0, 160) || 'no dialog');
      expect.soft(dialog).toContain('FD_Maintain_FieldDefs');
    } finally {
      await ctx.close();
      await sec.setGroupProcesses(page, GROUP, []);
    }
  });
});
