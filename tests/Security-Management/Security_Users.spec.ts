// Security Management > Users view (source: Innovatum.Pages.SecurityManagement.MVC). Only an MB* user created by this run is
// written; existing users are only read. Users can never be deleted (only deactivated), so each run leaves one `MBPWU<stamp>`
// user behind (deactivated at the end). The new user's password is the seed password, so a negative-permission login is
// possible (see Security_Effect_On_Login.spec.ts).
//   * Users view: columns, filters (UserID / Full Name / Group), Active Users Only
//   * Add User: validation (blank, too long, password mismatch, duplicate), defaults, Copy Security Settings From
//   * a user WITHOUT a group has its own editable process set; assigning a Group replaces it with the group's set (read-only);
//     removing the group reverts to the user's own set
//   * Edit User: User Id locked; deactivate -> greyed row, hidden by Active Users Only

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as sec from '../support/security';
import { PASSWORD } from '../support/robar';

test('Security Management Users: filters, add/edit user, copy security, group inheritance and deactivation', async ({ page }) => {
  test.setTimeout(420_000);
  const stamp = Date.now().toString().slice(-6);
  const user = `MBPWU${stamp}`;
  const SOURCE_GROUP = 'MBSomeSecurity';
  let f: Frame = await sec.openSecurity(page);

  const authorized = async () => {
    const m = await sec.readProcesses(f);
    return Object.keys(m).filter((k) => m[k]).sort();
  };

  await test.step('Users view: columns and the UserID / Full Name / Group filters', async () => {
    await sec.setView(f, 'USER');
    await expect(f.locator('#usersTable')).toBeVisible();
    await expect(f.locator('#groupsTable')).toBeHidden();
    expect((await f.locator('#usersTable thead th').allInnerTexts()).map((t) => t.trim())).toEqual(['UserID', 'Full Name', 'Group']);
    expect((await f.locator('#userFilterColumnSelect option').allInnerTexts()).map((t) => t.trim())).toEqual(['UserID', 'Full Name', 'Group']);
    await expect(f.locator('#cbActiveUsersOnly')).not.toBeChecked();
    const total = await f.locator('#user_tableBody_tbody tr:not(.hidden)').count();
    expect(total).toBeGreaterThan(20);

    await sec.filterUsers(f, 'USERID', 'mbuser1');
    const byId = (await f.locator('#user_tableBody_tbody tr:not(.hidden) td#userID').allInnerTexts()).map((t) => t.trim());
    expect(byId.length).toBeGreaterThan(0);
    for (const id of byId) expect(id.toLowerCase()).toContain('mbuser1');
    await sec.filterUsers(f, 'GROUP', SOURCE_GROUP);
    const byGroup = (await f.locator('#user_tableBody_tbody tr:not(.hidden) td#groupID').allInnerTexts()).map((t) => t.trim());
    console.log(`users in ${SOURCE_GROUP}: ${byGroup.length}`);
    for (const g of byGroup) expect(g.toLowerCase()).toContain(SOURCE_GROUP.toLowerCase());
    await sec.filterUsers(f, 'FULLNAME', 'zzzz-no-such-name');
    expect(await f.locator('#user_tableBody_tbody tr:not(.hidden)').count()).toBe(0);
    await sec.filterUsers(f, 'USERID', '');
    expect(await f.locator('#user_tableBody_tbody tr:not(.hidden)').count()).toBe(total);
  });

  await test.step('Add User: defaults and validation (blank, too long, password mismatch, duplicate)', async () => {
    const d = await sec.openDialog(f, 'user', 'add');
    await expect(d.locator('#users_input_active')).toBeChecked();
    await expect(d.locator('#users_input_adauth')).not.toBeChecked();
    await expect(d.locator('#users_input_resetpassword'), 'reset password at next logon is on by default').toBeChecked();
    expect((await d.locator('#users_input_facility option').allInnerTexts())[0].trim()).toBe('Choose one...');
    expect((await d.locator('#users_input_timezone option').allInnerTexts())[0].trim()).toBe('Choose one...');

    await sec.submitDialog(f);
    await page.waitForTimeout(1200);
    expect(await sec.dialogMessages(f)).toEqual(['The User ID field cannot be left blank', 'FullName is required', 'TimeZone is required', 'Password is required']);

    await d.locator('#users_input_userid').fill('x'.repeat(31));
    await d.locator('#users_input_fullname').fill('y'.repeat(81));
    await d.locator('#users_input_email').fill('z'.repeat(256));
    await d.locator('#users_input_password').fill('abc');
    await d.locator('#users_input_confirmpassword').fill('abd');
    await sec.submitDialog(f);
    await page.waitForTimeout(1500);
    expect(await sec.dialogMessages(f)).toEqual([
      'UserID can not be longer than 30 characters',
      'FullName can not be longer than 80 characters',
      'Email can not be longer than 255 characters',
      'TimeZone is required',
      'Password values do not match',
    ]);

    // group and copy-security are mutually exclusive: choosing one disables the other
    await d.locator('#users_input_group').selectOption({ label: SOURCE_GROUP }, { timeout: 5000 });
    await expect(d.locator('#users_input_copysecurity')).toBeDisabled();
    await d.locator('#users_input_group').selectOption({ index: 0 });
    await expect(d.locator('#users_input_copysecurity')).toBeEnabled();
    await d.locator('#users_input_copysecurity').selectOption({ label: `GROUP - ${SOURCE_GROUP}` }, { timeout: 5000 });
    await expect(d.locator('#users_input_group')).toBeDisabled();
    await d.locator('#users_input_copysecurity').selectOption({ index: 0 });
    await expect(d.locator('#users_input_group')).toBeEnabled();

    // duplicate user id (existing, case-insensitive) is refused with an error dialog
    await d.locator('#users_input_userid').fill('mbuser1');
    await d.locator('#users_input_fullname').fill('duplicate attempt');
    await d.locator('#users_input_email').fill('');
    await d.locator('#users_input_password').fill(PASSWORD);
    await d.locator('#users_input_confirmpassword').fill(PASSWORD);
    await d.locator('#users_input_timezone').selectOption({ index: 1 });
    await sec.submitDialog(f);
    const dup = f.locator('.ui-dialog:visible').filter({ hasText: 'already exists' });
    await expect(dup).toHaveCount(1, { timeout: 10_000 });
    expect((await dup.innerText()).replace(/\s+/g, ' ')).toContain('User already exists with UserID:');
    await dup.getByRole('button', { name: 'Continue' }).click({ timeout: 5000 });
    await sec.cancelDialog(f);
  });

  await test.step(`Add User ${user} with "Copy Security Settings From = GROUP - ${SOURCE_GROUP}": ungrouped, with its own copy of the set`, async () => {
    sec.assertMb(user);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, SOURCE_GROUP));
    const sourceSet = await authorized();
    await sec.setView(f, 'USER');
    const d = await sec.openDialog(f, 'user', 'add');
    await d.locator('#users_input_userid').fill(user);
    await d.locator('#users_input_fullname').fill('Playwright security test user');
    await d.locator('#users_input_email').fill('pw.security@example.invalid');
    await d.locator('#users_input_facility').selectOption({ label: 'Atlanta Test' }, { timeout: 5000 });
    await d.locator('#users_input_timezone').selectOption({ label: '[+00.00] Greenwich Mean Time' }, { timeout: 5000 });
    await d.locator('#users_input_password').fill(PASSWORD);
    await d.locator('#users_input_confirmpassword').fill(PASSWORD);
    await d.locator('#users_input_copysecurity').selectOption({ label: `GROUP - ${SOURCE_GROUP}` }, { timeout: 5000 });
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    await expect(f.locator('#usersTable')).toBeVisible();
    await expect(sec.userRow(f, user)).toHaveCount(1);
    await expect(sec.userRow(f, user).locator('td#groupID'), 'ungrouped').toHaveText('');
    await sec.selectRow(page, f, sec.userRow(f, user));
    expect(await authorized(), 'the user got its own copy of the group\'s authorizations').toEqual(sourceSet);
    await expect(sec.processBox(f, 'MD_MassApprove_Option'), 'an ungrouped user\'s own checkboxes are editable').toBeEnabled();
    // toggle one off for the user only and check it persisted + the SOURCE group is untouched
    const probe = sourceSet.includes('MD_MassApprove_Option') ? 'MD_MassApprove_Option' : sourceSet[0];
    expect((await sec.toggleProcess(page, f, user, probe, false)).Success).toBe(true);
    f = await sec.reopenSecurity(page);
    await sec.setView(f, 'USER');
    await sec.selectRow(page, f, sec.userRow(f, user));
    expect((await sec.readProcesses(f))[probe], 'user-level change persisted').toBe(false);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, SOURCE_GROUP));
    expect((await sec.readProcesses(f))[probe], 'the source group was not changed').toBe(true);
    await sec.setView(f, 'USER');
  });

  await test.step('assigning a Group replaces the user\'s set with the group\'s (read-only); removing it reverts', async () => {
    await sec.selectRow(page, f, sec.userRow(f, user));
    const ownSet = await authorized();
    // assign
    let d = await sec.openDialog(f, 'user', 'edit');
    await expect(d.locator('#users_input_userid'), 'User Id is locked in Edit mode').toBeDisabled();
    await expect(d.locator('#users_input_userid')).toHaveValue(user);
    await d.locator('#users_input_group').selectOption({ label: SOURCE_GROUP }, { timeout: 5000 });
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    await expect(sec.userRow(f, user).locator('td#groupID')).toHaveText(SOURCE_GROUP);
    await sec.selectRow(page, f, sec.userRow(f, user));
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, SOURCE_GROUP));
    const groupSet = await authorized();
    await sec.setView(f, 'USER');
    await sec.selectRow(page, f, sec.userRow(f, user));
    expect(await authorized(), 'a grouped user shows the group\'s authorizations').toEqual(groupSet);
    const anyEnabled = await f.locator('#processes_tableBody_tbody input.process_cb').evaluateAll((bs) => bs.some((b) => !(b as HTMLInputElement).disabled));
    expect(anyEnabled, 'every checkbox is disabled for a grouped user (edit the group instead)').toBe(false);
    await expect(f.locator('#cbSelectAll')).toBeDisabled();

    // remove the group
    d = await sec.openDialog(f, 'user', 'edit');
    await d.locator('#users_input_group').selectOption({ index: 0 });
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    await expect(sec.userRow(f, user).locator('td#groupID')).toHaveText('');
    await sec.selectRow(page, f, sec.userRow(f, user));
    const reverted = await authorized();
    console.log(`own set before assigning: ${ownSet.length}; group set: ${groupSet.length}; after removing the group: ${reverted.length}`);
    // Observed: the user's OWN set is NOT remembered across a group assignment -- after the group is removed every process is
    // unauthorized (the user-level rows were replaced when the group was assigned), not the copy made at creation.
    expect(ownSet.length, 'the user had its own copied set before').toBeGreaterThan(300);
    expect(reverted, 'after removing the group the user starts again with NOTHING authorized').toEqual([]);
    await expect(sec.processBox(f, 'MD_MassApprove_Option'), 'and the checkboxes are editable again').toBeEnabled();
  });

  await test.step('Edit User: deactivate -> greyed row, hidden by "Show Active Users Only"; details persist', async () => {
    await sec.selectRow(page, f, sec.userRow(f, user));
    const d = await sec.openDialog(f, 'user', 'edit');
    await expect(d.locator('#users_input_fullname')).toHaveValue('Playwright security test user');
    await expect(d.locator('#users_input_email')).toHaveValue('pw.security@example.invalid');
    await expect(d.locator('#users_input_facility')).toHaveValue('Atlanta Test');
    await expect(d.locator('#users_input_timezone')).toHaveValue('GMT');
    await expect(d.locator('#users_input_active')).toBeChecked();
    await d.locator('#users_input_fullname').fill('Playwright security test user (inactive)');
    await d.locator('#users_input_active').uncheck();
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    const row = sec.userRow(f, user);
    await expect(row).toContainText('(inactive)');
    expect(await row.locator('td#userEnabled input').isChecked(), 'enabled flag cleared').toBe(false);
    expect(await row.evaluate((r) => getComputedStyle(r).color), 'inactive users are greyed (#AAA)').toBe('rgb(170, 170, 170)');
    await f.locator('#cbActiveUsersOnly').check({ timeout: 5000 });
    await page.waitForTimeout(800);
    await expect(row, 'hidden by Show Active Users Only').toHaveClass(/hidden/);
    await f.locator('#cbActiveUsersOnly').uncheck({ timeout: 5000 });
    await page.waitForTimeout(800);
    await expect(row).not.toHaveClass(/hidden/);
  });
});
