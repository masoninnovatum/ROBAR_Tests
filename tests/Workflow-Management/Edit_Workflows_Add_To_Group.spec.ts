// Edit Workflows > Actions > Add User > "Add to Group" (headless, Claude01). The Add form (`#dvMainEdit`) has an approval group number `#txtApprovalGroup` (enabled for this action)
// and two radios `#rdAddToGroup` ("Add Step inside of Approval Group, does not create a new group if the selected group already exists") and `#rdInsertGroup` ("Create a new
// approval group, shifting other approval groups upward if necessary"). Two throw-away workflows share the preset [test user group 1, MBUser3 group 2]:
//   Add MBUser4 to group 1 with "Add to Group"  -> group 1 = test user + MBUser4, group 2 = MBUser3 (no new group)
//   Add MBUser5 at group 1 with "Insert Group"  -> MBUser5 becomes the NEW group 1; the old groups shift to 2 and 3
// The Steps tab of the Detail dialog (User / Group / Department / Action) proves each result. Everything is closed and the preset deleted at the end.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

test('Edit Workflows: Add User > Add to Group (inside a group vs insert a new group)', async ({ page }) => {
  test.setTimeout(1_200_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: Record<string, string> = {};
  let f: Frame = await wf.openWorkflowManagement(page);

  const openEdit = async (): Promise<Frame> => {
    f = await wf.showNewestFirst(page);
    for (const key of ['A', 'B']) await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids[key] }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await page.waitForTimeout(1500);
    await f.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actWfEdit').click({ force: true });
    await page.waitForTimeout(5000);
    const ef = wf.lastFrame(page, 'WorkflowManagement/Edit');
    await expect(ef.locator('body')).toContainText('2 Workflows Selected', { timeout: 15_000 });
    return ef;
  };
  const pickUser = async (ef: Frame, select: string, prefix: string) => {
    const opt = (await ef.locator(`${select} option`).allInnerTexts()).map((t) => t.trim()).find((t) => t.toLowerCase().startsWith(prefix.toLowerCase()));
    expect(opt, `${prefix} in ${select}`).toBeTruthy();
    await ef.locator(select).selectOption({ label: opt! });
  };
  const jobText = async (): Promise<string> => {
    let text = '';
    for (let i = 0; i < 30; i++) {
      await page.waitForTimeout(2500);
      text = (await wf.lastFrame(page, 'WorkflowManagement').locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/Status Completed/.test(text)) break;
    }
    console.log(`edit job: ${text.slice(0, 420)}`);
    return text;
  };
  /** Steps tab of workflow A: [{user, group}] in the order listed. */
  const stepsOfA = async (): Promise<Array<{ user: string; group: number }>> => {
    f = await wf.showNewestFirst(page);
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: ids.A }).getByText('Detail').click({ timeout: 10_000 });
    await page.waitForTimeout(3500);
    await f.locator('.ui-dialog:visible .ui-tabs-nav li').filter({ hasText: 'Steps' }).click();
    await page.waitForTimeout(1500);
    const rows = (await f.locator('.ui-dialog:visible table tr').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim()).filter(Boolean);
    await f.locator('.ui-dialog:visible .ui-dialog-titlebar-close').last().click({ timeout: 5000 });
    await page.waitForTimeout(800);
    const from = rows.findIndex((r) => r.startsWith('User Group Department'));
    const to = rows.findIndex((r) => r.startsWith('User Attach'));
    const stepRows = rows.slice(from + 1, to < 0 ? undefined : to);
    console.log(`steps of A: ${JSON.stringify(stepRows)}`);
    return stepRows.map((r) => {
      const m = r.match(/^(\S+) (\d+) /);
      return { user: m![1].toLowerCase(), group: Number(m![2]) };
    });
  };
  const addToGroup = async (user: string, group: number, mode: 'add' | 'insert') => {
    const ef = await openEdit();
    await ef.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await ef.getByText('Add User', { exact: true }).hover();
    await page.waitForTimeout(800);
    await ef.locator('#lnkAddToGroup').click({ timeout: 5000 });
    await page.waitForTimeout(1500);
    console.log(`Add to Group form: ${(await ef.locator('#dvMainEdit').innerText()).replace(/\s+/g, ' ').slice(0, 160)} | group field enabled=${await ef.locator('#txtApprovalGroup').isEnabled()} value=${await ef.locator('#txtApprovalGroup').inputValue()}`);
    await pickUser(ef, '#dvMainEdit #drpUser', `${user} (`);
    await ef.locator('#txtApprovalGroup').fill(String(group));
    await ef.locator(mode === 'add' ? 'label[for="rdAddToGroup"]' : 'label[for="rdInsertGroup"]').click();
    await ef.locator('#btCreateStep').click({ timeout: 5000 });
    expect(await jobText()).toMatch(/Status Completed/);
  };

  try {
    await test.step('setup: preset [test user group 1, MBUser3 group 2] and workflows A and B', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPresetWithSteps(page, pf, preset, [{ user: `${USERNAME} (`, group: 1 }, { user: 'MBUser3 (', group: 2 }]);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
      ids.A = await wf.createWorkflow(page, preset, `PW addgroup A ${stamp}`, 'Add to group test A');
      ids.B = await wf.createWorkflow(page, preset, `PW addgroup B ${stamp}`, 'Add to group test B');
      const steps = await stepsOfA();
      expect(steps).toEqual([{ user: USERNAME.toLowerCase(), group: 1 }, { user: 'mbuser3', group: 2 }]);
    });

    await test.step('Add to Group (inside group 1): MBUser4 joins group 1, no new group is created', async () => {
      await addToGroup('MBUser4', 1, 'add');
      const steps = await stepsOfA();
      expect(steps.filter((s) => s.group === 1).map((s) => s.user).sort()).toEqual([USERNAME.toLowerCase(), 'mbuser4'].sort());
      expect(steps.filter((s) => s.group === 2).map((s) => s.user)).toEqual(['mbuser3']);
      expect(Math.max(...steps.map((s) => s.group))).toBe(2);
    });

    await test.step('Insert Group at 1: MBUser5 becomes the NEW group 1 and the old groups shift up', async () => {
      await addToGroup('MBUser5', 1, 'insert');
      const steps = await stepsOfA();
      expect(steps.filter((s) => s.group === 1).map((s) => s.user)).toEqual(['mbuser5']);
      expect(steps.filter((s) => s.group === 2).map((s) => s.user).sort()).toEqual([USERNAME.toLowerCase(), 'mbuser4'].sort());
      expect(steps.filter((s) => s.group === 3).map((s) => s.user)).toEqual(['mbuser3']);
    });
  } finally {
    await test.step('cleanup: remove MBUser3 / 4 / 5 from both workflows, vote them closed, delete the preset', async () => {
      try {
        for (const user of ['MBUser3', 'MBUser4', 'MBUser5']) {
          const ef = await openEdit();
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
        f = await wf.showNewestFirst(page, 'Open Only');
        const open = f.locator('#gridResults tr.jqgrow').filter({ hasText: /PW addgroup [AB] / }).filter({ hasText: stamp });
        const n = await open.count();
        if (n > 0) {
          for (let i = 0; i < n; i++) await open.nth(i).locator('input[type=checkbox]').check({ timeout: 10_000 });
          await page.waitForTimeout(1000);
          await wf.voteTickedWorkflows(page, f, Array(n).fill('reject') as Array<'reject'>, USERNAME, PASSWORD);
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
