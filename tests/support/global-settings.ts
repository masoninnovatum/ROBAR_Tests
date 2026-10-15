// READ-ONLY Global Settings helper (live 2026-10-06): Main Menu tile "Global Settings Management" = Dynamic UI `Definition=GlobalSettings` (columns SettingName, Value, ValueEncrypted, LastTouch,
// SettingOwner). readGlobalSetting only reads; setGlobalSetting edits ONLY when the user asked for that change in chat (settings are the user's; see docs/agents/settings-change-requests.md).

import type { Page } from '@playwright/test';
import * as du from './dynamic-ui';

export async function readGlobalSetting(page: Page, name: string, owner?: string): Promise<string | undefined> {
  // no Reset click: on 2026-10-12 Reset crashed the renderer ("Page crashed") on Dynamic UI pages that had saved criteria; the restored criteria rows are removed by hand instead
  const f = await du.reopenDynamicUi(page, 'Global Settings Management');
  for (let i = 0; i < 10; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await du.retrieve(page, f, 'SettingName', 'Exactly Matches', name, { expectRows: false });
  await page.waitForTimeout(5000);
  const rows = await du.rows(f);
  // close the tab again: a second open Dynamic UI tab makes `findFrame(page, 'DynamicUI')` return the wrong frame for the next Dynamic UI page
  await page.locator('li.ui-tabs-tab:has-text("Global Settings Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  // a row reads "<SettingName> <Value> <ValueEncrypted> <LastTouch> <SettingOwner>"
  for (const r of rows) {
    const parts = r.split(' ');
    if (parts[0] !== name) continue;
    if (owner && !r.endsWith(owner)) continue;
    return parts[1];
  }
  return undefined;
}

/**
 * Sets a Global Setting Value (Global Settings Management > select row > Edit > Value). Only when the user asked for the change (2026-10-15: "You update the global setting
 * values, and tell me when to restart services"); the value takes effect only after a ServiceHost restart + IIS reset, which the USER does. Refuses unless exactly one row
 * matches the name (and owner) and still holds `expectedOld`; returns the old value so the caller can restore it.
 */
export async function setGlobalSetting(page: Page, name: string, owner: string, expectedOld: string, newValue: string): Promise<string> {
  const f = await du.reopenDynamicUi(page, 'Global Settings Management');
  for (let i = 0; i < 10; i++) {
    const rm = f.getByText('Remove', { exact: true });
    if (!(await rm.count())) break;
    await rm.first().click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(300);
  }
  await du.retrieve(page, f, 'SettingName', 'Exactly Matches', name, { expectRows: false });
  await page.waitForTimeout(5000);
  const rows = await du.rows(f);
  const hits = rows.filter((r) => r.split(' ')[0] === name && r.endsWith(owner));
  if (hits.length !== 1) throw new Error(`refusing to edit: expected exactly 1 row for ${name} / ${owner}, got ${JSON.stringify(rows)}`);
  const old = hits[0].split(' ')[1];
  if (old !== expectedOld) throw new Error(`refusing to edit ${name}: current value "${old}" is not the expected "${expectedOld}"`);
  await du.selectGridRow(f, name);
  const dlg = await du.openFormDialog(f, 'edit');
  if ((await dlg.locator('#SettingName').inputValue()) !== name) throw new Error(`edit dialog does not show ${name}`);
  if ((await dlg.locator('#SettingOwner').inputValue()) !== owner) throw new Error(`edit dialog shows a different owner than ${owner}`);
  await dlg.locator('#Value').fill(newValue);
  await du.submitForm(f);
  await page.waitForTimeout(2500);
  const err = await du.formError(f);
  if (err) throw new Error(`edit refused: ${err}`);
  console.log(`GLOBALSETTING ${name} (${owner}): "${old}" -> "${newValue}"`);
  await page.locator('li.ui-tabs-tab:has-text("Global Settings Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  return old;
}
