// Linked Documents security (headless; MB fixtures MBPWLoginGrp / MBPWLogin01 only). The "Linked Documents" button (`#btnLinkManagement`) of a TEMPLATE (label) workflow's Detail
// dialog is rendered DISABLED unless the user holds LM_View_LinkManagement; with it the click opens the Link Management tab filtered by the template.
// Data: an existing unapproved MBGDMD fixture template is submitted to a throw-away one-step-group preset [test user, MB user] with Template Management > Submit to Workflow (no
// BarTender needed); the workflow is rejected by both voters at the end (the template stays unapproved) and the preset is deleted.

import { test, expect } from '@playwright/test';
import type { Browser, Frame, Page } from '@playwright/test';
import { login, loginAs, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as sec from '../support/security';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

const GROUP = 'MBPWLoginGrp';
const MB = 'MBPWLogin01';
const VOTER = ['Login_WebMenu', 'Web_WorkflowManagement', 'WM_ViewAndVote', 'WM_ViewAndVoteCheckBox', 'WM_ViewAndVoteSkipComment'];

test('Linked Documents security: the button is disabled without LM_View_LinkManagement and opens Link Management with it', async ({ page, browser }) => {
  test.setTimeout(900_000);
  sec.assertMb(GROUP);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  let template = '';
  let workflowId = '';
  let f: Frame;

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
  const voteAsMb = async (kind: wf.VoteKind) => {
    const u = await asMb();
    try {
      const h = await u.list();
      await h.locator('#gridResults tr.jqgrow').filter({ hasText: workflowId }).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await u.p.waitForTimeout(1000);
      expect(await wf.voteTickedWorkflows(u.p, h, [kind], MB, PASSWORD)).toContain('Status Completed');
    } finally {
      await u.close();
    }
  };

  try {
    await test.step('setup: group can vote; preset [test user, MB user] in group 1', async () => {
      await login(page);
      await sec.setGroupProcesses(page, GROUP, VOTER);
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPWFlow/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPresetWithSteps(page, pf, preset, [{ user: `${USERNAME} (`, group: 1 }, { user: `${MB} (`, group: 1 }]);
    });

    await test.step('Template Management: Submit one unapproved MBGDMD template to the preset (Submit to Workflow job)', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      await openMenuItem(page, 'Template Management');
      const tm = await findFrame(page, 'TemplateManagement');
      await tm.click('#btnReset', { timeout: 5000 });
      await page.waitForTimeout(2500);
      const t = await findFrame(page, 'TemplateManagement');
      if (await t.locator('#chkFilterByDataSource').isChecked()) await t.locator('#chkFilterByDataSource').uncheck();
      await t.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await t.locator('select[name="dvFilters[0].Column"]').selectOption('LabelName', { timeout: 5000 });
      await t.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains', { timeout: 5000 });
      await t.locator('input[name="dvFilters[0].Value"]').fill('MBGDMD', { timeout: 5000 });
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
      await page.waitForTimeout(2500);
      template = ((await t.locator('#grdJqGrid tr.jqgrow').first().innerText()).replace(/\s+/g, ' ').trim().split(' ')[1]) || '';
      console.log(`template: ${template}`);
      expect(template).toMatch(/^MBGDMD/);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
        t.locator('#grdJqGrid tr.jqgrow').first().locator('input[type="checkbox"]').check(),
      ]);
      await page.waitForTimeout(500);
      await t.getByText('Bulk Actions', { exact: true }).click();
      await page.waitForTimeout(500);
      await t.getByText('Submit to Workflow', { exact: true }).click();
      await t.getByRole('heading', { name: 'Submit to Workflow' }).waitFor({ state: 'visible', timeout: 15_000 });
      await t.fill('#txtJobDescription', `PW linkdoc security ${stamp}`);
      await t.fill('#txtComment', 'Linked documents security');
      await t.locator('#txtComment').press('Tab');
      await Promise.all([page.waitForResponse((r) => r.url().includes('GetWorkflowSteps'), { timeout: 10_000 }).catch(() => null), t.selectOption('#drpPreset', { label: preset })]);
      await page.waitForTimeout(800);
      await expect(t.locator('#btnSubmit')).toBeEnabled({ timeout: 10_000 });
      const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('SubmitJob') && r.request().method() === 'POST', { timeout: 15_000 }), t.locator('#btnSubmit').click()]);
      expect((await response.json()).Success).toBe(true);
      for (let i = 0; i < 20; i++) {
        const text = (await t.locator('body').innerText()).replace(/\s+/g, ' ');
        if (/Status Completed/.test(text)) break;
        await page.waitForTimeout(2500);
      }
      await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      f = await wf.showNewestFirst(page);
      const row = f.locator('#gridResults tr.jqgrow').filter({ hasText: template }).first();
      workflowId = (await row.locator('td[aria-describedby="gridResults_WorkflowID"]').innerText()).trim();
      console.log(`template workflow ${workflowId}`);
      expect(workflowId).toMatch(/^\d{8}-\d{4}$/);
    });

    await test.step('without LM_View_LinkManagement the Linked Documents button is DISABLED', async () => {
      const u = await asMb();
      try {
        const h = await u.list();
        await h.locator('#gridResults tr.jqgrow').filter({ hasText: workflowId }).getByText('Detail').click({ timeout: 10_000 });
        await u.p.waitForTimeout(3500);
        const btn = h.locator('.ui-dialog:visible #btnLinkManagement');
        expect(await btn.count(), 'a template workflow has the button').toBe(1);
        expect(await btn.isDisabled()).toBe(true);
      } finally {
        await u.close();
      }
    });

    await test.step('with LM_View_LinkManagement the button is enabled and opens Link Management filtered by the template', async () => {
      await sec.setGroupProcesses(page, GROUP, [...VOTER, 'LM_View_LinkManagement']);
      const u = await asMb();
      try {
        const h = await u.list();
        await h.locator('#gridResults tr.jqgrow').filter({ hasText: workflowId }).getByText('Detail').click({ timeout: 10_000 });
        await u.p.waitForTimeout(3500);
        const btn = h.locator('.ui-dialog:visible #btnLinkManagement');
        await expect(btn).toBeEnabled();
        await btn.click();
        await expect.poll(async () => (await u.p.locator('li.ui-tabs-tab').allInnerTexts()).join('|'), { timeout: 20_000 }).toContain('LinkManagement');
        let lf: Frame | undefined;
        for (let i = 0; i < 20 && !lf; i++) {
          lf = u.p.frames().filter((x) => x.url().includes(`LinkAttachmentManagement/LinkManagement?workflowId=${workflowId}`)).pop();
          if (!lf) await u.p.waitForTimeout(1000);
        }
        expect(lf, 'the Link Management frame').toBeTruthy();
        await u.p.waitForTimeout(4000);
        const values = await lf!.locator('input[name^="dvFilters"]').evaluateAll((e) => e.map((x) => (x as HTMLInputElement).value));
        console.log(`link management filter values: ${JSON.stringify(values)}`);
        expect(values).toContain(template);
      } finally {
        await u.close();
      }
    });
  } finally {
    await test.step('cleanup: both voters reject the workflow; delete the preset; leave the group without processes', async () => {
      try {
        await sec.setGroupProcesses(page, GROUP, VOTER);
        f = await wf.showNewestFirst(page);
        await f.locator('#gridResults tr.jqgrow').filter({ hasText: workflowId }).locator('input[type=checkbox]').check({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        await wf.voteTickedWorkflows(page, f, ['reject'], USERNAME, PASSWORD);
        await voteAsMb('reject');
      } catch (e) {
        console.log(`could not close the workflow: ${String(e).slice(0, 140)}`);
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset).catch(() => {});
      await sec.setGroupProcesses(page, GROUP, []);
    });
  }
});
