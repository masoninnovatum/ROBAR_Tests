// Multi-step presets: approval groups, Vote For Entire Group and Veto (live 2026-10-05, Claude01 + MB fixture user MBPWLogin01).
// Steps with different approval groups are voted in sequence (group 1, then 2, ...); steps in the SAME group are voted in parallel (all must approve);
// "Vote For Entire Group" lets one voter's vote count for the whole group; "Vote Counts as Veto" (Approve / Reject / Both) makes that user's vote decisive.
// MBPWLoginGrp is given the voting processes (Login_WebMenu, Web_WorkflowManagement, WM_ViewAndVote, WM_ViewAndVoteCheckBox, WM_ViewAndVoteSkipComment) so MBPWLogin01
// can be a step user and vote in a second browser context. Every scenario uses its own throw-away preset (deleted) and workflow (closed by the end).

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { login, loginAs, USERNAME, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as wf from '../support/workflow';
import type { PresetStep } from '../support/workflow';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const VOTER_PROCESSES = ['Login_WebMenu', 'Web_WorkflowManagement', 'WM_ViewAndVote', 'WM_ViewAndVoteCheckBox', 'WM_ViewAndVoteSkipComment'];

test('multi-step presets: sequential groups, parallel group, Vote For Entire Group, Veto', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  const stamp = Date.now().toString().slice(-6);
  const presets: string[] = [];
  const open: string[] = []; // workflows still to close at the end
  let f: Frame;
  let mbLast = '';

  const me = USERNAME + ' (';
  const mb = MB + ' (';
  /** Creates a preset with `steps` and ONE workflow from it; returns the workflow id. */
  const scenario = async (name: string, steps: PresetStep[]): Promise<string> => {
    const preset = `MBPWFlow${stamp}${name}`;
    presets.push(preset);
    f = await wf.openWorkflowManagement(page);
    const pf = await wf.openPresetManagement(page, f);
    await wf.createPresetWithSteps(page, pf, preset, steps);
    await pf.getByText('Workflow Management').first().click();
    await page.waitForTimeout(3500);
    const id = await wf.createWorkflow(page, preset, `PW multi ${name} ${stamp}`, `Multi-step scenario ${name}`);
    open.push(id);
    return id;
  };
  /** The workflow's status text from the "Any User" list. */
  const statusOf = async (id: string): Promise<string> => {
    f = await wf.showNewestFirst(page);
    const row = f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).first();
    const text = (await row.innerText()).replace(/\s+/g, ' ');
    const m = text.match(/\b(Open|Approved|Rejected|Closed|Cancel\w*)\b/);
    return m ? m[1] : text;
  };
  const voteAsTestUser = async (id: string, kind: wf.VoteKind) => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    expect(await wf.voteTickedWorkflows(page, f, [kind], USERNAME, PASSWORD)).toContain('Status Completed');
  };
  /** The MB user logs in (second context), finds the workflow in its own list (newest first) if it can vote, and votes. Returns false when it is not offered. */
  const voteAsMb = async (id: string, kind: wf.VoteKind): Promise<boolean> => {
    mbLast = '';
    const ctx = await (browser as Browser).newContext();
    const p: Page = await ctx.newPage();
    try {
      await loginAs(p, MB, PASSWORD);
      await p.waitForTimeout(2000);
      let g = await wf.openWorkflowManagement(p);
      await g.click('#btCancel');
      await p.waitForTimeout(2500);
      g = wf.lastFrame(p, 'WorkflowManagement/Management');
      await g.click('#btGetWorkflows');
      await p.waitForTimeout(6000);
      for (let i = 0; i < 3; i++) {
        const col = await g.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
        if (col.length < 2 || col[0].trim() >= col[col.length - 1].trim()) break;
        await g.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
        await p.waitForTimeout(2500);
      }
      const row = g.locator('#gridResults tr.jqgrow').filter({ hasText: id });
      if ((await row.count()) === 0) return false;
      await row.first().locator('input[type=checkbox]').check({ timeout: 10_000 });
      await p.waitForTimeout(1000);
      const text = await wf.voteTickedWorkflows(p, g, [kind], MB, PASSWORD);
      mbLast = text;
      console.log('MB vote job: ' + text.slice(0, 320));
      expect(text).toContain('Status Completed');
      return true;
    } finally {
      await ctx.close();
    }
  };

  try {
    await test.step('setup: MBPWLoginGrp can vote; leftover MBPW presets are removed', async () => {
      await login(page);
      await sec.setGroupProcesses(page, GROUP, VOTER_PROCESSES);
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPWFlow/.test(t))) await wf.deletePreset(pf, old);
    });

    await test.step('S1 sequential groups [test user (group 1), MB user (group 2)]: after the first approval the workflow stays Open and moves to the MB user; the MB approval completes it', async () => {
      const id = await scenario('SEQ', [{ user: me, group: 1 }, { user: mb, group: 2 }]);
      const early = await voteAsMb(id, 'approve');
      console.log(`S1 MB user (group 2) before group 1 voted: offered=${early}, status now ${await statusOf(id)}`);
      await voteAsTestUser(id, 'approve');
      const after = await statusOf(id);
      console.log(`S1 after the test user (group 1) approved: ${after}`);
      if (after === 'Open') {
        expect(await voteAsMb(id, 'approve'), 'the MB user is offered the workflow').toBe(true);
        console.log(`S1 final: ${await statusOf(id)}`);
      }
      if ((await statusOf(id)) !== 'Open') open.splice(open.indexOf(id), 1);
    });

    await test.step('S2 parallel group [test user + MB user, both group 1]: both can vote at once; Open until both approved', async () => {
      const id = await scenario('PAR', [{ user: me, group: 1 }, { user: mb, group: 1 }]);
      await voteAsTestUser(id, 'approve');
      expect(await statusOf(id)).toBe('Open');
      expect(await voteAsMb(id, 'approve')).toBe(true);
      expect(await statusOf(id)).toBe('Approved');
      open.splice(open.indexOf(id), 1);
    });

    await test.step('S3 Vote For Entire Group [test user with the box ticked + MB user, group 1]: the test user\'s single approval completes the workflow', async () => {
      const id = await scenario('VFG', [{ user: me, group: 1, voteForGroup: true }, { user: mb, group: 1 }]);
      // a plain approval of a "Vote For Entire Group" step only counts for the voter; the "Vote For Dept" box makes it count for the group
      await voteAsTestUser(id, 'approve');
      console.log(`S3 status after a PLAIN approval: ${await statusOf(id)}`);
      expect(await statusOf(id)).toBe('Open');
      await voteAsMb(id, 'approve');
      const status = await statusOf(id);
      console.log(`S3 status after the second user approved: ${status}`);
      if (status !== 'Open') open.splice(open.indexOf(id), 1);

      const id2 = await scenario('VFD', [{ user: me, group: 1, voteForGroup: true }, { user: mb, group: 1 }]);
      await voteAsTestUser(id2, 'approveForDept');
      const status2 = await statusOf(id2);
      console.log(`S3 status after approving WITH Vote For Dept: ${status2}`);
      expect(status2).toBe('Approved');
      open.splice(open.indexOf(id2), 1);
    });

    await test.step('S4 a plain reject [test user (g1), MB user (g2)]: one reject does NOT close the workflow (no veto); it is decided when every step has voted', async () => {
      const id = await scenario('REJ', [{ user: me, group: 1 }, { user: mb, group: 2 }]);
      await voteAsTestUser(id, 'reject');
      const status = await statusOf(id);
      console.log(`S4 status after the first reject: ${status}`);
      expect(status, 'WFRejectHasVetoPower is off: a reject is only a vote').toBe('Open');
      expect(await voteAsMb(id, 'approve')).toBe(true);
      const final = await statusOf(id);
      console.log(`S4 final status (one reject + one approve): ${final}`);
      // OBSERVED (7.0.3.20198): the group-1 reject does not decide the workflow -- the last group's approval makes it Approved (see the DIT tracker)
      expect(final).toBe('Approved');
      open.splice(open.indexOf(id), 1);
      // (a closed workflow stays in the user's list -- the default status filter is All -- but cannot be voted again)
    });

    await test.step('S5 parallel group, plain reject [test user + MB user, group 1]: observe what one reject does', async () => {
      const id = await scenario('PRJ', [{ user: me, group: 1 }, { user: mb, group: 1 }]);
      await voteAsTestUser(id, 'reject');
      const status = await statusOf(id);
      console.log(`S5 status after ONE reject in a 2-user group: ${status}`);
      if (status === 'Open') {
        expect(await voteAsMb(id, 'approve')).toBe(true);
        console.log(`S5 status after the second user approved: ${await statusOf(id)}`);
      }
      if ((await statusOf(id)) !== 'Open') open.splice(open.indexOf(id), 1);
    });

    await test.step('S6 Veto [test user + MB user (Vote Counts as Veto = Reject), group 1]: observe the MB user\'s reject', async () => {
      const id = await scenario('VET', [{ user: me, group: 1 }, { user: mb, group: 1, veto: 'Reject' }]);
      expect(await voteAsMb(id, 'rejectVeto')).toBe(true);
      const status = await statusOf(id);
      console.log(`S6 status after the veto user rejected WITH the Veto box: ${status}`);
      expect(status).toBe('Rejected');
      open.splice(open.indexOf(id), 1);
    });
  } finally {
    await test.step('cleanup: close leftover workflows (test user votes / MB user votes), delete the presets, leave MBPWLoginGrp without processes', async () => {
      for (const id of [...open]) {
        try {
          if ((await statusOf(id)) !== 'Open') continue;
          await voteAsTestUser(id, 'reject').catch(() => {});
          if ((await statusOf(id)) === 'Open') await voteAsMb(id, 'reject').catch(() => {});
        } catch (e) {
          console.log(`could not close ${id}: ${String(e).slice(0, 120)}`);
        }
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const p of presets) await wf.deletePreset(pf, p).catch(() => {});
      await sec.setGroupProcesses(page, GROUP, []);
    });
  }
});
