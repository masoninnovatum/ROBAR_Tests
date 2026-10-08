// TEMPLATE workflows (live 2026-10-05, Claude01, HEADED because creating the template drives BarTender): Template Management > Bulk
// Actions > Submit to Workflow puts templates into a workflow; Workflow Management lists them and the step user votes them.
// One Submit to Workflow job covers TWO templates: a fresh one (will be APPROVED) and an existing unapproved MBGDMD fixture (will be
// REJECTED, so it stays unapproved and the Search_and_Filter / Mass_Approve_Negative expectations about MBGDMD hold).
// The new template, its approved state and the two workflows are left behind (templates/workflows cannot be deleted); the preset is
// deleted. Uses the real mouse (FlaUI) during the BarTender step -- do not touch the mouse.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';
import * as bartender from '../support/bartender';
import * as wf from '../support/workflow';
import { resolveBtwFile } from '../support/templates';

test.use({ headless: false });

test('template workflow: Submit to Workflow for two templates, then approve one and reject the other', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const keepAlive = setInterval(() => {
    page.evaluate(() => {
      const w = window as unknown as { RefreshTimeout?: () => void };
      if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout();
    }).catch(() => {});
  }, 60_000);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const newTemplate = `MBWFTpl${stamp}`;
  let fixture = '';
  const ids: Record<string, string> = {};
  let f: Frame;

  try {
    await test.step('setup: a throw-away preset (one step for the test user)', async () => {
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
    });

    await test.step('setup: reject leftover OPEN template workflows of earlier runs (a template can only be in one open workflow)', async () => {
      f = await wf.showNewestFirst(page, 'Open Only');
      const rows = f.locator('#gridResults tr.jqgrow').filter({ hasText: /Label: MB(WFTpl|GDMD)/ });
      const n = await rows.count();
      console.log(`leftover open template workflows: ${n}`);
      if (n > 0) {
        for (let i = 0; i < n; i++) await rows.nth(i).locator('input[type=checkbox]').check();
        await page.waitForTimeout(1500);
        const text = await wf.voteTickedWorkflows(page, f, Array(n).fill('reject'), USERNAME, PASSWORD, 'Closed by Playwright cleanup');
        expect(text).toContain('Status Completed');
      }
    });

    await test.step('create a new template from A1SuperTemplate (BarTender save + close)', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      await openMenuItem(page, 'Template Management');
      const tm = await findFrame(page, 'TemplateManagement');
      await tm.click('#drpMainActions');
      await page.waitForTimeout(500);
      await tm.click('#actCreateTemplate', { force: true });
      await page.waitForTimeout(1000);
      await tm.fill('#txtTemplateName', newTemplate);
      await tm.fill('#txtDescription', 'Created for the template workflow test');
      await tm.selectOption('#ddlLabelType', { value: 'Carton Label' });
      await tm.setInputFiles('#newFileInput', resolveBtwFile());
      await page.waitForTimeout(500);
      const [createResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
        tm.locator('button:has-text("Submit"):visible').first().click({ force: true }),
      ]);
      expect((await createResponse.json()).Success).toBe(true);
      const pid = await bartender.launchTemplateEditor(page);
      await bartender.saveTemplate(page, pid);
      await bartender.closeTemplateEditor(page, pid);
    });

    await test.step('Template Management: tick the new template and an unapproved MBGDMD fixture -> Submit to Workflow (one job)', async () => {
      const tm = await findFrame(page, 'TemplateManagement');
      await tm.click('#btnReset', { timeout: 5000 });
      await page.waitForTimeout(2000);
      let t = await findFrame(page, 'TemplateManagement');
      if (await t.locator('#chkFilterByDataSource').isChecked()) await t.locator('#chkFilterByDataSource').uncheck();
      await t.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
      await t.locator('select[name="dvFilters[0].Column"]').selectOption('LabelName', { timeout: 5000 });
      await t.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains', { timeout: 5000 });
      await t.locator('input[name="dvFilters[0].Value"]').fill('MBGDMD', { timeout: 5000 });
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
      await page.waitForTimeout(2500);
      fixture = ((await t.locator('#grdJqGrid tr.jqgrow').first().innerText()).replace(/\s+/g, ' ').trim().split(' ')[1]) || '';
      console.log(`fixture to reject: ${fixture}`);
      expect(fixture).toMatch(/^MBGDMD/);
      await t.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'In' }, { timeout: 5000 });
      await t.locator('input[name="dvFilters[0].Value"]').fill(`${newTemplate},${fixture}`, { timeout: 5000 });
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
      await page.waitForTimeout(2500);
      await expect(t.locator('#grdJqGrid tr.jqgrow')).toHaveCount(2);
      for (const name of [newTemplate, fixture]) {
        await Promise.all([
          page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
          t.locator('#grdJqGrid tr.jqgrow').filter({ hasText: name }).locator('input[type="checkbox"]').check(),
        ]);
        await page.waitForTimeout(500);
      }
      await t.getByText('Bulk Actions', { exact: true }).click();
      await page.waitForTimeout(500);
      await t.getByText('Submit to Workflow', { exact: true }).click();
      await t.getByRole('heading', { name: 'Submit to Workflow' }).waitFor({ state: 'visible', timeout: 15_000 });
      await t.fill('#txtJobDescription', `PW template workflow ${stamp}`);
      await t.fill('#txtComment', 'Templates sent to workflow by Playwright');
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
      console.log(`template workflow job: ${text.slice(0, 500)}`);
      expect(text).toContain(newTemplate);
      expect(text).toContain(fixture);
    });

    await test.step('Workflow Management lists the two template workflows (description "Template: ...")', async () => {
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
      console.log(`first rows: ${JSON.stringify(rows.slice(0, 3))}`);
      for (const [key, name] of [['A', newTemplate], ['B', fixture]] as const) {
        const row = rows.find((r) => r.includes(name));
        expect(row, `template workflow for ${name}`).toBeTruthy();
        expect(row).toContain(' Open ');
        ids[key] = (row!.match(/^(\d{8}-\d{4})/) ?? [])[1];
      }
    });

    await test.step('vote: approve the new template, reject the fixture', async () => {
      // earlier (rejected) workflows of the reused fixture are also in the list: only its OPEN one is wanted
      const rowOf = (name: string) => f.locator('#gridResults tr.jqgrow').filter({ hasText: name }).filter({ hasText: /Open/ });
      await rowOf(newTemplate).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await rowOf(fixture).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await page.waitForTimeout(1500);
      await f.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await f.locator('#actViewAndVote').click({ force: true });
      await page.waitForTimeout(5000);
      const vf = wf.lastFrame(page, 'WFViewAndVote/JobSubmission');
      const voteRows = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
      await expect(voteRows).toHaveCount(2);
      await voteRows.filter({ hasText: newTemplate }).locator('input[type=checkbox]').nth(0).check();
      await voteRows.filter({ hasText: fixture }).locator('input[type=checkbox]').nth(1).check();
      await vf.locator('#btnUpdate').click();
      await page.waitForTimeout(2000);
      await vf.locator('#jobDescription').fill('PW template vote');
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

    await test.step('Template Management: the new template is approved BY THE WORKFLOW, the rejected fixture is still unapproved', async () => {
      await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
      await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
      await openMenuItem(page, 'Template Management');
      const t = await findFrame(page, 'TemplateManagement');
      await t.locator('#btnRetrieveData').waitFor({ timeout: 15_000 });
      await page.waitForTimeout(2500);
      await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
      await page.waitForTimeout(2500);
      const rows = (await t.locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((x) => x.replace(/\s+/g, ' ').trim());
      console.log(`templates after voting: ${JSON.stringify(rows)}`);
      const a = rows.find((r) => r.includes(newTemplate))!;
      const b = rows.find((r) => r.includes(fixture))!;
      expect(a, 'approved: Approved By holds the workflow id').toContain(ids.A);
      expect(b, 'rejected: still unapproved (1/1/1900 approval date)').toContain('1/1/1900');
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
