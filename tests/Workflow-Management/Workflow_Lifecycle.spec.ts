// Workflow Management end to end (live 2026-10-05, Claude01): two STANDALONE workflows created with Actions > Create New Workflow on
// a throw-away preset whose only step is the test user, then found, inspected and voted in ONE View And Vote job (A approved, B
// rejected). Pages: `Management` (search grid `#gridResults`), `SendToWorkflowJobSubmission` (Create New Workflow; `#txtJobDescription`,
// `#txtComment`, `#drpPreset`, `#btnFormSubmit`), `WFJobDetail` (job result with "Workflow Id: YYYYMMDD-NNNN"), `WFViewAndVote/JobSubmission`
// (vote grid; `Update` opens a signature dialog `#jobDescription #UserID #Password #Reason #Comment`), `WFViewAndVote/JobDetail`.
// Workflows cannot be deleted (two closed ones are left behind per run); the preset is deleted again. NOTE: the "Comments are
// required for rejected workflows" rule is skipped for a user holding WM_ViewAndVoteSkipComment (the admin test user does: the
// rejection below goes through with an empty comment) -- see Security_Gating for the rule itself.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test('create two workflows from a preset, find and inspect them, vote one approved and one rejected in a single job', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  let f: Frame = await wf.openWorkflowManagement(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const descA = `PW workflow A ${stamp}`;
  const descB = `PW workflow B ${stamp}`;
  const ids: Record<string, string> = {};

  /**
   * Reset (clears the persisted criteria row -- the page re-applies the last search), "Any User", optional Open/Closed filter, then
   * the grid sorted by Workflow ID descending = newest first, so brand-new workflows are on page 1. (Driving the criteria widget's
   * Column select crashed the tab repeatedly in headless runs, so the lifecycle avoids it.)
   */
  const showNewestFirst = async (status?: string) => {
    f = await wf.openWorkflowManagement(page);
    await f.click('#btCancel', { timeout: 5000 });
    await page.waitForTimeout(2500);
    f = wf.lastFrame(page, 'WorkflowManagement/Management');
    await f.locator('#drpUser').selectOption({ label: 'Any User' });
    if (status) {
      // the All / Open Only / Closed Only dropdown lives in the collapsed "Advanced Options" panel
      if (!(await f.locator('#drpApproved').isVisible())) {
        await f.locator('#btAdvanced').click({ timeout: 5000 });
        await page.waitForTimeout(1000);
      }
      await f.locator('#drpApproved').selectOption({ label: status }, { timeout: 5000 });
    }
    await f.click('#btGetWorkflows');
    await f.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    // click the Workflow ID header until the list is descending (the default order is ascending)
    for (let i = 0; i < 3; i++) {
      const col = await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
      if (col.length < 2 || col[0].trim() >= col[col.length - 1].trim()) break;
      await f.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }
  };
  const rowOf = (key: string) => f.locator('#gridResults tr.jqgrow').filter({ hasText: ids[key] });
  const gridRows = async () => (await f.locator('#gridResults tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());

  /** Actions > Create New Workflow with the preset; returns the new Workflow Id. */
  const createWorkflow = async (description: string, comment: string): Promise<string> => {
    f = wf.lastFrame(page, 'WorkflowManagement/Management');
    await f.locator('#drpMainActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actCreateWorflow').click({ force: true });
    await page.waitForTimeout(4000);
    f = wf.lastFrame(page, 'SendToWorkflowJobSubmission');
    const submit = f.locator('#btnFormSubmit');
    await expect(submit, 'nothing filled').toBeDisabled();
    await f.locator('#txtJobDescription').fill(description);
    await f.locator('#txtComment').fill(comment);
    await f.locator('#txtComment').press('Tab');
    await expect(submit, 'Job Description + Comment but no preset').toBeDisabled();
    const presets = (await f.locator('#drpPreset option').allInnerTexts()).map((t) => t.trim());
    expect(presets[0]).toBe('(Select a Preset)');
    expect(presets).toEqual(expect.arrayContaining(['ROBAR Only', preset]));
    await f.locator('#drpPreset').selectOption({ label: preset });
    await page.waitForTimeout(2500);
    await expect(f.locator('body'), 'the chosen preset\'s steps are listed').toContainText(USERNAME);
    await f.locator('#txtComment').press('Tab');
    await expect(submit).toBeEnabled({ timeout: 5000 });
    await submit.click();
    await page.waitForTimeout(4000);
    let jf = wf.lastFrame(page, 'WFJobDetail');
    let text = '';
    for (let i = 0; i < 20; i++) {
      text = (await jf.locator('body').innerText()).replace(/\s+/g, ' ');
      if (/Status Completed/.test(text) && /Workflow Id:\s*\d/.test(text)) break;
      await page.waitForTimeout(2000);
      jf = wf.lastFrame(page, 'WFJobDetail');
    }
    console.log(`job detail: ${text.slice(0, 300)}`);
    expect(text).toContain(description);
    expect(text).toMatch(/Percent Complete 100\s?%/); // the page renders "100 %" or "100%" depending on the page
    const id = (text.match(/Workflow Id:\s*(\d{8}-\d{4})/) ?? [])[1];
    expect(id, 'a Workflow Id like YYYYMMDD-NNNN').toBeTruthy();
    await jf.getByText('Workflow Management').first().click();
    await page.waitForTimeout(4000);
    return id;
  };

  try {
    await test.step('setup: a throw-away preset with one step for the test user', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
    });

    await test.step('Create New Workflow twice: required fields, the preset shows its steps, Submit Job -> Workflow Ids', async () => {
      ids.A = await createWorkflow(descA, 'Playwright workflow comment A');
      ids.B = await createWorkflow(descB, 'Playwright workflow comment B');
      expect(ids.A).not.toBe(ids.B);
      console.log(`created ${ids.A} and ${ids.B}`);
    });

    await test.step('find them (newest first), status Open, and the Detail dialog tabs', async () => {
      await showNewestFirst();
      expect((await f.locator('.ui-jqgrid-htable th').allInnerTexts()).map((t) => t.trim()).filter(Boolean)).toEqual(['Workflow ID', 'CC Number', 'Workflow Desc', 'Status', 'Last User', 'Last Status Changed', 'Detail']);
      const rows = await gridRows();
      for (const [key, d] of [['A', descA], ['B', descB]] as const) {
        const mine = rows.find((r) => r.includes(ids[key]));
        expect(mine, `workflow ${key} is on page 1 of the newest-first list`).toBeTruthy();
        expect(mine).toContain(d);
        expect(mine).toContain(' Open ');
      }
      await rowOf('A').getByText('Detail').click();
      await page.waitForTimeout(3500);
      expect((await f.locator('.ui-dialog:visible .ui-tabs-nav li').allInnerTexts()).map((t) => t.trim())).toEqual(['Workflow Image', 'Comments & History', 'Steps', 'Attachments', 'Close']);
      await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Steps' }).click();
      await page.waitForTimeout(1500);
      const steps = await wf.dialogText(f);
      console.log(`steps tab: ${steps.slice(0, 250)}`);
      expect(steps).toContain('User Group Department Action Date Voted');
      expect(steps).toContain(USERNAME);
      await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Comments & History' }).click();
      await page.waitForTimeout(1500);
      expect(await wf.dialogText(f), 'the creation comment is in the history').toContain('Playwright workflow comment A');
      await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
      await page.waitForTimeout(800);
    });

    await test.step('View And Vote: approve A and reject B in ONE job', async () => {
      await rowOf('A').locator('input[type=checkbox]').check();
      await rowOf('B').locator('input[type=checkbox]').check();
      await page.waitForTimeout(1500);
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      expect((await f.locator('ul:visible li a').allInnerTexts()).map((t) => t.trim())).toEqual(['Edit Workflows', 'View And Vote', 'Report', 'Export to Excel']);
      await f.locator('#actViewAndVote').click({ force: true });
      await page.waitForTimeout(5000);
      const vf = wf.lastFrame(page, 'WFViewAndVote/JobSubmission');
      await expect(vf.locator('body')).toContainText('Job Submission - Workflow View and Vote');
      const voteRows = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
      await expect(voteRows).toHaveCount(2);
      const rowA = voteRows.filter({ hasText: ids.A });
      const rowB = voteRows.filter({ hasText: ids.B });
      // per row: Approve, Reject, Vote For Dept, Veto -- the last two are not votable for a single-user step
      expect(await rowA.locator('input[type=checkbox]').evaluateAll((e) => e.map((x) => (x as HTMLInputElement).disabled))).toEqual([false, false, true, true]);
      await rowA.locator('input[type=checkbox]').nth(0).check(); // Approve A
      await rowB.locator('input[type=checkbox]').nth(1).check(); // Reject B
      await page.waitForTimeout(800);
      const totals = (await vf.locator('body').innerText()).match(/Totals\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)/);
      expect(totals?.slice(1, 5), 'Totals: 1 approve, 1 reject').toEqual(['1', '1', '0', '0']);
      await vf.locator('#btnUpdate').click();
      await page.waitForTimeout(2000);
      await vf.locator('#jobDescription').fill('PW vote approve A reject B');
      await vf.locator('#UserID').fill(USERNAME);
      await vf.locator('#Password').fill(PASSWORD);
      expect((await vf.locator('#Reason option').allInnerTexts()).map((t) => t.trim())).toEqual(['General', 'QA Review', 'Rework', 'Smudged']);
      await vf.locator('#Reason').selectOption({ label: 'General' });
      await vf.locator('#Comment').fill('Voted by Playwright');
      await vf.locator('#Password').press('Tab');
      await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(5000);
      let rf = wf.lastFrame(page, 'WFViewAndVote/JobDetail');
      let text = '';
      for (let i = 0; i < 15; i++) {
        text = (await rf.locator('body').innerText()).replace(/\s+/g, ' ');
        if (/Status Completed/.test(text)) break;
        await page.waitForTimeout(2000);
        rf = wf.lastFrame(page, 'WFViewAndVote/JobDetail');
      }
      console.log(`vote job detail: ${text.slice(0, 500)}`);
      expect(text).toContain('Status Completed');
      expect(text).toContain(ids.A);
      expect(text).toContain(ids.B);
    });

    await test.step('both are closed: Open Only no longer lists them, Closed Only does (A Approved, B Rejected)', async () => {
      await showNewestFirst('Closed Only');
      console.log(`status options: ${JSON.stringify(await f.locator('#drpApproved option').allInnerTexts())}`);
      const closed = await gridRows();
      console.log(`closed (newest first): ${JSON.stringify(closed.slice(0, 3))}`);
      expect(closed.find((r) => r.includes(ids.A)), 'A in Closed Only').toContain('Approved');
      expect(closed.find((r) => r.includes(ids.B)), 'B in Closed Only').toContain('Rejected');
      await showNewestFirst('Open Only');
      const open = await gridRows();
      expect(open.some((r) => r.includes(ids.A) || r.includes(ids.B)), 'closed workflows are not in Open Only').toBe(false);
    });
  } finally {
    await test.step('cleanup: delete the throw-away preset', async () => {
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset);
    });
  }
});
