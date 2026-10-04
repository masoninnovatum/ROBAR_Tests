// Security Management > Groups view (source: Innovatum.Pages.SecurityManagement.MVC). Everything that is WRITTEN is done on a
// group created by this run whose name starts with "MB" (standing rule: only MB* users/groups may be changed); existing groups
// are only read. Groups can never be deleted, so each run leaves one `MBPWG<stamp>` group behind (accepted).
//   * layout, Group filter, process filter and the Authorized / Unauthorized / Both radios
//   * Add Group: validation (blank, too long, duplicate), Copy Security Settings From
//   * Edit Group: Group name is locked, Description editable
//   * process checkboxes post immediately; they persist across a reload; Select All

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as sec from '../support/security';

test('Security Management Groups: filters, add/edit group, copy security, toggle processes and Select All', async ({ page }) => {
  test.setTimeout(420_000);
  const stamp = Date.now().toString().slice(-6);
  const group = `MBPWG${stamp}`;
  const SOURCE = 'MBSomeSecurity';
  let f: Frame = await sec.openSecurity(page);

  await test.step('layout: Groups is the default view; process table lists every process; filters narrow it', async () => {
    await expect(f.locator('#rbGroups')).toBeChecked();
    await expect(f.locator('#rbBoth')).toBeChecked();
    expect(await f.locator('#group_tableBody_tbody tr').count(), 'many groups exist').toBeGreaterThan(20);
    await sec.filterGroups(f, 'MBTestGroup1');
    const visible = (await f.locator('#group_tableBody_tbody tr:not(.hidden)').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    expect(visible).toEqual(['MBTestGroup1 MB QA test group - edited']);
    await sec.filterGroups(f, 'mbtestgroup'); // case-insensitive "contains"
    expect(await f.locator('#group_tableBody_tbody tr:not(.hidden)').count()).toBeGreaterThanOrEqual(1);
    await sec.filterGroups(f, '');

    await sec.selectRow(page, f, sec.groupRow(f, 'MBTestGroup1'));
    const all = await sec.readProcesses(f);
    const names = Object.keys(all);
    console.log(`processes: ${names.length}; MBTestGroup1 authorized: ${names.filter((n) => all[n]).length}`);
    expect(names.length).toBeGreaterThan(300);

    // process-state radios and the Process contains filter (instant, no button)
    await f.locator('#rbAuth').click();
    const authOnly = await f.locator('#processes_tableBody_tbody tr:not(.hidden) input.process_cb').evaluateAll((bs) => bs.map((b) => (b as HTMLInputElement).checked));
    expect(authOnly.length).toBe(names.filter((n) => all[n]).length);
    expect(authOnly.every(Boolean), 'Authorized shows only checked rows').toBe(true);
    await f.locator('#rbUnauth').click();
    const unauthOnly = await f.locator('#processes_tableBody_tbody tr:not(.hidden) input.process_cb').evaluateAll((bs) => bs.map((b) => (b as HTMLInputElement).checked));
    expect(unauthOnly.length).toBe(names.filter((n) => !all[n]).length);
    expect(unauthOnly.some(Boolean), 'Unauthorized shows only unchecked rows').toBe(false);
    await f.locator('#rbBoth').click();
    await expect(f.locator('#selectAllParentDiv'), 'Select All is shown only when no process row is filtered out').not.toHaveClass(/hidden/);
    await sec.filterProcesses(f, 'md_massapp');
    const matching = (await f.locator('#processes_tableBody_tbody tr:not(.hidden) td:first-child').allInnerTexts()).map((t) => t.trim());
    console.log(`process filter "md_massapp": ${JSON.stringify(matching)}`);
    expect(matching.length).toBeGreaterThan(0);
    for (const m of matching) expect(m.toLowerCase()).toContain('md_massapp');
    await expect(f.locator('#selectAllParentDiv'), 'Select All is hidden while a filter hides rows').toHaveClass(/hidden/);
    await sec.filterProcesses(f, '');
  });

  await test.step('Add Group: dialog fields and validation (blank, too long, duplicate)', async () => {
    const d = await sec.openDialog(f, 'group', 'add');
    const copyOptions = (await d.locator('#group_input_copysecurity option').allInnerTexts()).map((t) => t.trim());
    expect(copyOptions[0]).toBe('Choose one...');
    expect(copyOptions).toEqual(expect.arrayContaining([`GROUP - ${SOURCE}`, 'GROUP - MBTestGroup1']));
    console.log(`copy-from entries look like: ${JSON.stringify(copyOptions.filter((o) => !o.startsWith('GROUP')).slice(0, 3))} ...`);

    await sec.submitDialog(f);
    await page.waitForTimeout(1200);
    expect(await sec.dialogMessages(f)).toEqual(['The Group field cannot be left blank', 'Description is required']);

    await d.locator('#group_input_groupid').fill('x'.repeat(31));
    await d.locator('#group_input_description').fill('y'.repeat(81));
    await sec.submitDialog(f);
    await page.waitForTimeout(1500);
    expect(await sec.dialogMessages(f)).toEqual(['GroupID can not be longer than 30 characters', 'Description can not be longer than 80 characters']);

    await d.locator('#group_input_groupid').fill('MBTestGroup1');
    await d.locator('#group_input_description').fill('duplicate attempt');
    await sec.submitDialog(f);
    const err = f.locator('.ui-dialog:visible').filter({ hasText: 'already exists' });
    await expect(err).toHaveCount(1, { timeout: 10_000 });
    expect((await err.innerText()).replace(/\s+/g, ' ')).toContain('Group already exists with GroupID: MBTestGroup1');
    await err.getByRole('button', { name: 'Continue' }).click({ timeout: 5000 });
    // the (case-insensitive) duplicate is refused too
    await d.locator('#group_input_groupid').fill('mbtestgroup1');
    await sec.submitDialog(f);
    await expect(f.locator('.ui-dialog:visible').filter({ hasText: 'already exists' })).toHaveCount(1, { timeout: 10_000 });
    await f.locator('.ui-dialog:visible').filter({ hasText: 'already exists' }).getByRole('button', { name: 'Continue' }).click({ timeout: 5000 });
    await sec.cancelDialog(f);
    await expect(f.locator('#addEditGroupDialog')).toHaveCount(0);
  });

  /** The sorted names of authorized processes of the SELECTED row. */
  const authorized = async () => {
    const m = await sec.readProcesses(f);
    return Object.keys(m).filter((k) => m[k]).sort();
  };

  let sourceSet: string[] = [];
  await test.step(`read ${SOURCE}'s authorizations (to compare with the copy)`, async () => {
    await sec.selectRow(page, f, sec.groupRow(f, SOURCE));
    sourceSet = await authorized();
    console.log(`${SOURCE}: ${sourceSet.length} authorized`);
    expect(sourceSet.length).toBeGreaterThan(0);
  });

  await test.step(`Add Group with "Copy Security Settings From = GROUP - ${SOURCE}" creates ${group} with the same authorizations`, async () => {
    sec.assertMb(group);
    const d = await sec.openDialog(f, 'group', 'add');
    await d.locator('#group_input_groupid').fill(group);
    await d.locator('#group_input_description').fill('Playwright security test group');
    await d.locator('#group_input_copysecurity').selectOption({ label: `GROUP - ${SOURCE}` }, { timeout: 5000 });
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    await expect(sec.groupRow(f, group)).toHaveCount(1);
    await sec.selectRow(page, f, sec.groupRow(f, group));
    expect(await authorized(), 'the copy has exactly the source\'s authorizations').toEqual(sourceSet);
  });

  await test.step('Edit Group: the Group name is locked, the Description can be changed', async () => {
    await sec.selectRow(page, f, sec.groupRow(f, group));
    const d = await sec.openDialog(f, 'group', 'edit');
    await expect(d.locator('#group_input_groupid')).toBeDisabled();
    await expect(d.locator('#group_input_groupid')).toHaveValue(group);
    await expect(d.locator('#group_input_description')).toHaveValue('Playwright security test group');
    await expect(d.locator('#group_input_copysecurity'), 'Copy Security Settings From is hidden in Edit mode').toBeHidden();
    await d.locator('#group_input_description').fill('Playwright security test group (edited)');
    await sec.submitDialog(f);
    f = await sec.refreshFrame(page);
    await expect(sec.groupRow(f, group)).toContainText('(edited)');
  });

  const probe = 'MD_MassApprove_Option';
  await test.step('a process checkbox posts immediately and persists across a reload', async () => {
    await sec.selectRow(page, f, sec.groupRow(f, group));
    const before = (await sec.readProcesses(f))[probe];
    const first = await sec.toggleProcess(page, f, group, probe, !before);
    expect(first.Success).toBe(true);
    f = await sec.reopenSecurity(page);
    await sec.selectRow(page, f, sec.groupRow(f, group));
    expect((await sec.readProcesses(f))[probe], 'the toggle was saved with no Save button').toBe(!before);
    // and back
    expect((await sec.toggleProcess(page, f, group, probe, before)).Success).toBe(true);
    f = await sec.reopenSecurity(page);
    await sec.selectRow(page, f, sec.groupRow(f, group));
    expect((await sec.readProcesses(f))[probe]).toBe(before);
    expect(await authorized(), 'back to the copied set').toEqual(sourceSet);
  });

  await test.step('Select All authorizes every process; unchecking it removes them all', async () => {
    await sec.selectRow(page, f, sec.groupRow(f, group));
    await Promise.all([page.waitForResponse((r) => r.url().includes('/Security/UpdateAllSecurityProcesses'), { timeout: 20_000 }), f.locator('#cbSelectAll').setChecked(true, { timeout: 5000 })]);
    await page.waitForTimeout(1500);
    let all = await sec.readProcesses(f);
    expect(Object.values(all).every(Boolean), 'every process checked on screen').toBe(true);
    f = await sec.reopenSecurity(page);
    await sec.selectRow(page, f, sec.groupRow(f, group));
    all = await sec.readProcesses(f);
    expect(Object.values(all).every(Boolean), 'and saved').toBe(true);
    await expect(f.locator('#cbSelectAll')).toBeChecked();

    await Promise.all([page.waitForResponse((r) => r.url().includes('/Security/UpdateAllSecurityProcesses'), { timeout: 20_000 }), f.locator('#cbSelectAll').setChecked(false, { timeout: 5000 })]);
    await page.waitForTimeout(1500);
    f = await sec.reopenSecurity(page);
    await sec.selectRow(page, f, sec.groupRow(f, group));
    all = await sec.readProcesses(f);
    expect(Object.values(all).some(Boolean), 'everything removed').toBe(false);
    // (the throw-away group is simply left with no authorizations)
  });
});
