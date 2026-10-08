// Workflow Summary Report (live 2026-10-05, Claude01): Workflow Management > tick workflows > Bulk Actions > Report (`#actWfReport`, process
// WF_Generate_Report) opens the dialog "Workflow Summary Report": Subdirectory `#txtSubdir` (required: blank shows "Required" in red), "Merge selected
// workflows into a single report?" `#chkMergedReport` (checked by default; unchecked = one PDF per workflow), Cancel / Submit. Submit posts to the InnoTasc
// service (`/WFReportSummary/CreatePDFs`) and the result dialog says "Your report has been created: \\<server>\Network\SignatureReport\<subdirectory>".
// The PDFs are then read from that share (reachable from the test machine): merged -> `WorkflowReport_Merged_<yyyymmdd>.pdf`, separate -> one PDF per workflow.
// Two throw-away workflows (closed again at the end) and a throw-away preset (deleted). The report folders on the share are left behind (PWReport<stamp>*).

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import { login, USERNAME, PASSWORD } from '../support/robar';
import * as wf from '../support/workflow';

test.use({ actionTimeout: 20_000 });

test('workflow summary report: required subdirectory, merged PDF and one PDF per workflow on the report share', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const stamp = Date.now().toString().slice(-6);
  const preset = `MBPWFlow${stamp}`;
  const ids: string[] = [];
  let f: Frame = await wf.openWorkflowManagement(page);

  /** Ticks both workflows and opens Bulk Actions > Report; returns after the dialog is visible. */
  const openReport = async () => {
    f = await wf.showNewestFirst(page);
    for (const id of ids) await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await page.waitForTimeout(1000);
    await f.locator('#drpActions').click();
    await page.waitForTimeout(500);
    await f.locator('#actWfReport').click({ force: true });
    await expect(f.locator('.ui-dialog:visible .ui-dialog-title')).toHaveText('Workflow Summary Report', { timeout: 10_000 });
  };
  const submit = () => f.locator('.ui-dialog:visible button').filter({ hasText: /^Submit$/ }).click();
  /** Submit with `subdir`, merged on/off; returns the folder path from the result dialog. */
  const generate = async (subdir: string, merged: boolean): Promise<string> => {
    await openReport();
    await f.locator('#txtSubdir').fill(subdir);
    await f.locator('#chkMergedReport').setChecked(merged);
    await submit();
    await expect(f.locator('.ui-dialog:visible')).toContainText('Your report has been created:', { timeout: 60_000 });
    const text = await wf.dialogText(f);
    console.log(`report dialog (merged=${merged}): ${text}`);
    const m = text.match(/created:\s*(\\\\\S+)/);
    expect(m, 'a share path in the dialog').toBeTruthy();
    await wf.dialogButton(f, /^OK$/);
    return m![1];
  };

  try {
    await test.step('setup: preset (one step for the test user) and two workflows', async () => {
      const pf = await wf.openPresetManagement(page, f);
      for (const old of (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim()).filter((t) => /^MBPW(Flow|Preset)/.test(t))) await wf.deletePreset(pf, old);
      await wf.createPreset(page, pf, preset, [`${USERNAME} (`]);
      await pf.getByText('Workflow Management').first().click();
      await page.waitForTimeout(3500);
      ids.push(await wf.createWorkflow(page, preset, `PW report A ${stamp}`, 'Report test A'));
      ids.push(await wf.createWorkflow(page, preset, `PW report B ${stamp}`, 'Report test B'));
      console.log(`created ${ids.join(' ')}`);
    });

    await test.step('the dialog: Subdirectory + Merge checkbox (checked by default), Cancel/Submit; a blank subdirectory shows "Required"; Cancel creates nothing', async () => {
      await openReport();
      expect(await f.locator('#txtSubdir').inputValue()).toBe('');
      expect(await f.locator('#chkMergedReport').isChecked(), 'merge is on by default').toBe(true);
      expect(await wf.dialogText(f)).toContain('Leave this box unchecked to generate a separate pdf report for each individual workflow.');
      await submit();
      await page.waitForTimeout(1000);
      expect(await f.locator('#txtSubdirVal').innerText()).toContain('Required');
      await wf.dialogButton(f, /^Cancel$/);
      await page.waitForTimeout(500);
      await expect(f.locator('.ui-dialog:visible')).toHaveCount(0);
    });

    await test.step('merged: one WorkflowReport_Merged_<date>.pdf in the chosen subdirectory', async () => {
      const dir = await generate(`PWReport${stamp}M`, true);
      expect(dir).toMatch(new RegExp(`Network\\\\SignatureReport\\\\PWReport${stamp}M$`, 'i'));
      const files = fs.readdirSync(dir);
      console.log(`merged files: ${JSON.stringify(files)}`);
      expect(files.length).toBe(1);
      expect(files[0]).toMatch(/^WorkflowReport_Merged_\d{8}\.pdf$/);
      const bytes = fs.readFileSync(`${dir}\\${files[0]}`);
      expect(bytes.subarray(0, 5).toString()).toBe('%PDF-');
      expect(bytes.length).toBeGreaterThan(1000);
    });

    await test.step('not merged: one PDF per workflow', async () => {
      const dir = await generate(`PWReport${stamp}S`, false);
      const files = fs.readdirSync(dir).sort();
      console.log(`separate files: ${JSON.stringify(files)}`);
      expect(files.length).toBe(2);
      for (const name of files) {
        expect(name).toMatch(/\.pdf$/i);
        expect(fs.readFileSync(`${dir}\\${name}`).subarray(0, 5).toString()).toBe('%PDF-');
      }
      for (const id of ids) expect(files.some((n) => n.includes(id)), `a PDF named after ${id}`).toBe(true);
    });
  } finally {
    await test.step('cleanup: close the two workflows (reject) and delete the throw-away preset', async () => {
      f = await wf.showNewestFirst(page, 'Open Only');
      const mine = f.locator('#gridResults tr.jqgrow').filter({ hasText: `PW report` }).filter({ hasText: stamp });
      const n = await mine.count();
      if (n > 0) {
        for (let i = 0; i < n; i++) await mine.nth(i).locator('input[type=checkbox]').check({ timeout: 10_000 });
        await page.waitForTimeout(1000);
        await wf.voteTickedWorkflows(page, f, Array(n).fill('reject') as Array<'reject'>, USERNAME, PASSWORD).catch(() => '');
      }
      f = await wf.openWorkflowManagement(page);
      const pf = await wf.openPresetManagement(page, f);
      await wf.deletePreset(pf, preset).catch(() => {});
    });
  }
});
