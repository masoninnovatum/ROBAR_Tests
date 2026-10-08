// Workflow Management > Bulk Actions > Edit Workflows (live 2026-10-05, Claude01): the bulk step editor changes the steps of the
// ticked OPEN workflows in one job: Actions > Delete User / Replace User / Add User (at Beginning / at End / to Group).
// Two throw-away workflows A and B are created from a throw-away one-step preset (test user), then edited together:
//   add MBUser3 at END, add MBUser4 at BEGINNING, replace MBUser3 by MBUser5, delete MBUser4, delete MBUser5
// after every job the Steps tab of workflow A is read to prove the new step order. Finally the workflows are closed (A approved,
// B rejected) by the test user, whose step is the only one left. Step users only need to be in the list (no security is touched).
// Workflows cannot be deleted (closed ones are left behind); the preset is deleted. Leftover OPEN `PW edit` workflows from a failed
// earlier run are rejected at the start.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 }); // a wrong selector must fail in seconds, not at the 15 minute test timeout

test('Edit Workflows: add user at end / beginning, replace user, delete user on two open workflows', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: Record<string, string> = {};
  let f: Frame = await wf.openWorkflowManagement(page);

  const mgmt = () => wf.lastFrame(page, 'WorkflowManagement/Management');
  /** Management > tick A and B (newest first) > Bulk Actions > Edit Workflows; returns the Edit frame. */
  const openEdit = async (): Promise<Frame> => {
    f = await wf.showNewestFirst(page);
    for (const key of ['A', 'B']) await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids[key] }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await f.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actWfEdit').click({ force: true });
    await page.waitForTimeout(5000);
    const ef = wf.lastFrame(page, 'WorkflowManagement/Edit');
    await expect(ef.locator('body')).toContainText('2 Workflows Selected', { timeout: 15_000 });
    return ef;
  };
  const stepsOnEditPage = async (ef: Frame) => (await ef.locator('#grdWorkflows .grid-approvalgroup a').allInnerTexts()).map((t) => t.trim());
  /** The user select of the step form: pick the option that starts with `prefix`. */
  const pickUser = async (ef: Frame, select: string, prefix: string) => {
    const opt = (await ef.locator(`${select} option`).allInnerTexts()).map((t) => t.trim()).find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
    expect(opt, `${prefix} in ${select}`).toBeTruthy();
    await ef.locator(select).selectOption({ label: opt! });
  };
  /** Job result text after an edit action (the page changes to the edit job detail). */
  const jobText = async (): Promise<string> => {
    let text = '';
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2500);
      const jf = wf.lastFrame(page, 'WorkflowManagement');
      text = (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/Status Completed/.test(text)) break;
    }
    console.log(`edit job: ${text.slice(0, 600)}`);
    return text;
  };
  /** Steps tab of workflow A: the voters listed in order (rows of the Steps table, column 1). */
  const stepsOfA = async (): Promise<string[]> => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids.A }).getByText('Detail').click();
    await page.waitForTimeout(3500);
    await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Steps' }).click();
    await page.waitForTimeout(1500);
    const rows = (await f.locator('.ui-dialog:visible table tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    console.log(`steps of A: ${JSON.stringify(rows)}`);
    // only the Steps table (the Comments & History tab also mentions every added user: "Workflow step for mbuser3 created by ...")
    const from = rows.findIndex((r) => r.startsWith('User Group Department'));
    const to = rows.findIndex((r) => r.startsWith('User Attach'));
    return rows.slice(from + 1, to < 0 ? undefined : to);
  };
  const addUser = async (ef: Frame, where: 'lnkAddToEnd' | 'lnkAddToBeginning', user: string) => {
    await ef.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await ef.getByText('Add User', { exact: true }).hover();
    await page.waitForTimeout(800);
    await ef.locator(`#${where}`).click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    await pickUser(ef, '#dvMainEdit #drpUser', `${user} (`);
    await ef.locator('#btCreateStep').click({ timeout: 5000 });
  };

  try {
    await test.step('setup: preset with one step for the test user; reject leftover open "PW edit" workflows; create workflows A and B', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
      f = await wf.showNewestFirst(page, 'Open Only');
      const left = f.locator('#gridResults tr.jqgrow').filter({ hasText: /PW edit [AB] \d+/ });
      const n = await left.count();
      console.log(`leftover open PW edit workflows: ${n}`);
      if (n > 0) {
        console.log(`leftovers: ${JSON.stringify((await left.allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()))}`);
        // best effort: a leftover whose current step belongs to another user (an aborted earlier run) cannot be voted by the test user
        try {
          for (let i = 0; i < n; i++) await left.nth(i).locator('input[type=checkbox]').check({ timeout: 10_000 });
          await page.waitForTimeout(1500);
          const text = await wf.voteTickedWorkflows(page, f, Array(n).fill('reject'), USERNAME, PASSWORD, 'Closed by Playwright cleanup');
          expect(text).toContain('Status Completed');
        } catch (e) {
          console.log(`leftover cleanup skipped: ${String(e).slice(0, 200)}`);
        }
        f = await wf.openWorkflowManagement(page);
      }
      ids.A = await wf.createWorkflow(page, preset, `PW edit A ${stamp}`, 'Edit workflows test A');
      ids.B = await wf.createWorkflow(page, preset, `PW edit B ${stamp}`, 'Edit workflows test B');
      console.log(`created ${ids.A} and ${ids.B}`);
    });

    await test.step('Edit Workflows lists both workflows with the identical step list as ONE group (Count 2)', async () => {
      const ef = await openEdit();
      expect(await ef.locator('#grdWorkflows tr.jqgrow').count(), 'identical workflows are one grid row').toBe(1);
      expect((await ef.locator('#grdWorkflows tr.jqgrow td[aria-describedby="grdWorkflows_Count"]').innerText()).trim()).toBe('2');
      expect((await stepsOnEditPage(ef)).map((s) => s.toLowerCase())).toEqual([expect.stringContaining(USERNAME.toLowerCase())]);
      // the Actions menu
      await ef.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await ef.getByText('Add User', { exact: true }).hover();
      await page.waitForTimeout(800);
      expect((await ef.locator('#lnkAddToBeginning, #lnkAddToEnd, #lnkAddToGroup, #lnkDeleteUser, #lnkReplaceUser').allInnerTexts()).map((t) => t.trim())).toEqual(
        expect.arrayContaining(['Delete User', 'Replace User']),
      );
    });

    await test.step('required user: Create with no user -> error "User must be selected."', async () => {
      const ef = wf.lastFrame(page, 'WorkflowManagement/Edit');
      // the Add User submenu is still open from the previous step
      await ef.locator('#lnkAddToEnd').click({ timeout: 5000 });
      await page.waitForTimeout(1500);
      await ef.locator('#btCreateStep').click({ timeout: 5000 });
      await page.waitForTimeout(1000);
      expect(await wf.dialogText(ef)).toContain('User must be selected.');
      await wf.dialogButton(ef, /^OK$/);
    });

    await test.step('Add User > Add to End: MBUser3 becomes the last step of BOTH workflows', async () => {
      const ef = wf.lastFrame(page, 'WorkflowManagement/Edit');
      await addUser(ef, 'lnkAddToEnd', 'MBUser3');
      const text = await jobText();
      expect(text).toMatch(/Status Completed/);
      const rows = await stepsOfA();
      expect(rows.findIndex((r) => /MBUser3/i.test(r)), 'MBUser3 listed after the test user').toBeGreaterThan(rows.findIndex((r) => new RegExp(USERNAME, 'i').test(r)));
    });

    await test.step('Add User > Add to Beginning: MBUser4 becomes the FIRST step', async () => {
      const ef = await openEdit();
      expect((await stepsOnEditPage(ef)).map((s) => s.toLowerCase()).join('|')).toContain('mbuser3');
      await addUser(ef, 'lnkAddToBeginning', 'MBUser4');
      expect(await jobText()).toMatch(/Status Completed/);
      const rows = await stepsOfA();
      const idx = (u: string) => rows.findIndex((r) => new RegExp(u, 'i').test(r));
      expect(idx('MBUser4'), 'MBUser4 first').toBeLessThan(idx(USERNAME));
      expect(idx(USERNAME)).toBeLessThan(idx('MBUser3'));
    });

    await test.step('Replace User: MBUser3 -> MBUser5', async () => {
      const ef = await openEdit();
      await ef.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await ef.locator('#lnkReplaceUser').click({ force: true });
      await page.waitForTimeout(1500);
      expect((await ef.locator('#drpUserToReplace option').allInnerTexts()).map((t) => t.trim().toLowerCase())).toEqual(
        expect.arrayContaining(['(select a user)', expect.stringContaining('mbuser3'), expect.stringContaining('mbuser4'), expect.stringContaining(USERNAME.toLowerCase())]),
      );
      await pickUser(ef, '#drpUserToReplace', 'MBUser3 (');
      await pickUser(ef, '#drpUserToReplaceWith', 'MBUser5 (');
      await ef.locator('#btReplaceUser').click({ timeout: 5000 });
      expect(await jobText()).toMatch(/Status Completed/);
      const rows = await stepsOfA();
      expect(rows.some((r) => /MBUser5/i.test(r)), 'MBUser5 now a step').toBe(true);
      expect(rows.some((r) => /MBUser3/i.test(r)), 'MBUser3 gone').toBe(false);
    });

    await test.step('Delete User: MBUser4 then MBUser5 -> only the test user is left', async () => {
      for (const user of ['MBUser4', 'MBUser5']) {
        const ef = await openEdit();
        await ef.locator('#drpActions').click();
        await page.waitForTimeout(500);
        await ef.locator('#lnkDeleteUser').click({ force: true });
        await page.waitForTimeout(1500);
        await pickUser(ef, '#drpUserToDelete', `${user} (`);
        await ef.locator('#btDeleteUser').click({ timeout: 5000 });
        expect(await jobText()).toMatch(/Status Completed/);
        const rows = await stepsOfA();
        expect(rows.some((r) => new RegExp(user, 'i').test(r)), `${user} removed`).toBe(false);
      }
      const rows = await stepsOfA();
      expect(rows.some((r) => new RegExp(USERNAME, 'i').test(r))).toBe(true);
    });

    await test.step('close both: A approved, B rejected (the test user is the only step left)', async () => {
      f = await wf.showNewestFirst(page);
      for (const key of ['A', 'B']) await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids[key] }).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      // vote page row order is not known: approve the row for A, reject the row for B
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await f.locator('#actViewAndVote').click({ force: true });
      await page.waitForTimeout(5000);
      const vf = wf.lastFrame(page, 'WFViewAndVote/JobSubmission');
      const voteRows = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
      await expect(voteRows).toHaveCount(2);
      await voteRows.filter({ hasText: ids.A }).locator('input[type=checkbox]').nth(0).check();
      await voteRows.filter({ hasText: ids.B }).locator('input[type=checkbox]').nth(1).check();
      await vf.locator('#btnUpdate').click();
      await page.waitForTimeout(2000);
      await vf.locator('#jobDescription').fill('PW edit vote');
      await vf.locator('#UserID').fill(USERNAME);
      await vf.locator('#Password').fill(PASSWORD);
      await vf.locator('#Reason').selectOption({ label: 'General' });
      await vf.locator('#Comment').fill('Voted by Playwright');
      await vf.locator('#Password').press('Tab');
      await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(5000);
      let text = '';
      for (let i = 0; i < 15; i++) {
        text = (await wf.lastFrame(page, 'WFViewAndVote/JobDetail').locator('body').innerText()).replace(/\s+/g, ' ');
        if (/Status Completed/.test(text)) break;
        await page.waitForTimeout(2000);
      }
      expect(text).toContain('Status Completed');
    });
  } finally {
    await test.step('cleanup: delete the throw-away preset', async () => {
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset);
    });
  }
});
