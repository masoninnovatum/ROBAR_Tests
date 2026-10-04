// Does Security Management actually change what a user sees and can do? Uses two FIXED MB* fixtures (created on first run, then
// reused -- groups/users cannot be deleted, so there is no per-run pollution): group `MBPWLoginGrp` and user `MBPWLogin01`
// (member of that group, password = seed password, no forced password change). The seed user (an administrator) edits the
// group's authorizations; the MB user logs in in a SECOND browser context and the Main Menu tiles are compared.
//   * module tiles appear/disappear with `MD_Management_Option`, `MD_JobInquiry_Option`, `View_Security`
//   * with only View_Security the Security Management page is read-only (no Add/Edit icons, all checkboxes disabled)
//   * a direct POST to the update endpoints as that read-only user (server-side authorization probe, MB group only)

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import * as sec from '../support/security';
import { loginAs, findFrame, PASSWORD } from '../support/robar';

const GROUP = 'MBPWLoginGrp';
const USER = 'MBPWLogin01';

test('Security Management changes drive the module tiles and the read-only Security page of a real MB user', async ({ page, browser }) => {
  test.setTimeout(480_000);
  sec.assertMb(GROUP);
  sec.assertMb(USER);
  let f: Frame = await sec.openSecurity(page);

  /** Sets the group's authorizations to exactly `processes` (clear all, then tick each). */
  const setGroupSet = async (processes: string[]) => {
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, GROUP));
    const current = await sec.readProcesses(f);
    if (Object.values(current).some(Boolean)) {
      // Select All unchecked -> everything off (it is shown checked only when all are on, so check then uncheck if needed)
      const selectAll = f.locator('#cbSelectAll');
      if (!(await selectAll.isChecked())) {
        await Promise.all([page.waitForResponse((r) => r.url().includes('/Security/UpdateAllSecurityProcesses'), { timeout: 20_000 }), selectAll.setChecked(true, { timeout: 5000 })]);
        await page.waitForTimeout(1000);
      }
      await Promise.all([page.waitForResponse((r) => r.url().includes('/Security/UpdateAllSecurityProcesses'), { timeout: 20_000 }), selectAll.setChecked(false, { timeout: 5000 })]);
      await page.waitForTimeout(1000);
    }
    for (const p of processes) expect((await sec.toggleProcess(page, f, GROUP, p, true)).Success).toBe(true);
    f = await sec.reopenSecurity(page);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, GROUP));
    const after = await sec.readProcesses(f);
    expect(Object.keys(after).filter((k) => after[k]).sort(), 'the group holds exactly the requested processes').toEqual([...processes].sort());
  };

  await test.step('fixtures: group MBPWLoginGrp and active user MBPWLogin01 in it (created only if missing)', async () => {
    await sec.setView(f, 'GROUP');
    if ((await sec.groupRow(f, GROUP).count()) === 0) {
      const d = await sec.openDialog(f, 'group', 'add');
      await d.locator('#group_input_groupid').fill(GROUP);
      await d.locator('#group_input_description').fill('Playwright login-effect test group');
      await sec.submitDialog(f);
      f = await sec.refreshFrame(page);
      console.log(`created fixture group ${GROUP}`);
    }
    await sec.setView(f, 'USER');
    if ((await sec.userRow(f, USER).count()) === 0) {
      const d = await sec.openDialog(f, 'user', 'add');
      await d.locator('#users_input_userid').fill(USER);
      await d.locator('#users_input_fullname').fill('Playwright login test user');
      await d.locator('#users_input_timezone').selectOption({ label: '[+00.00] Greenwich Mean Time' }, { timeout: 5000 });
      await d.locator('#users_input_group').selectOption({ label: GROUP }, { timeout: 5000 });
      await d.locator('#users_input_password').fill(PASSWORD);
      await d.locator('#users_input_confirmpassword').fill(PASSWORD);
      await d.locator('#users_input_resetpassword').uncheck();
      await sec.submitDialog(f);
      f = await sec.refreshFrame(page);
      console.log(`created fixture user ${USER}`);
    }
    await expect(sec.userRow(f, USER)).toHaveCount(1);
    await expect(sec.userRow(f, USER).locator('td#groupID')).toHaveText(GROUP);
    expect(await sec.userRow(f, USER).locator('td#userEnabled input').isChecked(), 'the fixture user is active').toBe(true);
  });

  /** Logs the MB user in (new context) and returns the sorted Main Menu tile names. */
  const tilesFor = async (): Promise<{ tiles: string[]; page: Page; close: () => Promise<void> }> => {
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    await loginAs(p, USER, PASSWORD);
    await p.waitForTimeout(2000);
    const tiles = (await p.locator('button.menuIcon').allInnerTexts()).map((t) => t.trim()).filter(Boolean).sort();
    return { tiles, page: p, close: () => ctx.close() };
  };

  // Every state below includes Login_WebMenu: it is the process the Web Menu login form checks (Web/WebMenu/Default.aspx
  // `MustBeAuthorizedFor="Login_WebMenu"`). Without it the login is refused before any tile is shown.
  const BASE = ['Login_WebMenu'];

  await test.step('S-1: no authorizations -> the login is refused ("User not authorized for this task.")', async () => {
    await setGroupSet([]);
    const ctx = await (browser as Browser).newContext();
    const p = await ctx.newPage();
    await loginAs(p, USER, PASSWORD);
    await p.waitForTimeout(1500);
    await expect(p.locator('body')).toContainText('User not authorized for this task.');
    expect(await p.locator('button.menuIcon').count(), 'no Main Menu').toBe(0);
    await expect(p.locator('.userID'), 'still on the login form').toBeVisible();
    await ctx.close();
  });

  const s0 = await test.step('S0: only Login_WebMenu -> the Main Menu opens with a baseline set of tiles', async () => {
    await setGroupSet(BASE);
    const r = await tilesFor();
    console.log(`S0 tiles (${r.tiles.length}): ${JSON.stringify(r.tiles)}`);
    await r.close();
    return r.tiles;
  });

  const s1 = await test.step('S1: + MD_Management_Option -> the Master Data tile appears', async () => {
    await setGroupSet([...BASE, 'MD_Management_Option']);
    const r = await tilesFor();
    console.log(`S1 added tiles: ${JSON.stringify(r.tiles.filter((t) => !s0.includes(t)))}`);
    await r.close();
    expect(r.tiles).toContain('Master Data');
    expect(s0, 'not visible before').not.toContain('Master Data');
    return r.tiles;
  });

  await test.step('S2: + MD_JobInquiry_Option -> MD Job Inquiry appears; removing MD_Management_Option removes Master Data again', async () => {
    await setGroupSet([...BASE, 'MD_Management_Option', 'MD_JobInquiry_Option']);
    let r = await tilesFor();
    console.log(`S2 added tiles vs S1: ${JSON.stringify(r.tiles.filter((t) => !s1.includes(t)))}`);
    await r.close();
    expect(r.tiles).toContain('MD Job Inquiry');
    expect(r.tiles).toContain('Master Data');
    await setGroupSet([...BASE, 'MD_JobInquiry_Option']);
    r = await tilesFor();
    await r.close();
    expect(r.tiles).toContain('MD Job Inquiry');
    expect(r.tiles, 'Master Data tile removed with its process').not.toContain('Master Data');
  });

  await test.step('S3: only View_Security -> Security Management opens READ-ONLY (no Add/Edit, all checkboxes disabled)', async () => {
    await setGroupSet([...BASE, 'View_Security']);
    const r = await tilesFor();
    console.log(`S3 tiles: ${JSON.stringify(r.tiles)}`);
    expect(r.tiles).toContain('Security Management');
    await r.page.click('button.menuIcon:has-text("Security Management")');
    const sf = await findFrame(r.page, 'Security/Management');
    await sf.locator('#group_tableBody_tbody tr').first().waitFor({ state: 'attached', timeout: 20_000 });
    await r.page.waitForTimeout(1500);
    expect(await sf.locator('#btnAddRecord').count(), 'no Add icon without Security_EditUsersAndGroups').toBe(0);
    expect(await sf.locator('#btnEditRecord').count(), 'no Edit icon').toBe(0);
    await sec.selectRow(r.page, sf, sec.groupRow(sf, GROUP));
    const enabled = await sf.locator('#processes_tableBody_tbody input.process_cb').evaluateAll((bs) => bs.filter((b) => !(b as HTMLInputElement).disabled).length);
    expect(enabled, 'all process checkboxes disabled without Security_EditSecurity').toBe(0);
    await expect(sf.locator('#cbSelectAll')).toBeDisabled();

    // Server-side authorization probe: the UI hides the controls, but does the endpoint refuse the write? (MB group only.)
    const probeProcess = 'MD_MassApprove_Option';
    const result = await sf.evaluate(async (args) => {
      const url = location.pathname.replace(/Management.*$/, 'UpdateSecurityProcess');
      const resp = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ userOrGroupId: args.group, process: args.process, isEnabled: true }) });
      return { status: resp.status, body: await resp.text() };
    }, { group: GROUP, process: probeProcess });
    console.log(`SERVER-SIDE PROBE (read-only user POSTs UpdateSecurityProcess for ${GROUP}/${probeProcess}): HTTP ${result.status} ${result.body.slice(0, 200)}`);
    await r.close();

    // read the outcome as the admin and put the group back
    f = await sec.reopenSecurity(page);
    await sec.setView(f, 'GROUP');
    await sec.selectRow(page, f, sec.groupRow(f, GROUP));
    const changed = (await sec.readProcesses(f))[probeProcess];
    console.log(`probe changed the group: ${changed}`);
    test.info().annotations.push({ type: 'server-side-authorization', description: `read-only user POST UpdateSecurityProcess -> HTTP ${result.status}; process ${changed ? 'WAS' : 'was NOT'} changed` });
    if (changed) await sec.toggleProcess(page, f, GROUP, probeProcess, false);
  });

  await test.step('cleanup: the fixture group is left with no authorizations', async () => {
    await setGroupSet([]);
  });
});
