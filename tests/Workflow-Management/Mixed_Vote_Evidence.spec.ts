// Evidence run for Training Issues Report row 6 (Workflow Management / View And Vote, outcome rule), TST703, WFRejectHasVetoPower = N.
// HEADED, two browser windows (test user Claude01 + MB fixture user MBPWLogin01) placed at fixed screen positions; every evidence shot is an
// OS-level desktop capture cropped to ONE browser window so the address bar (environment) is visible. Output: runs/WF_MixedVote_<date>/*.png + evidence.json.
//   S1  two approval groups [Claude01 g1, MB g2]: g1 REJECTS (workflow stays Open), g2 APPROVES            -> Approved
//   S2  ONE parallel group  [Claude01 g1, MB g1]: one REJECT, one APPROVE                                  -> Approved
//   S3  two approval groups [Claude01 g1, MB g2]: g2 votes FIRST (approve, while g1 is still pending), then g1 REJECTS -> Rejected
// (S1 vs S3: the same two votes give opposite results depending only on the order they are cast; S3 also shows a later group voting before an earlier one.)
import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { loginAs, USERNAME, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as wf from '../support/workflow';
import type { PresetStep } from '../support/workflow';

test.use({ headless: false, actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const VOTER_PROCESSES = ['Login_WebMenu', 'Web_WorkflowManagement', 'WM_ViewAndVote', 'WM_ViewAndVoteCheckBox', 'WM_ViewAndVoteSkipComment'];
// window placement on DISPLAY2 (virtual desktop X from -1920): outer window bounds, also the crop rectangle
const WIN = { x: -1910, y: 5, w: 1400, h: 1000 };
const OUT = path.resolve('runs', `WF_MixedVote_${new Date().toISOString().slice(0, 10)}`);

test('mixed votes: reject then approve, one parallel group, approve-before-reject (WFRejectHasVetoPower = N)', async ({ browser }) => {
  test.setTimeout(1_800_000);
  sec.assertMb(GROUP);
  fs.mkdirSync(OUT, { recursive: true });
  const stamp = Date.now().toString().slice(-6);
  const presets: string[] = [];
  const open: string[] = [];
  const evidence: { file: string; scenario: string; caption: string }[] = [];
  const results: Record<string, unknown> = { stamp };
  let f: Frame;

  const newWindow = async (): Promise<Page> => {
    const ctx = await (browser as Browser).newContext({ viewport: null });
    const p = await ctx.newPage();
    const cdp = await ctx.newCDPSession(p);
    const { windowId } = await cdp.send('Browser.getWindowForTarget');
    await cdp.send('Browser.setWindowBounds', { windowId, bounds: { left: WIN.x, top: WIN.y, width: WIN.w, height: WIN.h, windowState: 'normal' } });
    return p;
  };
  const shot = async (p: Page, file: string, scenario: string, caption: string) => {
    await p.bringToFront();
    await p.waitForTimeout(900);
    const out = path.join(OUT, `${file}.png`);
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/screenshot-desktop.ps1'), '-Path', out]);
    execFileSync('powershell', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', path.resolve('scripts/crop-image.ps1'), '-Path', out, '-X', String(WIN.x), '-Y', String(WIN.y), '-W', String(WIN.w), '-H', String(WIN.h)]);
    evidence.push({ file: `${file}.png`, scenario, caption });
    fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify({ results, evidence }, null, 2));
  };

  const pA = await newWindow(); // test user
  const pB = await newWindow(); // MB user
  const me = USERNAME + ' (';
  const mb = MB + ' (';

  /** Creates a preset with `steps` and ONE workflow (shot of the Create New Workflow form that lists the preset's steps). */
  const scenario = async (tag: string, label: string, steps: PresetStep[], shotFile: string, caption: string): Promise<string> => {
    const preset = `CLPWFlow${stamp}${tag}`;
    presets.push(preset);
    f = await wf.openWorkflowManagement(pA);
    const pf = await wf.openPresetManagement(pA, f);
    await wf.createPresetWithSteps(pA, pf, preset, steps);
    await pf.getByText('Workflow Management').first().click();
    await pA.waitForTimeout(3500);
    const id = await wf.createWorkflow(pA, preset, `Mixed vote ${label} ${stamp}`, `Mixed vote evidence ${label}`, async () => { await shot(pA, shotFile, label, caption); });
    open.push(id);
    return id;
  };

  /** Lists the workflow for the given window's user, ticks it, optionally returns the grid row text. */
  const listFor = async (p: Page, anyUser: boolean): Promise<Frame> => {
    if (anyUser) return wf.showNewestFirst(p);
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
    return g;
  };

  const vote = async (p: Page, who: string, id: string, kind: wf.VoteKind, anyUser: boolean, sc: string, voteShot: string, voteCaption: string, jobShot: string, jobCaption: string) => {
    const g = await listFor(p, anyUser);
    const row = g.locator('#gridResults tr.jqgrow').filter({ hasText: id });
    expect(await row.count(), `${who} sees ${id} in the list`).toBeGreaterThan(0);
    await row.first().locator('input[type=checkbox]').check({ timeout: 10_000 });
    await p.waitForTimeout(800);
    const text = await wf.voteTickedWorkflows(p, g, [kind], who, PASSWORD, `${who} ${kind} - evidence run`, {
      beforeUpdate: async () => { await shot(p, voteShot, sc, voteCaption); },
      afterJob: async () => { await shot(p, jobShot, sc, jobCaption); },
    });
    expect(text).toContain('Status Completed');
  };

  /** Management list (newest first) status of the workflow + Detail > Steps tab; returns the header status. */
  const inspect = async (id: string, sc: string, listShot: string, listCaption: string, stepsShot: string, stepsCaption: string): Promise<string> => {
    const g = await wf.showNewestFirst(pA);
    const row = g.locator('#gridResults tr.jqgrow').filter({ hasText: id }).first();
    const text = (await row.innerText()).replace(/\s+/g, ' ');
    const status = (text.match(/\b(Open|Approved|Rejected)\b/) ?? [])[1] ?? text;
    await shot(pA, listShot, sc, listCaption.replace('{status}', status));
    await row.getByText('Detail').click();
    await pA.waitForTimeout(3500);
    await g.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Steps' }).click();
    await pA.waitForTimeout(1500);
    const steps = await wf.dialogText(g);
    results[`${id}_steps`] = steps.replace(/\s+/g, ' ').slice(0, 400);
    await shot(pA, stepsShot, sc, stepsCaption);
    await g.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
    await pA.waitForTimeout(800);
    return status;
  };

  try {
    await test.step('setup: log in both users, MBPWLoginGrp may vote, old CLPW presets removed', async () => {
      await loginAs(pA, USERNAME, PASSWORD);
      await sec.setGroupProcesses(pA, GROUP, VOTER_PROCESSES); // the MB user cannot log in / open Workflow Management before the group has its processes
      await loginAs(pB, MB, PASSWORD);
      f = await wf.openWorkflowManagement(pA);
      const pf = await wf.openPresetManagement(pA, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^(MB|CL)PWFlow/.test(t))) await wf.deletePreset(pf, old);
    });

    // ------------------------------------------------------------------ S1
    await test.step('S1 two groups: group 1 rejects, group 2 approves', async () => {
      const sc = 'Scenario 1 - two approval groups, reject first then approve';
      const id = await scenario('S1', 'S1', [{ user: me, group: 1 }, { user: mb, group: 2 }], '1.1', 'Create New Workflow with preset: step 1 = Claude01 (approval group 1), step 2 = MBPWLogin01 (approval group 2).');
      results.S1 = { id };
      await vote(pA, USERNAME, id, 'reject', true, sc, '1.2', `Claude01 (group 1) ticks REJECT on workflow ${id} in View And Vote.`, '1.3', 'Vote job completed for the reject.');
      const s1 = await inspect(id, sc, '1.4', `Workflow Management after the group 1 reject: the workflow ${id} is still {status}.`, '1.5', 'Detail > Steps tab: the group 1 step is Rejected, the group 2 step is still Open.');
      expect(s1, 'one reject (veto off) does not close the workflow').toBe('Open');
      await vote(pB, MB, id, 'approve', false, sc, '1.6', `MBPWLogin01 (group 2) ticks APPROVE on workflow ${id}.`, '1.7', 'Vote job completed for the approve.');
      const s2 = await inspect(id, sc, '1.8', `Workflow Management after the group 2 approve: the workflow ${id} is {status}, although one voter rejected.`, '1.9', 'Detail > Steps tab: group 1 Rejected, group 2 Approved - and the workflow header is Approved.');
      (results.S1 as Record<string, unknown>).final = s2;
      expect(s2).toBe('Approved');
      open.splice(open.indexOf(id), 1);
    });

    // ------------------------------------------------------------------ S2
    await test.step('S2 one parallel group: one reject, one approve', async () => {
      const sc = 'Scenario 2 - one parallel approval group, one reject and one approve';
      const id = await scenario('S2', 'S2', [{ user: me, group: 1 }, { user: mb, group: 1 }], '2.1', 'Create New Workflow with preset: Claude01 and MBPWLogin01 are BOTH in approval group 1.');
      results.S2 = { id };
      await vote(pA, USERNAME, id, 'reject', true, sc, '2.2', `Claude01 ticks REJECT on workflow ${id}.`, '2.3', 'Vote job completed for the reject.');
      const s1 = await inspect(id, sc, '2.4', `Workflow Management after Claude01's reject: ${id} is still {status}.`, '2.5', 'Detail > Steps tab: Claude01 Rejected, MBPWLogin01 still Open.');
      expect(s1).toBe('Open');
      await vote(pB, MB, id, 'approve', false, sc, '2.6', `MBPWLogin01 (same group) ticks APPROVE on workflow ${id}.`, '2.7', 'Vote job completed for the approve.');
      const s2 = await inspect(id, sc, '2.8', `Workflow Management after the second vote: ${id} is {status}, although one voter rejected.`, '2.9', 'Detail > Steps tab: one step Rejected, one Approved - header Approved.');
      (results.S2 as Record<string, unknown>).final = s2;
      expect(s2).toBe('Approved');
      open.splice(open.indexOf(id), 1);
    });

    // ------------------------------------------------------------------ S3
    await test.step('S3 group 2 votes before group 1, then group 1 rejects', async () => {
      const sc = 'Scenario 3 - the later approval group votes first, then the earlier group rejects';
      const id = await scenario('S3', 'S3', [{ user: me, group: 1 }, { user: mb, group: 2 }], '3.1', 'Create New Workflow with preset: step 1 = Claude01 (approval group 1), step 2 = MBPWLogin01 (approval group 2).');
      results.S3 = { id };
      await vote(pB, MB, id, 'approve', false, sc, '3.2', `MBPWLogin01 (group 2) is offered workflow ${id} and ticks APPROVE although group 1 has not voted yet.`, '3.3', 'Vote job completed: the group 2 vote was accepted.');
      const s1 = await inspect(id, sc, '3.4', `Workflow Management: ${id} is still {status} (group 1 has not voted).`, '3.5', 'Detail > Steps tab: group 2 is already Approved, group 1 still Open.');
      expect(s1).toBe('Open');
      await vote(pA, USERNAME, id, 'reject', true, sc, '3.6', `Claude01 (group 1) now ticks REJECT on workflow ${id}.`, '3.7', 'Vote job completed for the reject.');
      const s2 = await inspect(id, sc, '3.8', `Workflow Management: ${id} is {status}. The same two votes as scenario 1, cast in the other order, give the opposite result.`, '3.9', 'Detail > Steps tab: group 1 Rejected, group 2 Approved - header Rejected.');
      (results.S3 as Record<string, unknown>).final = s2;
      expect(s2).toBe('Rejected');
      open.splice(open.indexOf(id), 1);
    });
  } finally {
    await test.step('cleanup: close leftovers, delete presets, MBPWLoginGrp back to no processes', async () => {
      for (const id of [...open]) {
        try {
          await wf.closeWorkflow(pA, id, USERNAME, PASSWORD);
        } catch (e) {
          console.log(`could not close ${id}: ${String(e).slice(0, 120)}`);
        }
      }
      f = await wf.openWorkflowManagement(pA);
      const pf = await wf.openPresetManagement(pA, f);
      for (const p of presets) await wf.deletePreset(pf, p).catch(() => {});
      await sec.setGroupProcesses(pA, GROUP, []);
      fs.writeFileSync(path.join(OUT, 'evidence.json'), JSON.stringify({ results, evidence }, null, 2));
    });
  }
});
