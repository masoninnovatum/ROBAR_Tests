// ITEM workflows (live 2026-10-05, Claude01): Campaign Manager > Send to Workflow starts a workflow for an item; Workflow Management
// lists it (description `Item: <n>, Version: <v>; Label Type: <lt>; Label: <template>, Version: <v>`) and lets the step user vote it.
// Observed lifecycle on item A (APPROVED) and item B (REJECTED), each on a throw-away one-step preset:
//   * while the workflow is open the item is LOCKED: its Item Edit page shows "Item being routed in workflow - cannot be modified."
//     as the approval status, Save is disabled and the Description is read-only (and Approve Item carries a "not authorized" tooltip)
//   * Approve -> the item becomes approved and its Approved By is the WORKFLOW ID ("20261005-0017 - 10/5/2026"), not a user
//   * Reject  -> the item is released again (unapproved, editable)
// Items cannot be deleted and workflows cannot be deleted: two throw-away items and workflows are left behind (TESTPW...).
// NOTE: `cm.openCampaignManager()` calls login() -- a second login on a logged-in session crashes the page, so open the tile directly.

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame, BASE_URL, USERNAME, PASSWORD } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as wf from '../support/workflow';

test('item workflow: Send to Workflow locks the item; approving closes it Approved (by the workflow id), rejecting releases it', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const items: Record<string, string> = {};
  const workflowIds: Record<string, string> = {};
  let f: Frame;

  const backToMenu = async () => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(2500);
  };
  const itemFacts = async (item: string) => {
    await cm.goToItem(page, item, 'Carton Label');
    const status = ((await page.locator('span[data-bind*="approvedStatus"]').first().textContent()) ?? '').trim();
    const saveEnabled = await page.locator('button:has-text("Save")').first().isEnabled().catch(() => false);
    const descEditable = await page.locator('input[name="txtDescription"]').isEditable().catch(() => false);
    return { status, saveEnabled, descEditable };
  };
  const newestFirst = async () => {
    f = await wf.openWorkflowManagement(page);
    await f.click('#btCancel', { timeout: 5000 });
    await page.waitForTimeout(2500);
    f = wf.lastFrame(page, 'WorkflowManagement/Management');
    await f.locator('#drpUser').selectOption({ label: 'Any User' });
    await f.click('#btGetWorkflows');
    await f.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 20_000 });
    await page.waitForTimeout(1500);
    for (let i = 0; i < 3; i++) {
      const col = await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
      if (col.length < 2 || col[0].trim() >= col[col.length - 1].trim()) break;
      await f.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
      await page.waitForTimeout(2500);
    }
  };

  try {
    await test.step('setup: a throw-away preset (one step for the test user)', async () => {
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
    });

    for (const key of ['A', 'B']) {
      await test.step(`item ${key}: create it and Send to Workflow (Campaign Manager bulk action)`, async () => {
        await backToMenu();
        await openMenuItem(page, 'Campaign Manager');
        const cmFrame = await findFrame(page, 'campaignmanager');
        await page.waitForTimeout(1500);
        const created = await cm.createItem(page, cmFrame, { description: `Playwright item workflow ${key} ${stamp}` });
        items[key] = created.itemNumber;
        const grid = await cm.backToGrid(page, created.editFrame);
        await cm.retrieveAndSelectItem(page, grid, items[key]);
        await cm.startBulkAction(page, grid, 'WorkFlowSendTo');
        await grid.fill('#txtDescription', `PW item workflow ${key} ${stamp}`);
        await grid.fill('#txtComments', `Item ${key} sent to workflow by Playwright`);
        await Promise.all([page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/GetWorkflowSteps'), { timeout: 10_000 }), grid.selectOption('#drpPreset', { label: preset })]);
        const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/SubmitJob'), { timeout: 15_000 }), grid.click('#btnSubmit')]);
        expect((await response.json()).Success).toBe(true);
        // the job runs asynchronously: wait for Completed on the Job Detail page
        let text = '';
        for (let i = 0; i < 20; i++) {
          await page.waitForTimeout(2500);
          const jf = page.frames().filter((x) => x.url().includes('CampaignManager/JobDetail')).pop() ?? grid;
          text = (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
          if (/Status Completed/.test(text)) break;
        }
        console.log(`send-to-workflow job (${key}): ${text.slice(0, 300)}`);
        expect(text).toContain('Status Completed');
        expect(text).toContain(items[key]);
      });
    }

    await test.step('while the workflows are open both items are LOCKED', async () => {
      for (const key of ['A', 'B']) {
        const facts = await itemFacts(items[key]);
        console.log(`item ${key} during workflow: ${JSON.stringify(facts)}`);
        expect(facts.status).toBe('Item being routed in workflow – cannot be modified.');
        expect(facts.saveEnabled, 'Save disabled').toBe(false);
        expect(facts.descEditable, 'Description read-only').toBe(false);
      }
    });

    await test.step('Workflow Management lists them with the generated description; the Detail dialog opens', async () => {
      await backToMenu();
      await newestFirst();
      const rows = (await f.locator('#gridResults tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      for (const key of ['A', 'B']) {
        const row = rows.find((r) => r.includes(`Item: ${items[key]},`));
        expect(row, `item workflow ${key} on page 1`).toBeTruthy();
        expect(row).toMatch(new RegExp(`Item: ${items[key]}, Version: 0; Label Type: Carton Label; Label: A1SuperTemplate, Version: 0 Open`));
        workflowIds[key] = (row!.match(/^(\d{8}-\d{4})/) ?? [])[1];
        expect(workflowIds[key]).toBeTruthy();
      }
      const rowA = f.locator('#gridResults tr.jqgrow').filter({ hasText: items.A });
      await rowA.getByText('Detail').click();
      await page.waitForTimeout(3500);
      expect((await f.locator('.ui-dialog:visible .ui-tabs-nav li').allInnerTexts()).map((t) => t.trim())).toEqual(['Workflow Image', 'Comments & History', 'Steps', 'Attachments', 'Close']);
      expect(await wf.dialogText(f), 'the item workflow image tab offers a New Window').toContain('New Window');
      await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
      await page.waitForTimeout(800);
    });

    await test.step('vote: approve item A, reject item B (one View And Vote job)', async () => {
      const rowOf = (key: string) => f.locator('#gridResults tr.jqgrow').filter({ hasText: items[key] });
      await rowOf('A').locator('input[type=checkbox]').check();
      await rowOf('B').locator('input[type=checkbox]').check();
      await page.waitForTimeout(1500);
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await f.locator('#actViewAndVote').click({ force: true });
      await page.waitForTimeout(5000);
      const vf = wf.lastFrame(page, 'WFViewAndVote/JobSubmission');
      const voteRows = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
      await expect(voteRows).toHaveCount(2);
      await voteRows.filter({ hasText: items.A }).locator('input[type=checkbox]').nth(0).check();
      await voteRows.filter({ hasText: items.B }).locator('input[type=checkbox]').nth(1).check();
      await vf.locator('#btnUpdate').click();
      await page.waitForTimeout(2000);
      await vf.locator('#jobDescription').fill('PW item vote');
      await vf.locator('#UserID').fill(USERNAME);
      await vf.locator('#Password').fill(PASSWORD);
      await vf.locator('#Reason').selectOption({ label: 'General' });
      await vf.locator('#Comment').fill('Voted by Playwright');
      await vf.locator('#Password').press('Tab');
      await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
      await page.waitForTimeout(5000);
      let text = '';
      for (let i = 0; i < 15; i++) {
        const rf = wf.lastFrame(page, 'WFViewAndVote/JobDetail');
        text = (await rf.locator('body').innerText()).replace(/\s+/g, ' ');
        if (/Status Completed/.test(text)) break;
        await page.waitForTimeout(2000);
      }
      expect(text).toContain('Status Completed');
      expect(text).toContain(workflowIds.A);
      expect(text).toContain(workflowIds.B);
    });

    await test.step('the items follow their workflows: A approved BY THE WORKFLOW ID and editable-state changes; B released unapproved', async () => {
      await page.waitForTimeout(4000);
      const a = await itemFacts(items.A);
      console.log(`item A after approval: ${JSON.stringify(a)}`);
      expect(a.status, 'Approved By is the workflow id').toMatch(new RegExp(`^${workflowIds.A} - \\d{1,2}/\\d{1,2}/\\d{4}$`));
      const b = await itemFacts(items.B);
      console.log(`item B after rejection: ${JSON.stringify(b)}`);
      expect(b.status, 'a rejected workflow releases the item').toBe('Unapproved');
      expect(b.descEditable, 'and it is editable again').toBe(true);
    });
  } finally {
    await test.step('cleanup: delete the throw-away preset', async () => {
      await backToMenu().catch(() => {});
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset);
    });
  }
});
