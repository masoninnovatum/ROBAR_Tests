// User Print Entity Management helper (live 2026-10-05/06): sets the EXACT set of Print Entities of one user through
// `InnoPages/PrintEntity/UserManagement` > Bulk Actions > User Print Entity Update. Only for MB* users (assertMb-style guard) -- never touch other accounts.

import type { Frame, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { openMenuItem, findFrame } from './robar';

export async function setUserPrintEntities(page: Page, userId: string, entities: string[]): Promise<void> {
  if (!/^MB/i.test(userId)) throw new Error(`refusing to change the Print Entities of non-MB user ${userId}`);
  await page.locator('li.ui-tabs-tab:has-text("User Print Entity Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'User Print Entity Management');
  let g = await findFrame(page, 'PrintEntity/UserManagement');
  await g.locator('#btnReset').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(2500);
  await g.click('#btnReset');
  await page.waitForTimeout(3500);
  g = await findFrame(page, 'PrintEntity/UserManagement');
  await g.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click();
  await g.locator('select[name="dvFilters[0].Column"]').selectOption('UserId');
  await g.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'Exactly Matches' });
  await g.locator('input[name="dvFilters[0].Value"]').fill(userId);
  await g.click('#btnRetrieveData');
  await expect(g.locator('tr.jqgrow')).toHaveCount(1, { timeout: 20_000 });
  await g.locator(`input[id="jqg_grdJqGrid_${userId}"]`).check();
  await g.locator('#drpActions').click();
  await page.waitForTimeout(500);
  await g.locator('ul:visible li a').filter({ hasText: 'User Print Entity Update' }).click({ force: true });
  await page.waitForTimeout(5000);
  const u: Frame = page.frames().filter((x) => x.url().includes('UserPrintEntityUpdate')).pop()!;
  await expect(u.locator('body')).toContainText('Records Selected:1');
  // the Filter dropdown is remembered between visits: show every entity
  await u.locator('#drpAssignedUsers').selectOption({ label: 'Any (Print Entity)' });
  await u.click('#btnRetrieveData');
  await page.waitForTimeout(3000);
  const box = (name: string) => u.locator('tr.jqgrow').filter({ hasText: new RegExp(`^\\s*\\d*\\s*${name.replace(/[*]/g, '\\*')}`) }).first().locator('input[type=checkbox]');
  const names = await u.locator('tr.jqgrow').evaluateAll((trs) => trs.map((t) => (Array.from(t.querySelectorAll('td')).map((c) => (c.textContent || '').trim()).find((c) => c && !/^\d+$/.test(c)) ?? '')));
  // `*` first: checking it disables the rest, so uncheck every other entity before and set `*` last
  for (const name of names) {
    if (name === '*' || entities.includes(name)) continue;
    const cb = box(name);
    if ((await cb.isChecked()) && (await cb.isEnabled())) await cb.uncheck();
  }
  for (const name of names) {
    if (name === '*' || !entities.includes(name)) continue;
    const cb = box(name);
    if (!(await cb.isChecked()) && (await cb.isEnabled())) await cb.check();
  }
  const star = box('*');
  if (entities.includes('*') !== (await star.isChecked())) await star.setChecked(entities.includes('*'));
  if (await u.locator('#btnUpdate').isEnabled()) {
    await u.locator('#btnUpdate').click();
    await page.waitForTimeout(4000);
    await expect(u.locator('body')).toContainText('Update successful');
  }
}
