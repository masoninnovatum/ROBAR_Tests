// Edit Workflows on workflows whose step has ALREADY been voted (headless, Claude01). Docs: the bulk editor only changes OPEN steps without votes; it warns when some selected
// workflows are past that point. W1 = the test user already approved step 1, W2 = untouched. OBSERVATION first: both are edited together (Replace User test user -> MBUser4)
// and the per-workflow job messages + resulting steps are logged. Throw-away preset deleted; workflows closed at the end.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

test('Edit Workflows with an already voted step: observe warning, per-workflow messages and the resulting steps', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: Record<string, string> = {};
  let f: Frame = await wf.openWorkflowManagement(page);

  const openEdit = async (keys: string[]): Promise<Frame> => {
    f = await wf.showNewestFirst(page);
    for (const k of keys) await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids[k] }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await f.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actWfEdit').click({ force: true });
    await page.waitForTimeout(5000);
    const ef = wf.lastFrame(page, 'WorkflowManagement/Edit');
    await expect(ef.locator('body')).toContainText('Workflows Selected', { timeout: 15_000 });
    return ef;
  };
  const jobText = async (): Promise<string> => {
    let text = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2500);
      text = (await wf.lastFrame(page, 'WorkflowManagement').locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/Status Completed/.test(text)) break;
    }
    return text;
  };
  const stepsOf = async (key: string): Promise<string[]> => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids[key] }).getByText('Detail').click({ timeout: 10_000 });
    await page.waitForTimeout(3500);
    await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Steps' }).click();
    await page.waitForTimeout(1500);
    const rows = (await f.locator('.ui-dialog:visible table tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const from = rows.findIndex((r) => r.startsWith('User Group Department'));
    const to = rows.findIndex((r) => r.startsWith('User Attach'));
    return rows.slice(from + 1, to < 0 ? undefined : to);
  };

  try {
    await test.step('setup: preset [test user g1, MBUser3 g2], W1 (test user already approved) and W2 (untouched)', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPresetWithSteps(page, pf, preset, [{ user: `${USERNAME} (`, group: 1 }, { user: 'MBUser3 (', group: 2 }]);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
      ids.W1 = await wf.createWorkflow(page, preset, `PW votededit W1 ${stamp}`, 'Voted edit W1');
      ids.W2 = await wf.createWorkflow(page, preset, `PW votededit W2 ${stamp}`, 'Voted edit W2');
      f = await wf.showNewestFirst(page);
      await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids.W1 }).locator('input[type=checkbox]').check({ timeout: 10_000 });
      await page.waitForTimeout(1000);
      expect(await wf.voteTickedWorkflows(page, f, ['approve'], USERNAME, PASSWORD)).toContain('Status Completed');
      console.log(`W1 steps: ${JSON.stringify(await stepsOf('W1'))}`);
      console.log(`W2 steps: ${JSON.stringify(await stepsOf('W2'))}`);
    });

    await test.step('OBSERVE: Edit Workflows with W1 (voted) + W2 together', async () => {
      const ef = await openEdit(['W1', 'W2']);
      console.log(`Edit page: ${(await ef.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 500)}`);
      // the voted and the unvoted workflow have the same steps, so they are ONE group (Count 2) -- the voted step shows yellow with "(50%)" partial voting
      expect(await ef.locator('#grdWorkflows tr.jqgrow').count()).toBe(1);
      expect((await ef.locator('#divTopWarning').innerText()).trim()).toContain('Voting is complete on some of the selected workflows. Only open workflows can be changed.');
      expect(await ef.locator('#grdWorkflows .grid-approvalgroup a').first().innerText()).toContain('(50%)');
      console.log(`step buttons: ${JSON.stringify(await ef.locator('#grdWorkflows .grid-approvalgroup a').evaluateAll((a) => a.map((x) => `${(x.textContent || '').trim()}|${x.className}`)))}`);
      await ef.locator('#drpActions').click();
      await page.waitForTimeout(500);
      await ef.locator('#lnkReplaceUser').click({ force: true });
      await page.waitForTimeout(1500);
      console.log(`replace-from options: ${JSON.stringify(await ef.locator('#drpUserToReplace option').allInnerTexts())}`);
      const from = (await ef.locator('#drpUserToReplace option').allInnerTexts()).map((t) => t.trim()).find((t) => t.toLowerCase().startsWith(USERNAME.toLowerCase() + ' ('));
      const to = (await ef.locator('#drpUserToReplaceWith option').allInnerTexts()).map((t) => t.trim()).find((t) => /^MBUser4 \(/i.test(t));
      await ef.locator('#drpUserToReplace').selectOption({ label: from! });
      await ef.locator('#drpUserToReplaceWith').selectOption({ label: to! });
      await ef.locator('#btReplaceUser').click();
      const job = await jobText();
      console.log(`REPLACE JOB: ${job.slice(0, 600)}`);
      expect(job).toContain('Number of Workflows: 2');
      expect(job, 'W2 (open step) is changed').toContain('mbuser4 replaced user claude01.');
      expect(job, 'W1 (already voted) is reported but not changed').toContain('User claude01 has already voted or does not exist.');
      const w1 = await stepsOf('W1');
      const w2 = await stepsOf('W2');
      console.log(`W1 steps after: ${JSON.stringify(w1)} | W2 steps after: ${JSON.stringify(w2)}`);
      expect(w1[0]).toMatch(/^Claude01 1 QA Approved/);
      expect(w2[0]).toMatch(/^mbuser4 1 /);
    });
  } finally {
    await test.step('cleanup: remove MBUser3/MBUser4 from each workflow, close both (closeWorkflow adds a step if all steps are voted), delete the preset', async () => {
      try {
        for (const key of ['W1', 'W2']) {
          for (const user of ['MBUser3', 'MBUser4']) {
            const ef = await openEdit([key]);
            await ef.locator('#drpActions').click();
            await page.waitForTimeout(500);
            await ef.locator('#lnkDeleteUser').click({ force: true });
            await page.waitForTimeout(1500);
            const opt = (await ef.locator('#drpUserToDelete option').allInnerTexts()).map((t) => t.trim()).find((t) => t.toLowerCase().startsWith(`${user.toLowerCase()} (`));
            if (!opt) continue;
            await ef.locator('#drpUserToDelete').selectOption({ label: opt });
            await ef.locator('#btDeleteUser').click();
            await jobText();
          }
          await wf.closeWorkflow(page, ids[key], USERNAME, PASSWORD);
        }
      } catch (e) {
        console.log(`workflow cleanup skipped: ${String(e).slice(0, 160)}`);
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset).catch(() => {});
    });
  }
});
