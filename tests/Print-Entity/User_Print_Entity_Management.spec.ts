// User Print Entity Management (live 2026-10-05, Claude01): `InnoPages/PrintEntity/UserManagement` is a grid of users with their assigned Print
// Entities (User ID, Full Name, Security Group, Active User, Facility, Print Entity); Bulk Actions > "User Print Entity Update" opens
// `UserPrintEntityUpdate`, a checkbox grid of Print Entities (`*` All, ROBAR, England, Mars (inactive), MLAUser1, Vendors, 1240 Germany (inactive))
// that assigns / removes entities for ALL the selected users at once (tri-state: checked for everyone, indeterminate for some, unchecked).
// Only MB fixture users (MBUser11, MBUser12) are changed; their assignments are removed again at the end. Why this module matters:
// SP_PrintHistoryForcedFilter and Lot Management only show a user the rows of the print entities assigned to them (none assigned = "1 = 2" = no rows).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';

test.use({ actionTimeout: 20_000 });

const USERS = ['MBUser11', 'MBUser12'];

test('User Print Entity Management: grid, multi-user update, tri-state, "*" exclusivity, unsaved-changes prompt', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  let f: Frame;

  /** (Re)opens the module, Resets the persisted filter rows (a stale blank row blocks Retrieve) and lists `users` by User ID. */
  const listUsers = async (users: string[]): Promise<Frame> => {
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
    await g.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'In' });
    await g.locator('input[name="dvFilters[0].Value"]').fill(users.join(','));
    await g.click('#btnRetrieveData');
    await expect(g.locator('tr.jqgrow')).toHaveCount(users.length, { timeout: 20_000 });
    return g;
  };
  const gridRows = async (g: Frame) => (await g.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
  const entityOf = async (g: Frame, user: string) => ((await g.locator(`tr.jqgrow[id="${user}"], tr.jqgrow:has(td[title="${user}"])`).first().locator('td[aria-describedby$="PrintEntity"]').innerText().catch(() => '')) || '').trim();
  /** Ticks the users and opens Bulk Actions > User Print Entity Update; returns the update frame. */
  const openUpdate = async (g: Frame, users: string[]): Promise<Frame> => {
    for (const u of users) await g.locator(`input[id="jqg_grdJqGrid_${u}"]`).check();
    await g.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await g.locator('ul:visible li a').filter({ hasText: 'User Print Entity Update' }).click({ force: true });
    await page.waitForTimeout(5000);
    const u = page.frames().filter((x) => x.url().includes('UserPrintEntityUpdate')).pop()!;
    await expect(u.locator('body')).toContainText(`Records Selected:${users.length}`);
    // the Filter dropdown (Any / With Assigned / With Unassigned) is remembered between visits: set it explicitly and Retrieve
    await u.locator('#drpAssignedUsers').selectOption({ label: 'Any (Print Entity)' });
    await u.click('#btnRetrieveData');
    await page.waitForTimeout(3000);
    return u;
  };
  /** state of every entity row: name -> 'on' | 'off' | 'mixed', plus ' (disabled)'. */
  const boxes = async (u: Frame): Promise<Record<string, string>> =>
    u.locator('tr.jqgrow').evaluateAll((trs) => {
      const out: Record<string, string> = {};
      for (const t of trs) {
        const cells = Array.from(t.querySelectorAll('td')).map((c) => (c.textContent || '').trim());
        const cb = t.querySelector('input[type=checkbox]') as HTMLInputElement | null;
        if (!cb) continue;
        const name = cells.find((c) => c && !/^\d+$/.test(c)) ?? '?';
        out[name] = (cb.indeterminate ? 'mixed' : cb.checked ? 'on' : 'off') + (cb.disabled ? ' (disabled)' : '');
      }
      return out;
    });
  // hasText matches textContent, which starts with the hidden numeric key cell and has no spaces between cells: "1ROBARDefault valueYes"
  const box = (u: Frame, name: string) =>
    u.locator('tr.jqgrow').filter({ hasText: new RegExp(`^\\s*\\d*\\s*${name.replace(/[*]/g, '\\*')}`) }).first().locator('input[type=checkbox]');
  const update = async (u: Frame): Promise<string> => {
    await u.locator('#btnUpdate').click();
    await page.waitForTimeout(4000);
    return (await u.locator('body').innerText()).replace(/\s+/g, ' ');
  };

  try {
    await test.step('the grid lists users with their Print Entity; columns and the User ID filter', async () => {
      f = await listUsers(USERS);
      expect((await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual(expect.arrayContaining(['User ID', 'Full Name', 'Security Group', 'Active User', 'Facility', 'Print Entity']));
      console.log(`start state: ${JSON.stringify(await gridRows(f))}`);
      expect(await f.locator('#drpActions').innerText()).toContain('Bulk Actions');
    });

    await test.step('Bulk Actions with nothing ticked asks to select records', async () => {
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await f.locator('ul:visible li a').filter({ hasText: 'User Print Entity Update' }).click({ force: true });
      await page.waitForTimeout(1500);
      const dialogs = (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
      console.log(`no selection: ${dialogs} | body: ${(await f.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 200)}`);
      expect(dialogs + (await f.locator('body').innerText())).toMatch(/select record/i);
      await f.locator('.ui-dialog:visible button').filter({ hasText: /OK|Close/ }).first().click({ timeout: 3000 }).catch(() => {});
    });

    await test.step('Update screen for two users: entity list, Records Selected, filter dropdown', async () => {
      f = await listUsers(USERS);
      const u = await openUpdate(f, USERS);
      const names = Object.keys(await boxes(u));
      console.log(`update entities: ${JSON.stringify(await boxes(u))}`);
      expect(names).toEqual(expect.arrayContaining(['*', 'ROBAR', 'England']));
      expect((await u.locator('#drpAssignedUsers option').allInnerTexts()).map((t) => t.trim())).toEqual(['Any (Print Entity)', 'With Assigned Users', 'With Unassigned Users']);
    });

    await test.step('assign ROBAR to both users -> "Update successful", the grid shows ROBAR for both', async () => {
      f = await listUsers(USERS);
      const u = await openUpdate(f, USERS);
      await box(u, 'ROBAR').check();
      await page.waitForTimeout(800);
      console.log(`after ticking ROBAR: ${JSON.stringify(await boxes(u))} update enabled=${await u.locator('#btnUpdate').isEnabled()} frames=${page.frames().filter((x) => x.url().includes('UserPrintEntityUpdate')).length}`);
      const text = await update(u);
      console.log(`update result: ${text.slice(0, 300)}`);
      expect(text).toContain('Update successful');
      f = await listUsers(USERS);
      for (const r of await gridRows(f)) expect(r).toContain('ROBAR');
    });

    await test.step('tri-state: England for ONE user -> indeterminate when both are selected', async () => {
      f = await listUsers(USERS);
      let u = await openUpdate(f, [USERS[0]]);
      expect((await boxes(u)).ROBAR, 'ROBAR already assigned').toContain('on');
      await box(u, 'England').check();
      expect(await update(u)).toContain('Update successful');
      f = await listUsers(USERS);
      u = await openUpdate(f, USERS);
      const states = await boxes(u);
      console.log(`two users selected: ${JSON.stringify(states)}`);
      expect(states.ROBAR).toContain('on');
      expect(states.England, 'assigned to only one of the two users').toContain('mixed');
      // filter: With Assigned Users / With Unassigned Users narrows the entity rows
      await u.locator('#drpAssignedUsers').selectOption({ label: 'With Unassigned Users' });
      await u.click('#btnRetrieveData');
      await page.waitForTimeout(3000);
      const unassigned = Object.keys(await boxes(u));
      console.log(`With Unassigned Users: ${JSON.stringify(unassigned)}`);
      expect(unassigned).not.toContain('ROBAR');
    });

    await test.step('"*" (All) is exclusive: checking it disables and unchecks every named entity; unchecking it frees them', async () => {
      f = await listUsers(USERS);
      const u = await openUpdate(f, [USERS[1]]);
      await box(u, '*').check();
      await page.waitForTimeout(800);
      let states = await boxes(u);
      console.log(`after checking *: ${JSON.stringify(states)}`);
      for (const [name, s] of Object.entries(states)) if (name !== '*') expect(s, `${name} disabled+off`).toBe('off (disabled)');
      await box(u, '*').uncheck();
      await page.waitForTimeout(800);
      states = await boxes(u);
      for (const [name, s] of Object.entries(states)) if (name !== '*') expect(s, `${name} enabled again`).not.toContain('disabled');
    });

    await test.step('leaving with unsaved changes prompts "Changes will not be saved."; No stays, Yes leaves', async () => {
      f = await listUsers(USERS);
      const u = await openUpdate(f, USERS);
      await box(u, 'Vendors').check();
      await u.locator('a:has-text("User Print Entity Management")').first().click();
      await page.waitForTimeout(1500);
      const dlg = (await u.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
      console.log(`unsaved prompt: ${dlg}`);
      expect(dlg).toContain('Changes will not be saved');
      await u.locator('.ui-dialog:visible button').filter({ hasText: /^No$/ }).click();
      await page.waitForTimeout(800);
      expect(await box(u, 'Vendors').isChecked(), 'still on the update screen with the change').toBe(true);
      await u.locator('a:has-text("User Print Entity Management")').first().click();
      await page.waitForTimeout(1000);
      await u.locator('.ui-dialog:visible button').filter({ hasText: /^Yes$/ }).click();
      await page.waitForTimeout(3000);
    });
  } finally {
    await test.step('cleanup: remove every entity from the two MB users again', async () => {
      f = await listUsers(USERS);
      const u = await openUpdate(f, USERS);
      for (const [name, s] of Object.entries(await boxes(u))) {
        if (s.includes('disabled')) continue;
        if (s === 'on') await box(u, name).uncheck();
        else if (s === 'mixed') {
          await box(u, name).check(); // mixed -> all
          await box(u, name).uncheck(); // all -> none
        }
      }
      // Update stays disabled until something changed (nothing to remove = nothing to do)
      const text = (await u.locator('#btnUpdate').isEnabled()) ? await update(u) : 'nothing to remove';
      console.log(`cleanup: ${text.slice(0, 200)}`);
      f = await listUsers(USERS);
      console.log(`end state: ${JSON.stringify(await gridRows(f))}`);
    });
  }
});
