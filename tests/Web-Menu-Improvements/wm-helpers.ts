// Shared helpers of the Web Menu Improvements specs (new web menu http://<server>/ROBAR/): the four Settings modules are Dynamic UI pages opened from the gear.

import { expect, test } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as du from '../support/dynamic-ui';
import { openModuleNew, moduleFrame } from '../support/new-web-menu';

export const fmt = (d: Date) => `${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')}/${d.getFullYear()}`;
export const dayOffset = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return fmt(d); };

/** Records a difference from a ValMaster requirement (shown as a `deviation` annotation in the report and printed). */
export function deviation(description: string) {
  test.info().annotations.push({ type: 'deviation', description });
  console.log('DEVIATION: ' + description);
}

/** Opens a Settings (gear) module, clears the restored filter rows and does the first Retrieve (the grid and its Add / Edit / Delete icons only exist after it). */
export async function openSettings(page: Page, module: string): Promise<Frame> {
  await openModuleNew(page, module, { gear: true });
  const f = await moduleFrame(page, 'DynamicUI');
  await f.locator('#btnRetrieveData').waitFor();
  await page.waitForTimeout(2500);
  await du.clearCriteria(page, f);
  await f.click('#btnRetrieveData');
  await f.locator('#add_grdJqGrid').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1000);
  return f;
}

export async function closeAllTabs(page: Page): Promise<void> {
  for (let i = 0; i < 8; i++) {
    const x = page.locator('#moduleList li .moduleCloseBtn');
    if (!(await x.count())) break;
    await x.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(500);
  }
}

/** Deletes every grid row whose text contains `text` (callers filter the grid first and use a stamped name, so nothing else can match). */
export async function deleteMatching(f: Frame, text: string): Promise<number> {
  let n = 0;
  for (let i = 0; i < 8; i++) {
    const row = du.gridRow(f, text);
    if (!(await row.count())) break;
    await row.first().click();
    await f.click('#del_grdJqGrid');
    await f.locator('#dData').click({ timeout: 8000 });
    await f.waitForTimeout(1500);
    n++;
  }
  return n;
}

/** Adds a row through the Add dialog: `fields` maps a field id to its value (text fill, or the visible option label for a <select>). */
export async function addRow(f: Frame, fields: Record<string, string>): Promise<void> {
  const d = await du.openFormDialog(f, 'add');
  for (const [id, value] of Object.entries(fields)) {
    const el = d.locator('#' + id);
    if ((await el.evaluate((e) => e.tagName)) === 'SELECT') await el.selectOption({ label: value });
    else {
      await el.fill(value);
      await el.press('Tab');
    }
  }
  await du.submitForm(f);
  expect(await du.formError(f)).toBe('');
  await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 8000 });
}
