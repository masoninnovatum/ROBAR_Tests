// Security Management helpers (Main Menu tile "Security Management", frame `InnoPages/Security/Management`). Source:
// Innovatum.Pages.SecurityManagement.MVC (Views/Security/Management.cshtml + AddEditGroup/AddEditUser.cshtml).
//
// Page anatomy (ids): view radios `#rbUsers` / `#rbGroups`; process-state radios `#rbAuth #rbUnauth #rbBoth`; filters
// `#groupFilterInput`+`#btnApplyGroupFilter`, `#userFilterColumnSelect`+`#userFilterInput`+`#btnApplyUserFilter`,
// `#cbActiveUsersOnly`, `#processFilterInput`, `#cbSelectAll`. Tables are plain <table>s, not jqGrid: `#group_tableBody_tbody tr`
// (td#groupID + description), `#user_tableBody_tbody tr` (td#userID, #fullName, #groupID, hidden #userEnabled checkbox),
// `#processes_tableBody_tbody tr` (process name td + `input.process_cb`). Add/Edit icons `#btnAddRecord` / `#btnEditRecord`
// (rendered only with Security_EditUsersAndGroups). There is NO Save button and NO delete: every process checkbox posts
// immediately (`UpdateSecurityProcess` / `UpdateAllSecurityProcesses`), and groups/users can never be deleted (users can be
// deactivated). Selecting a row loads that group's (or ungrouped user's / group-member's group's) processes.
//
// RULE (user): only users/groups whose name starts with "MB" may be changed. The helpers refuse anything else.

import type { Frame, Page, Locator } from '@playwright/test';
import { expect } from '@playwright/test';
import { login, openMenuItem, findFrame, PASSWORD } from './robar';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Throws unless `name` starts with "MB" (case-insensitive): the standing guard for every write in this module. */
export function assertMb(name: string): void {
  if (!/^mb/i.test(name)) throw new Error(`Refusing to change security for "${name}": only users/groups starting with "MB" may be edited.`);
}

export async function openSecurity(page: Page): Promise<Frame> {
  await login(page);
  return reopenSecurity(page);
}

/** Closes the Security Management tab (if open) and opens it again from the Main Menu. */
export async function reopenSecurity(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Security Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Security Management');
  const f = await findFrame(page, 'Security/Management');
  await f.locator('#group_tableBody_tbody tr').first().waitFor({ timeout: 20_000 });
  await delay(1500);
  return f;
}

/** Re-resolves the frame after the page navigated itself (Add/Edit Submit reloads the Management page). */
export async function refreshFrame(page: Page): Promise<Frame> {
  await delay(2500);
  const f = await findFrame(page, 'Security/Management');
  // (the table of the NON-default view is hidden, so wait for the row to be attached, not visible)
  await f.locator('#group_tableBody_tbody tr').first().waitFor({ state: 'attached', timeout: 20_000 });
  await delay(1000);
  return f;
}

export async function setView(f: Frame, view: 'USER' | 'GROUP'): Promise<void> {
  await f.locator(view === 'USER' ? '#rbUsers' : '#rbGroups').click({ timeout: 5000 });
  await delay(1500);
}

export function groupRow(f: Frame, group: string): Locator {
  return f.locator('#group_tableBody_tbody tr').filter({ has: f.locator('td#groupID', { hasText: new RegExp('^' + group.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
}

export function userRow(f: Frame, userId: string): Locator {
  return f.locator('#user_tableBody_tbody tr').filter({ has: f.locator('td#userID', { hasText: new RegExp('^' + userId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$', 'i') }) });
}

/** Filters the Groups view by name and returns once applied. */
export async function filterGroups(f: Frame, text: string): Promise<void> {
  await f.locator('#groupFilterInput').fill(text, { timeout: 5000 });
  await f.locator('#btnApplyGroupFilter').click({ timeout: 5000 });
  await delay(800);
}

export async function filterUsers(f: Frame, column: 'USERID' | 'FULLNAME' | 'GROUP', text: string): Promise<void> {
  await f.locator('#userFilterColumnSelect').selectOption(column, { timeout: 5000 });
  await f.locator('#userFilterInput').fill(text, { timeout: 5000 });
  await f.locator('#btnApplyUserFilter').click({ timeout: 5000 });
  await delay(800);
}

/** Sets the "Process contains" filter. It listens for `keyup`, which `fill()` does not fire, so dispatch it explicitly. */
export async function filterProcesses(f: Frame, text: string): Promise<void> {
  await f.locator('#processFilterInput').fill(text, { timeout: 5000 });
  await f.locator('#processFilterInput').dispatchEvent('keyup');
  await delay(500);
}

/** Clicks a row (group or user) and waits for its processes to load. */
export async function selectRow(page: Page, f: Frame, row: Locator): Promise<void> {
  await Promise.all([
    page.waitForResponse((r) => r.url().includes('/Security/GetSecurityProcesses'), { timeout: 15_000 }).catch(() => null),
    row.first().click({ timeout: 5000 }),
  ]);
  await delay(1200);
}

export function processRow(f: Frame, process: string): Locator {
  return f.locator('#processes_tableBody_tbody tr').filter({ has: f.locator('td', { hasText: new RegExp('^' + process.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '$') }) });
}

export function processBox(f: Frame, process: string): Locator {
  return processRow(f, process).locator('input.process_cb');
}

/** All processes as name -> authorized (reads every row, including filtered-out ones). */
export async function readProcesses(f: Frame): Promise<Record<string, boolean>> {
  const rows = await f.locator('#processes_tableBody_tbody tr').evaluateAll((trs) =>
    trs.map((tr) => [(tr.querySelector('td')?.textContent ?? '').trim(), (tr.querySelector('input.process_cb') as HTMLInputElement | null)?.checked ?? false] as [string, boolean])
  );
  return Object.fromEntries(rows);
}

/** Toggles one process of the SELECTED group/user and returns the server's JSON ({Success, Errors}). */
export async function toggleProcess(page: Page, f: Frame, group: string, process: string, authorized: boolean): Promise<any> {
  assertMb(group);
  const box = processBox(f, process);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/Security/UpdateSecurityProcess'), { timeout: 15_000 }),
    box.setChecked(authorized, { timeout: 5000 }),
  ]);
  return response.json();
}

/** Opens the Add (name undefined) or Edit dialog for the SELECTED group/user and waits for it to load. */
export async function openDialog(f: Frame, kind: 'group' | 'user', mode: 'add' | 'edit'): Promise<Locator> {
  await f.locator(mode === 'add' ? '#btnAddRecord' : '#btnEditRecord').click({ timeout: 5000 });
  const dialog = f.locator(kind === 'group' ? '#addEditGroupDialog' : '#addEditUserDialog');
  await dialog.locator(kind === 'group' ? '#group_input_groupid' : '#users_input_userid').waitFor({ timeout: 15_000 });
  await delay(500);
  return dialog;
}

export async function submitDialog(f: Frame): Promise<void> {
  await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: /^Submit$/ }).click({ timeout: 5000 });
}

export async function cancelDialog(f: Frame): Promise<void> {
  await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: /^Cancel$/ }).click({ timeout: 5000 });
  await delay(500);
}

/** Visible validation messages inside the open Add/Edit dialog. */
export async function dialogMessages(f: Frame): Promise<string[]> {
  return (await f.locator('.SMValidation:not(.hidden) .sm-form-validation-message').allInnerTexts()).map((t) => t.trim()).filter(Boolean);
}

export const TEST_PASSWORD = PASSWORD; // new MB test users reuse the seed password so negative-permission logins are possible
export { expect };
