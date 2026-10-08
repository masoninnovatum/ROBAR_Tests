// Workflow attachments (live 2026-10-05, Claude01): Workflow Management > row Detail > "Attachments" tab lists the files (User, Date, file name link,
// Download, Delete); its "Add Attachments" button (`#btnUpload`, enabled by WM_AddAttachment_Open for an open workflow / WM_AddAttachment_Closed for a
// closed one) opens `GetUploadWorkflowAttachmentsData?workflowId=<id>` (Workflow Id + Description read-only, "+ Add Attachments" adds a file input,
// Submit stays disabled until a file is chosen). Submit -> `SubmitWorkflowAttachments` ("success"). Checks: a file name that is already attached
// (or twice in one submit) is refused with a duplicate error; a CLOSED workflow asks for confirmation first ("Adding an attachment to a completed
// workflow can replace production files. Would you like to proceed?" Continue/Cancel); Download returns the same bytes; Delete asks to confirm.
// Throw-away workflows A (stays open until the end) and B (closed first) + a throw-away preset (deleted). Workflows cannot be deleted.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

const FILE1 = path.resolve('test-data/wm-attachments/pw_attach_1.txt');
const FILE2 = path.resolve('test-data/wm-attachments/pw_attach_2.txt');

test('workflow attachments: add, duplicate refused, closed-workflow warning, download, delete', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: Record<string, string> = {};
  let f: Frame = await wf.openWorkflowManagement(page);

  /** Opens the Detail dialog's Attachments tab of the workflow and returns its text rows ("<user> <date> <name>"). */
  const openAttachmentsTab = async (id: string): Promise<string[]> => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).getByText('Detail').click({ timeout: 10_000 });
    await page.waitForTimeout(3500);
    await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Attachments' }).click();
    await page.waitForTimeout(1500);
    // the file name, Download and Delete are <input type=button value=...>, so read the input values too
    const rows = await f.locator('.ui-dialog:visible #attachmentsList tbody tr').evaluateAll((trs) =>
      trs.map((tr) => `${(tr.textContent || '').replace(/\s+/g, ' ').trim()} ${Array.from(tr.querySelectorAll('input')).map((i) => (i as HTMLInputElement).value).join(' ')}`.trim()),
    );
    return rows.filter((t) => t && !/^User Attach/.test(t));
  };
  const closeDetail = async () => {
    await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
    await page.waitForTimeout(800);
  };
  /** From the open Detail dialog: Add Attachments -> choose `files` -> Submit; returns the page text after Submit (or the visible dialog if refused). */
  const upload = async (files: string[], { confirm }: { confirm?: 'Continue' | 'Cancel' } = {}): Promise<string> => {
    await f.locator('#btnUpload').click({ timeout: 10_000 });
    await page.waitForTimeout(4000);
    const u = wf.lastFrame(page, 'GetUploadWorkflowAttachmentsData');
    await u.locator('#lnkAddAttachments').click();
    await page.waitForTimeout(500);
    await u.locator('input[type=file]').first().setInputFiles(files);
    await page.waitForTimeout(800);
    await u.locator('#btnSubmit').click();
    await page.waitForTimeout(2000);
    if (confirm) {
      expect((await u.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ')).toContain('Adding an attachment to a completed workflow can replace production files. Would you like to proceed?');
      await u.locator('.ui-dialog:visible button').filter({ hasText: confirm }).click();
      await page.waitForTimeout(2000);
    }
    await page.waitForTimeout(5000);
    const r = wf.lastFrame(page, 'WorkflowManagement');
    const dialogs = (await u.locator('.ui-dialog:visible').allInnerTexts().catch(() => [])).join(' | ').replace(/\s+/g, ' ');
    return `${r.url().split('/').pop()} ${(await r.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ').slice(0, 200)} ${dialogs}`.trim();
  };

  try {
    await test.step('setup: preset (one step for the test user) and two workflows A and B', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
      ids.A = await wf.createWorkflow(page, preset, `PW attach A ${stamp}`, 'Attachment test A');
      ids.B = await wf.createWorkflow(page, preset, `PW attach B ${stamp}`, 'Attachment test B');
      console.log(`created ${ids.A} ${ids.B}`);
    });

    await test.step('a new workflow has no attachments; the upload page shows the workflow, Submit is disabled until a file is chosen', async () => {
      expect(await openAttachmentsTab(ids.A)).toEqual([]);
      await f.locator('#btnUpload').click();
      await page.waitForTimeout(4000);
      const u = wf.lastFrame(page, 'GetUploadWorkflowAttachmentsData');
      expect(u.url()).toContain(`workflowId=${ids.A}`);
      expect(await u.locator('#txtWorkflowId').inputValue()).toBe(ids.A);
      expect(await u.locator('#txtWFDescription').inputValue()).toContain(`PW attach A ${stamp}`);
      await expect(u.locator('#btnSubmit')).toBeDisabled();
      await u.locator('#lnkAddAttachments').click();
      await u.locator('input[type=file]').first().setInputFiles(FILE1);
      await expect(u.locator('#btnSubmit')).toBeEnabled({ timeout: 5000 });
    });

    await test.step('Submit adds the file to the OPEN workflow (no warning); the Attachments tab lists it with user, date and name', async () => {
      const u = wf.lastFrame(page, 'GetUploadWorkflowAttachmentsData');
      await u.locator('#btnSubmit').click();
      await page.waitForTimeout(8000);
      expect(await wf.lastFrame(page, 'WorkflowManagement').locator('body').innerText()).toContain('success');
      const rows = await openAttachmentsTab(ids.A);
      console.log(`attachments of A: ${JSON.stringify(rows)}`);
      expect(rows.length).toBe(1);
      expect(rows[0]).toContain('pw_attach_1.txt');
      expect(rows[0].toLowerCase()).toContain(USERNAME.toLowerCase());
      expect(rows[0]).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
    });

    await test.step('the same file name again is refused as a duplicate', async () => {
      await f.locator('#btnUpload').click();
      await page.waitForTimeout(4000);
      const u = wf.lastFrame(page, 'GetUploadWorkflowAttachmentsData');
      await u.locator('#lnkAddAttachments').click();
      await u.locator('input[type=file]').first().setInputFiles(FILE1);
      await u.locator('#btnSubmit').click();
      await page.waitForTimeout(2000);
      const dlg = (await u.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
      console.log(`duplicate dialog: ${dlg}`);
      expect(dlg).toMatch(/duplicate|same name|already/i);
      await u.locator('.ui-dialog:visible button').filter({ hasText: /OK|Close/ }).first().click();
    });

    await test.step('two different files in ONE submit are both added', async () => {
      const rows0 = await openAttachmentsTab(ids.A);
      expect(rows0.length).toBe(1);
      const out = await upload([FILE2]);
      console.log(`second upload: ${out.slice(0, 120)}`);
      const rows = await openAttachmentsTab(ids.A);
      expect(rows.map((r) => (r.match(/pw_attach_\d\.txt/) ?? [])[0]).sort()).toEqual(['pw_attach_1.txt', 'pw_attach_2.txt']);
    });

    await test.step('Download returns the uploaded bytes', async () => {
      const row = f.locator('.ui-dialog:visible #attachmentsList tbody tr').filter({ hasText: 'pw_attach_1.txt' });
      const [download] = await Promise.all([page.waitForEvent('download', { timeout: 20_000 }), row.locator('input[id^="downloadFileBtn"]').click()]);
      expect(download.suggestedFilename()).toBe('pw_attach_1.txt');
      const saved = await download.path();
      expect(fs.readFileSync(saved!, 'utf8')).toBe(fs.readFileSync(FILE1, 'utf8'));
    });

    await test.step('Delete asks for confirmation; No keeps the file, Yes removes it', async () => {
      const del = () => f.locator('.ui-dialog:visible #attachmentsList tbody tr').filter({ hasText: 'pw_attach_2.txt' }).locator('input[id^="deleteFileBtn"]');
      await del().click();
      await page.waitForTimeout(1000);
      const dlg = (await wf.dialogText(f)).replace(/\s+/g, ' ');
      console.log(`delete confirm: ${dlg.slice(-200)}`);
      expect(dlg).toContain('pw_attach_2.txt');
      await f.locator('.ui-dialog:visible button').filter({ hasText: /^No$/ }).click();
      await page.waitForTimeout(800);
      expect(await openAttachmentsTab(ids.A)).toHaveLength(2);
      await del().click();
      await page.waitForTimeout(1000);
      await f.locator('.ui-dialog:visible button').filter({ hasText: /^Yes$/ }).click();
      await page.waitForTimeout(2500);
      expect(await openAttachmentsTab(ids.A)).toHaveLength(1);
      await closeDetail();
    });

    await test.step('close workflow B (approve it), then attaching to the CLOSED workflow warns first; Cancel adds nothing, Continue adds the file', async () => {
      f = await wf.showNewestFirst(page);
      await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids.B }).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await page.waitForTimeout(1000);
      const text = await wf.voteTickedWorkflows(page, f, ['approve'], USERNAME, PASSWORD);
      expect(text).toContain('Status Completed');
      expect(await openAttachmentsTab(ids.B)).toEqual([]);
      await upload([FILE1], { confirm: 'Cancel' });
      expect(await openAttachmentsTab(ids.B), 'Cancel adds nothing').toEqual([]);
      await upload([FILE1], { confirm: 'Continue' });
      const rows = await openAttachmentsTab(ids.B);
      console.log(`attachments of closed B: ${JSON.stringify(rows)}`);
      expect(rows.length).toBe(1);
      await closeDetail();
    });
  } finally {
    await test.step('cleanup: close A (reject) and delete the throw-away preset', async () => {
      f = await wf.showNewestFirst(page, 'Open Only');
      const mine = f.locator('#gridResults tr.jqgrow').filter({ hasText: `PW attach A ${stamp}` });
      if (await mine.count()) {
        await mine.first().locator('input[type=checkbox]').check({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        await wf.voteTickedWorkflows(page, f, ['reject'], USERNAME, PASSWORD).catch(() => '');
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset).catch(() => {});
    });
  }
});
