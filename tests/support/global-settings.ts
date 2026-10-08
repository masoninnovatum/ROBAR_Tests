// READ-ONLY Global Settings helper (live 2026-10-06): Main Menu tile "Global Settings Management" = Dynamic UI `Definition=GlobalSettings` (columns SettingName, Value, ValueEncrypted, LastTouch,
// SettingOwner). This helper ONLY reads a value so a spec can adapt to the environment; it never edits (settings are changed by Mason -- see .agents/settings-change-requests.md).

import type { Page } from '@playwright/test';
import * as du from './dynamic-ui';

export async function readGlobalSetting(page: Page, name: string, owner?: string): Promise<string | undefined> {
  const g = await du.reopenDynamicUi(page, 'Global Settings Management');
  await g.click('#btnReset').catch(() => {});
  await page.waitForTimeout(3000);
  const f = await du.reopenDynamicUi(page, 'Global Settings Management');
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
