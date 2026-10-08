// Workflow Management search filters (live 2026-10-05, Claude01). Page `Management`: Find Workflows for User `#drpUser`, "Show item open for voting"
// `#chkOpenForVotingOnly`, Advanced Options (`#btAdvanced`): radios `#rdIncluded` / `#rdCanVote` (default Can Vote), `#drpApproved` (All / Open Only / Closed Only),
// `#chkLatest`, `#chkEffective`, `#txtLimit` (Limit Results, 500), `#drpFieldDefs` (Field Definitions: label type), the criteria widget, `#drpCCIds` (change control)
// + Select All / Select Page links and the "Checked Rows: N" counter.
// Data: a two-step preset (Claude01 then MBUser3) and two workflows: W1 gets Claude01's vote (so it now waits for MBUser3 -- Claude01 is still INCLUDED but cannot
// vote), W2 is untouched (Claude01 can vote). Everything is closed again at the end (MBUser3's step is removed with Edit Workflows) and the preset is deleted.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

test('Workflow Management filters: Included vs Can Vote, open-for-voting, status, limit, select all / page', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: Record<string, string> = {};
  let f: Frame = await wf.openWorkflowManagement(page);

  interface Search { user?: string; radio?: 'included' | 'canVote'; openForVoting?: boolean; status?: 'Open Only' | 'Closed Only' | 'Open and Closed'; limit?: string }
  /** Reset, set the filters explicitly (persisted state!), Retrieve and return the newest-first Workflow Ids on page 1 + the "View a - b of c" text. */
  const search = async (s: Search): Promise<{ ids: string[]; summary: string }> => {
    f = await wf.openWorkflowManagement(page);
    await f.click('#btCancel');
    await page.waitForTimeout(2500);
    f = wf.lastFrame(page, 'WorkflowManagement/Management');
    await f.locator('#drpUser').selectOption({ label: s.user ?? USERNAME });
    if (!(await f.locator('#drpApproved').isVisible())) {
      await f.locator('#btAdvanced').click();
      await page.waitForTimeout(800);
    }
    await f.locator(s.radio === 'included' ? '#rdIncluded' : '#rdCanVote').check();
    await f.locator('#chkOpenForVotingOnly').setChecked(!!s.openForVoting);
    await f.locator('#drpApproved').selectOption({ label: s.status === 'Open Only' ? 'Open Only' : s.status === 'Closed Only' ? 'Closed Only' : (await f.locator('#drpApproved option').first().innerText()).trim() });
    await f.locator('#txtLimit').fill(s.limit ?? '500');
    await f.click('#btGetWorkflows');
    await page.waitForTimeout(7000);
    for (let i = 0; i < 3; i++) {
      const col = await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
      if (col.length < 2 || col[0].trim() >= col[col.length - 1].trim()) break;
      await f.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }
    const idsOnPage = (await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts()).map((t) => t.trim());
    const summary = (await f.locator('.ui-paging-info').first().innerText().catch(() => '')).trim();
    return { ids: idsOnPage, summary };
  };

  try {
    await test.step('setup: two-step preset (test user, MBUser3), workflows W1 and W2; the test user votes W1 (approve) so it waits for MBUser3', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`, 'MBUser3 (']);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
      ids.W1 = await wf.createWorkflow(page, preset, `PW filter W1 ${stamp}`, 'Filter test W1');
      ids.W2 = await wf.createWorkflow(page, preset, `PW filter W2 ${stamp}`, 'Filter test W2');
      console.log(`created ${ids.W1} ${ids.W2}`);
      f = await wf.showNewestFirst(page);
      await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids.W1 }).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await page.waitForTimeout(1000);
      expect(await wf.voteTickedWorkflows(page, f, ['approve'], USERNAME, PASSWORD)).toContain('Status Completed');
    });

    const total = (summary: string) => Number((summary.match(/of (\d+)/) ?? [])[1]);

    await test.step('"Can Vote" (default) lists only workflows waiting for the user: W2 yes, W1 (already voted, now waits for MBUser3) no', async () => {
      const r = await search({ radio: 'canVote' });
      console.log(`Can Vote: ${r.summary} first: ${r.ids.slice(0, 3).join(', ')}`);
      expect(r.ids, 'W2 waits for the test user').toContain(ids.W2);
      expect(r.ids, 'W1 does not').not.toContain(ids.W1);
    });

    await test.step('"Included" lists every workflow the user is part of: W1 and W2, many more than Can Vote', async () => {
      const canVote = total((await search({ radio: 'canVote' })).summary);
      const r = await search({ radio: 'included' });
      console.log(`Included: ${r.summary}`);
      expect(r.ids).toEqual(expect.arrayContaining([ids.W1, ids.W2]));
      expect(total(r.summary)).toBeGreaterThan(canVote);
    });

    await test.step('"Show item open for voting" narrows Included down to the workflows the user can vote on now', async () => {
      const canVote = await search({ radio: 'canVote' });
      const r = await search({ radio: 'included', openForVoting: true });
      console.log(`Included + open for voting: ${r.summary}`);
      expect(r.ids).toContain(ids.W2);
      expect(r.ids).not.toContain(ids.W1);
      expect(total(r.summary)).toBe(total(canVote.summary));
    });

    await test.step('status filter on Included: Open Only keeps W1 and W2 and drops closed ones; Closed Only has neither', async () => {
      const all = total((await search({ radio: 'included' })).summary);
      const open = await search({ radio: 'included', status: 'Open Only' });
      const closed = await search({ radio: 'included', status: 'Closed Only' });
      console.log(`Included: all ${all}, open ${open.summary}, closed ${closed.summary}`);
      expect(open.ids).toEqual(expect.arrayContaining([ids.W1, ids.W2]));
      expect(closed.ids).not.toContain(ids.W1);
      expect(closed.ids).not.toContain(ids.W2);
      expect(total(open.summary) + total(closed.summary)).toBe(all);
    });

    await test.step('Limit Results caps the number of rows retrieved', async () => {
      const r = await search({ radio: 'included', limit: '3' });
      console.log(`Limit 3: ${r.summary} rows=${r.ids.length}`);
      expect(r.ids.length).toBe(3);
      expect(total(r.summary)).toBe(3);
    });

    await test.step('Select Page ticks the 10 rows of the page; Select All ticks every retrieved row ("Checked Rows: N")', async () => {
      const r = await search({ radio: 'included' });
      const all = total(r.summary);
      const checked = async () => Number(((await f.locator('text=/Checked Rows:\\s*\\d+/').first().innerText()).match(/(\d+)/) ?? [])[1]);
      expect(await checked()).toBe(0);
      await f.getByText('Select Page', { exact: true }).click();
      await page.waitForTimeout(1500);
      expect(await checked(), 'Select Page = the 10 rows of this page').toBe(10);
      await f.getByText('Select All', { exact: true }).click();
      await page.waitForTimeout(2500);
      console.log(`Select All -> Checked Rows: ${await checked()} of ${all}`);
      expect(await checked(), 'Select All = every retrieved row').toBe(all);
      // the bulk menu is available with a selection
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      expect(await f.locator('#actViewAndVote').isVisible()).toBe(true);
      await f.locator('#drpActions').click().catch(() => {});
    });

    await test.step('Field Definitions dropdown and the change-control selector are present (observed)', async () => {
      f = wf.lastFrame(page, 'WorkflowManagement/Management');
      console.log(`Field definitions options: ${JSON.stringify((await f.locator('#drpFieldDefs option').allInnerTexts()).map((t) => t.trim()))}`);
      console.log(`CC dropdown classes: ${await f.locator('#drpCCIds').getAttribute('class')} options: ${JSON.stringify((await f.locator('#drpCCIds option').allInnerTexts()).map((t) => t.trim()).slice(0, 5))}`);
      const statusOptions = (await f.locator('#drpApproved option').allInnerTexts()).map((t) => t.trim());
      console.log(`status options: ${JSON.stringify(statusOptions)}`);
      expect(statusOptions).toHaveLength(3);
      expect(statusOptions.slice(1)).toEqual(['Open Only', 'Closed Only']);
      // the Field Definitions dropdown starts with the "Default" definitions and lists every label type; the change-control selector is hidden
      // until workflows with a change control number are retrieved (none on TST703 for these workflows)
      expect(await f.locator('#drpCCIds').getAttribute('class')).toContain('hide');
    });
  } finally {
    await test.step('cleanup: remove MBUser3 from both workflows (Edit Workflows), close them, delete the preset', async () => {
      try {
        f = await wf.showNewestFirst(page);
        for (const id of [ids.W1, ids.W2]) await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        await f.locator('#drpActions').click();
        await page.waitForTimeout(500);
        await f.locator('#actWfEdit').click({ force: true });
        await page.waitForTimeout(5000);
        const ef = wf.lastFrame(page, 'WorkflowManagement/Edit');
        await ef.locator('#drpActions').click();
        await page.waitForTimeout(500);
        await ef.locator('#lnkDeleteUser').click({ force: true });
        await page.waitForTimeout(1500);
        const opt = (await ef.locator('#drpUserToDelete option').allInnerTexts()).map((t) => t.trim()).find((t) => /^MBUser3 \(/i.test(t));
        await ef.locator('#drpUserToDelete').selectOption({ label: opt! });
        await ef.locator('#btDeleteUser').click();
        await page.waitForTimeout(8000);
        // W1 is now fully voted but STILL OPEN (deleting the last open step does not close it): closeWorkflow adds a step for the test user first; W2 still needs the test user's vote
        for (const id of [ids.W1, ids.W2]) await wf.closeWorkflow(page, id, USERNAME, PASSWORD);
      } catch (e) {
        console.log(`cleanup of the workflows skipped: ${String(e).slice(0, 160)}`);
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset).catch(() => {});
    });
  }
});
