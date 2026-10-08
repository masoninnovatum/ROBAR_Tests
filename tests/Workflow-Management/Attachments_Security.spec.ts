// Workflow attachment security (headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only). Rules, from the page/service source:
//   * Detail dialog > Attachments > "Add Attachments" (`#btnUpload`) is enabled only with WM_AddAttachment_Open (workflow Open) or WM_AddAttachment_Closed (workflow not Open)
//   * a file can be deleted (Delete button `deleteFileBtn<n>` enabled) only while the workflow is OPEN, only if it was added more than 10 s after the workflow was
//     created, and only for users with WM_DeleteWFAttachments -- and only their OWN files unless they also hold WM_DeleteWFAttachments_Anyuser
// Setup (test user Claude01): preset [test user, MB user] in one approval group; workflow A stays open, workflow B is closed (both vote), Claude01 attaches a file to
// A and to B. Then the group's processes are changed step by step and MBPWLogin01 looks at A and B in a second browser context.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import * as path from 'path';
import { login, loginAs, USERNAME, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const FILE1 = path.resolve('test-data/wm-attachments/pw_attach_1.txt');
const FILE2 = path.resolve('test-data/wm-attachments/pw_attach_2.txt');
const BASE = ['Login_WebMenu', 'Web_WorkflowManagement', 'WM_ViewAndVote'];
const VOTER = [...BASE, 'WM_ViewAndVoteCheckBox', 'WM_ViewAndVoteSkipComment'];

test('workflow attachments security: add on open / closed, delete own / any user / closed', async ({ page, browser }) => {
  test.setTimeout(1_500_000);
  sec.assertMb(GROUP);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: Record<string, string> = {};
  let f: Frame;

  /** Test user: Detail of `id` > Attachments tab > Add Attachments > file(s) > Submit (confirming the closed-workflow warning). */
  const adminUpload = async (id: string, file: string, closed = false) => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).getByText('Detail').click({ timeout: 10_000 });
    await page.waitForTimeout(3500);
    await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Attachments' }).click();
    await page.waitForTimeout(1000);
    await f.locator('#btnUpload').click();
    await page.waitForTimeout(4000);
    const u = wf.lastFrame(page, 'GetUploadWorkflowAttachmentsData');
    await u.locator('#lnkAddAttachments').click();
    await u.locator('input[type=file]').first().setInputFiles(file);
    await u.locator('#btnSubmit').click();
    await page.waitForTimeout(2000);
    if (closed) await u.locator('.ui-dialog:visible button').filter({ hasText: 'Continue' }).click();
    await page.waitForTimeout(7000);
  };
  const voteAsMb = async (id: string, kind: wf.VoteKind) => {
    const u = await asMb();
    const h = await u.list();
    await h.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await u.p.waitForTimeout(1000);
    expect(await wf.voteTickedWorkflows(u.p, h, [kind], MB, PASSWORD)).toContain('Status Completed');
    await u.close();
  };
  const voteAsTestUser = async (id: string, kind: wf.VoteKind) => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    expect(await wf.voteTickedWorkflows(page, f, [kind], USERNAME, PASSWORD)).toContain('Status Completed');
  };

  /** A second browser context logged in as the MB user. */
  const asMb = async () => {
    const ctx = await (browser as Browser).newContext();
    const p: Page = await ctx.newPage();
    await loginAs(p, MB, PASSWORD);
    await p.waitForTimeout(2000);
    let g = await wf.openWorkflowManagement(p);
    const list = async (): Promise<Frame> => {
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
    return { p, list, close: () => ctx.close() };
  };
  /** The MB user's view of workflow `id`'s Attachments tab: is Add enabled, and per file name whether Delete is enabled. */
  const mbView = async (id: string): Promise<{ add: boolean; del: Record<string, boolean> }> => {
    const u = await asMb();
    try {
      const h = await u.list();
      await h.locator('#gridResults tr.jqgrow').filter({ hasText: id }).getByText('Detail').click({ timeout: 10_000 });
      await u.p.waitForTimeout(3500);
      await h.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Attachments' }).click();
      await u.p.waitForTimeout(1500);
      const add = await h.locator('#btnUpload').isEnabled();
      const del: Record<string, boolean> = {};
      for (const row of await h.locator('.ui-dialog:visible #attachmentsList tbody tr').all()) {
        const name = await row.locator('input.buttonAsLink').first().inputValue().catch(() => '');
        if (name) del[name] = await row.locator('input[id^="deleteFileBtn"]').isEnabled();
      }
      return { add, del };
    } finally {
      await u.close();
    }
  };
  /** The MB user uploads FILE2 to workflow `id` (own file). */
  const mbUpload = async (id: string, file: string) => {
    const u = await asMb();
    try {
      const h = await u.list();
      await h.locator('#gridResults tr.jqgrow').filter({ hasText: id }).getByText('Detail').click({ timeout: 10_000 });
      await u.p.waitForTimeout(3500);
      await h.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Attachments' }).click();
      await u.p.waitForTimeout(1000);
      await h.locator('#btnUpload').click();
      await u.p.waitForTimeout(4000);
      const up = wf.lastFrame(u.p, 'GetUploadWorkflowAttachmentsData');
      await up.locator('#lnkAddAttachments').click();
      await up.locator('input[type=file]').first().setInputFiles(file);
      await up.locator('#btnSubmit').click();
      await u.p.waitForTimeout(8000);
    } finally {
      await u.close();
    }
  };

  try {
    await test.step('setup: group can vote; preset [test user, MB user] group 1; A stays open, B is closed by both votes; the test user attaches a file to each', async () => {
      await login(page);
      await sec.setGroupProcesses(page, GROUP, VOTER);
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPWFlow/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPresetWithSteps(page, pf, preset, [{ user: `${USERNAME} (`, group: 1 }, { user: `${MB} (`, group: 1 }]);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
      ids.A = await wf.createWorkflow(page, preset, `PW attsec A ${stamp}`, 'Attachment security A');
      ids.B = await wf.createWorkflow(page, preset, `PW attsec B ${stamp}`, 'Attachment security B');
      console.log(`created ${ids.A} ${ids.B}`);
      await adminUpload(ids.A, FILE1); // added > 10 s after the workflow was created
      await voteAsTestUser(ids.B, 'approve');
      await voteAsMb(ids.B, 'approve');
      f = await wf.showNewestFirst(page);
      expect((await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids.B }).innerText()).replace(/\s+/g, ' ')).toContain('Approved');
      await adminUpload(ids.B, FILE1, true);
    });

    await test.step('no attachment process: Add Attachments is disabled on open AND closed workflows; no Delete is enabled', async () => {
      await sec.setGroupProcesses(page, GROUP, BASE);
      const a = await mbView(ids.A);
      const b = await mbView(ids.B);
      console.log(`S0 A: ${JSON.stringify(a)} B: ${JSON.stringify(b)}`);
      expect(a.add).toBe(false);
      expect(b.add).toBe(false);
      expect(Object.values(a.del).some(Boolean)).toBe(false);
      expect(Object.values(b.del).some(Boolean)).toBe(false);
    });

    await test.step('WM_AddAttachment_Open: Add enabled on the OPEN workflow only', async () => {
      await sec.setGroupProcesses(page, GROUP, [...BASE, 'WM_AddAttachment_Open']);
      const a = await mbView(ids.A);
      const b = await mbView(ids.B);
      console.log(`S1 A: ${JSON.stringify(a)} B: ${JSON.stringify(b)}`);
      expect(a.add).toBe(true);
      expect(b.add).toBe(false);
    });

    await test.step('WM_AddAttachment_Closed (without Open): Add enabled on the CLOSED workflow only', async () => {
      await sec.setGroupProcesses(page, GROUP, [...BASE, 'WM_AddAttachment_Closed']);
      const a = await mbView(ids.A);
      const b = await mbView(ids.B);
      console.log(`S2 A: ${JSON.stringify(a)} B: ${JSON.stringify(b)}`);
      expect(a.add).toBe(false);
      expect(b.add).toBe(true);
    });

    await test.step('WM_DeleteWFAttachments: the MB user can delete only HIS OWN file (the test user\'s file stays locked)', async () => {
      await sec.setGroupProcesses(page, GROUP, [...BASE, 'WM_AddAttachment_Open', 'WM_DeleteWFAttachments']);
      await mbUpload(ids.A, FILE2);
      const a = await mbView(ids.A);
      console.log(`S3 A: ${JSON.stringify(a)}`);
      expect(a.del['pw_attach_2.txt'], 'own file deletable').toBe(true);
      expect(a.del['pw_attach_1.txt'], "someone else's file is not").toBe(false);
    });

    await test.step('+ WM_DeleteWFAttachments_Anyuser: the other user\'s file is deletable too', async () => {
      await sec.setGroupProcesses(page, GROUP, [...BASE, 'WM_AddAttachment_Open', 'WM_DeleteWFAttachments', 'WM_DeleteWFAttachments_Anyuser']);
      const a = await mbView(ids.A);
      console.log(`S4 A: ${JSON.stringify(a)}`);
      expect(a.del['pw_attach_1.txt']).toBe(true);
      expect(a.del['pw_attach_2.txt']).toBe(true);
    });

    await test.step('a CLOSED workflow\'s attachments can never be deleted, even with both delete processes', async () => {
      const b = await mbView(ids.B);
      console.log(`S5 B: ${JSON.stringify(b)}`);
      expect(Object.keys(b.del).length).toBeGreaterThan(0);
      expect(Object.values(b.del).some(Boolean)).toBe(false);
    });
  } finally {
    await test.step('cleanup: close A (both reject), delete the preset, leave the group without processes', async () => {
      try {
        await sec.setGroupProcesses(page, GROUP, VOTER);
        await voteAsTestUser(ids.A, 'reject');
        await voteAsMb(ids.A, 'reject');
      } catch (e) {
        console.log(`could not close A: ${String(e).slice(0, 140)}`);
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset).catch(() => {});
      await sec.setGroupProcesses(page, GROUP, []);
    });
  }
});
