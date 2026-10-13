// Print Config Management helper (DynamicUI `PrintConfig`; columns ConfigName, PrintFunction, PrintLayout, ParamName, ParamValue; only ParamValue is editable).
// The user allowed edits to the FlexPrinting config via this page (2026-10-12; no service restart needed). Every change goes through setParamValue, which asserts that exactly ONE row
// matches ConfigName + ParamName (Exactly Matches) and that it still holds the expected old value, and returns the old value so the caller can restore it.

import type { Frame, Page } from '@playwright/test';
import * as du from './dynamic-ui';

async function filterTo(page: Page, configName: string, paramName: string): Promise<Frame> {
  // no Reset click: on 2026-10-12 the Reset of this page crashed the renderer ("Page crashed") once saved criteria existed; the criteria rows are removed by hand below instead
  const f = await du.reopenDynamicUi(page, 'Print Config Management');
  // the page restores the previous criteria: remove every row, then build exactly the two we want
  for (let i = 0; i < 10; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  for (let n = 0; n < 2; n++) {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').first().click();
    await page.waitForTimeout(500);
  }
  await f.locator("select[name$='Column']").nth(0).selectOption({ label: 'ConfigName' });
  await f.locator("select[name$='Operator']").nth(0).selectOption({ label: 'Exactly Matches' });
  await f.locator("input[name$='Value']").nth(0).fill(configName);
  await f.locator("select[name$='Column']").nth(1).selectOption({ label: 'ParamName' });
  await f.locator("select[name$='Operator']").nth(1).selectOption({ label: 'Exactly Matches' });
  await f.locator("input[name$='Value']").nth(1).fill(paramName);
  if ((await f.locator("select[name$='Column']").count()) !== 2) throw new Error('expected exactly 2 criteria rows');
  await f.click('#btnRetrieveData');
  await page.waitForTimeout(5000);
  return f;
}

/** Reads the value of one PrintConfig parameter (exactly one row must match). */
export async function readParam(page: Page, configName: string, paramName: string): Promise<string> {
  const f = await filterTo(page, configName, paramName);
  const rows = await du.rows(f);
  if (rows.length !== 1) throw new Error(`expected exactly 1 row for ${configName}/${paramName}, got ${rows.length}: ${JSON.stringify(rows)}`);
  const out = (await f.locator('tr.jqgrow').first().locator('td[aria-describedby$="_ParamValue"]').innerText()).trim();
  await page.locator('li.ui-tabs-tab:has-text("Print Config Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  return out;
}

/** Sets ParamValue; refuses unless the single matching row currently holds `expectedOld`. Returns the old value. */
export async function setParamValue(page: Page, configName: string, paramName: string, expectedOld: string, newValue: string): Promise<string> {
  const f = await filterTo(page, configName, paramName);
  const rows = await du.rows(f);
  if (rows.length !== 1 || !rows[0].includes(paramName)) throw new Error(`refusing to edit: expected exactly 1 row for ${configName}/${paramName}, got ${JSON.stringify(rows)}`);
  const row = f.locator('tr.jqgrow').first();
  const old = (await row.locator('td[aria-describedby$="_ParamValue"]').innerText()).trim();
  if (old !== expectedOld) throw new Error(`refusing to edit ${paramName}: current value "${old}" is not the expected "${expectedOld}"`);
  await du.selectGridRow(f, paramName);
  const dlg = await du.openFormDialog(f, 'edit');
  const shown = await dlg.locator('#ParamName').inputValue();
  if (shown !== paramName) throw new Error(`edit dialog shows ${shown}, expected ${paramName}`);
  await dlg.locator('#ParamValue').fill(newValue);
  await du.submitForm(f);
  await page.waitForTimeout(2500);
  const err = await du.formError(f);
  if (err) throw new Error(`edit refused: ${err}`);
  console.log(`PRINTCONFIG ${configName}/${paramName}: "${old}" -> "${newValue}"`);
  await page.locator('li.ui-tabs-tab:has-text("Print Config Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  return old;
}
