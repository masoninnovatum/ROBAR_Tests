// SMOKE (Tier 2, HEADED): a brand-new template goes through workflow and is approved by the vote.
// Flow: create a new CL template from the base .btw (BarTender save + close via FlaUI) -> Template Management Submit to Workflow with a throw-away
// one-step preset -> Workflow Management lists it -> View and Vote approves it (e-signature auto-filled from seed.ts: allowed for smoke runs, user 2026-10-14)
// -> Template Management shows the template approved BY THE WORKFLOW (Approved By = workflow id).
// Condensed from Workflow-Management/Template_Workflow.spec.ts (which also rejects a second fixture template); this one touches only its own new template.
// Left behind (templates and workflows cannot be deleted): the CLSmkTpl<stamp> template and its workflow. The preset is deleted again.
// Uses the real mouse (FlaUI) during the BarTender step: do not touch the mouse. Run with: npx playwright test --grep @tier2 (or npm run smoke:headed)

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../../support/robar';
import * as bartender from '../../support/bartender';
import * as wf from '../../support/workflow';
import { resolveBtwFile } from '../../support/templates';

test.use({ headless: false });

test('@smoke @tier2 template workflow: create a template, send it to workflow, approve it by vote', async ({ page }) => {
  test.setTimeout(1_200_000);
  const t0 = Date.now();
  const lap = (what: string) => console.log(`SMOKE ${((Date.now() - t0) / 1000).toFixed(0)}s ${what}`);
  await login(page);
  const keepAlive = setInterval(() => {
    page.evaluate(() => {
      const w = window as unknown as { RefreshTimeout?: () => void };
      if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
    }).catch(() => {});
  }, 60_000);
  const stamp = Date.now().toString().slice(-6);
  const preset = `CLSmkPreset${stamp}`;
  const template = `CLSmkTpl${stamp}`;
  let workflowId = '';
  let f: Frame;

  try {
    await test.step('setup: throw-away preset with one step for the test user', async () => {
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^(MB|CL)(PW(Flow|Preset)|SmkPreset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
      lap('preset created');
    });

    await test.step('setup: reject leftover OPEN workflows of earlier smoke / template runs (a template can only be in one open workflow)', async () => {
      f = await wf.showNewestFirst(page, 'Open Only');
      const rows = f.locator('#gridResults tr.jqgrow').filter({ hasText: /Label: (MB|CL)(WFTpl|SmkTpl)/ });
      const n = await rows.count();
      console.log(`leftover open smoke/template workflows: ${n}`);
      if (n > 0) {
        for (let i = 0; i < n; i++) await rows.nth(i).locator('input[type=checkbox]').check();
        await page.waitForTimeout(1500);
        const text = await wf.voteTickedWorkflows(page, f, Array(n).fill('reject'), USERNAME, PASSWORD, 'Closed by Playwright smoke cleanup');
        expect(text).toContain('Status Completed');
      }
    });

    await test.step('create a new template from the base .btw (BarTender save + close)', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      await openMenuItem(page, 'Template Management');
      const tm = await findFrame(page, 'TemplateManagement');
      await tm.click('#drpMainActions');
      await page.waitForTimeout(500);
      await tm.click('#actCreateTemplate', { force: true });
      await page.waitForTimeout(1000);
      await tm.fill('#txtTemplateName', template);
      await tm.fill('#txtDescription', 'Created for the smoke test');
      await tm.selectOption('#ddlLabelType', { value: 'Carton Label' });
      await tm.setInputFiles('#newFileInput', resolveBtwFile());
      await page.waitForTimeout(500);
      const [createResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
        tm.locator('button:has-text("Submit"):visible').first().click({ force: true }),
      ]);
      expect((await createResponse.json()).Success).toBe(true);
      const pid = await bartender.launchTemplateEditor(page, 240);
      await bartender.saveTemplate(page, pid);
      await bartender.closeTemplateEditor(page, pid);
      lap('template created and saved');
    });

    await test.step('Template Management: find the new template, tick it, Bulk Actions > Submit to Workflow', async () => {
      const tm = await findFrame(page, 'TemplateManagement');
      await tm.click('#btnReset', { timeout: 5000 });
      await page.waitForTimeout(2000);
      const t = await findFrame(page, 'TemplateManagement');
      if (await t.locator('#chkFilterByDataSource').isChecked()) await t.locator('#chkFilterByDataSource').uncheck();
      await t.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await t.locator('select[name="dvFilters[0].Column"]').selectOption('LabelName', { timeout: 5000 });
      await t.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains', { timeout: 5000 });
      await t.locator('input[name="dvFilters[0].Value"]').fill(template, { timeout: 5000 });
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
      await page.waitForTimeout(2500);
      await expect(t.locator('#grdJqGrid tr.jqgrow')).toHaveCount(1);
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
        t.locator('#grdJqGrid tr.jqgrow').filter({ hasText: template }).locator('input[type="checkbox"]').check(),
      ]);
      await page.waitForTimeout(500);
      await t.getByText('Bulk Actions', { exact: true }).click();
      await page.waitForTimeout(500);
      await t.getByText('Submit to Workflow', { exact: true }).click();
      await t.getByRole('heading', { name: 'Submit to Workflow' }).waitFor({ state: 'visible', timeout: 15_000 });
      await t.fill('#txtJobDescription', `PW smoke template workflow ${stamp}`);
      await t.fill('#txtComment', 'Template sent to workflow by the smoke test');
      await t.locator('#txtComment').press('Tab');
      await Promise.all([page.waitForResponse((r) => r.url().includes('GetWorkflowSteps'), { timeout: 10_000 }).catch(() => null), t.selectOption('#drpPreset', { label: preset })]);
      await page.waitForTimeout(800);
      await expect(t.locator('#btnSubmit')).toBeEnabled({ timeout: 10_000 });
      const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('SubmitJob') && r.request().method() === 'POST', { timeout: 15_000 }), t.locator('#btnSubmit').click()]);
      expect((await response.json()).Success).toBe(true);
      await expect(t.getByRole('heading', { name: 'Submit to Workflow Job Detail' })).toBeVisible();
      let text = '';
      for (let i = 0; i < 20; i++) {
        text = (await t.locator('body').innerText()).replace(/\s+/g, ' ');
        if (/Status Completed/.test(text)) break;
        await page.waitForTimeout(2500);
      }
      expect(text).toContain(template);
      lap('submitted to workflow');
    });

    await test.step('Workflow Management lists the template workflow as Open', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
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
      const rows = (await f.locator('#gridResults tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
      const row = rows.find((r) => r.includes(template));
      expect(row, `template workflow for ${template}`).toBeTruthy();
      expect(row).toContain(' Open ');
      workflowId = (row!.match(/^(\d{8}-\d{4})/) ?? [])[1];
      expect(workflowId).toBeTruthy();
      lap(`workflow ${workflowId} listed`);
    });

    await test.step('vote: approve (e-signature filled from seed.ts)', async () => {
      const row = f.locator('#gridResults tr.jqgrow').filter({ hasText: template }).filter({ hasText: /Open/ });
      await row.locator('input[type=checkbox]').check({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await f.locator('#actViewAndVote').click({ force: true });
      for (let i = 0; i < 15 && !page.frames().some((fr) => fr.url().includes('WFViewAndVote/JobSubmission')); i++) await page.waitForTimeout(2000);
      console.log(`frames after View and Vote: ${JSON.stringify(page.frames().map((fr) => fr.url().slice(-80)))}`);
      const vf = wf.lastFrame(page, 'WFViewAndVote/JobSubmission');
      const voteRows = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
      await expect(voteRows).toHaveCount(1);
      await voteRows.filter({ hasText: template }).locator('input[type=checkbox]').nth(0).check();
      await vf.locator('#btnUpdate').click();
      await page.waitForTimeout(2000);
      await vf.locator('#jobDescription').fill('PW smoke template vote');
      await vf.locator('#UserID').fill(USERNAME);
      await vf.locator('#Password').fill(PASSWORD);
      await vf.locator('#Reason').selectOption({ label: 'General' });
      await vf.locator('#Comment').fill('Voted by the smoke test');
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
      lap('vote completed');
    });

    await test.step('Template Management: the template is approved BY THE WORKFLOW', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      await openMenuItem(page, 'Template Management');
      const t = await findFrame(page, 'TemplateManagement');
      await t.locator('#btnRetrieveData').waitFor({ timeout: 15_000 });
      await page.waitForTimeout(2500);
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
      await page.waitForTimeout(2500);
      const rows = (await t.locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
      const mine = rows.find((r) => r.includes(template));
      console.log(`template after voting: ${mine}`);
      expect(mine, 'new template listed').toBeTruthy();
      expect(mine, 'Approved By holds the workflow id').toContain(workflowId);
      lap('template approved by workflow: SMOKE PASS');
    });
  } finally {
    clearInterval(keepAlive);
    await test.step('cleanup: delete the throw-away preset', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset);
    });
  }
});
