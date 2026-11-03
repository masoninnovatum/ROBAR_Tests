// Dry-run data setup for formal script WM_ExportToExcel-18.1 on VAL703 (2026-10-27). Run with ROBAR_BASE_URL=http://vmsrvval703/innovatum/WebMenu/
// Builds PRESET1 (one step: Claude01), ITM1/ITM2 (template A1Template) each sent to a workflow (WF1/WF2), TMP2/TMP3 (new unapproved
// templates, no BarTender editor opened) submitted to workflows (WF3/WF4). Writes the real ids to test-data/dryrun-wm-export.json.
// The e-signature vote that approves WF2 is NOT automated (left to the tester).
import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as fs from 'fs';
import { login, openMenuItem, findFrame, BASE_URL, USERNAME } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as wf from '../support/workflow';
import { resolveBtwFile } from '../support/templates';

const OUT = 'test-data/dryrun-wm-export.json';
const state: Record<string, any> = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : {};
const save = () => fs.writeFileSync(OUT, JSON.stringify(state, null, 1));

test('build WM_ExportToExcel-18.1 data', async ({ page }) => {
  test.setTimeout(900_000);
  await login(page);
  const keepAlive = setInterval(() => { page.evaluate(() => { const w = window as unknown as { RefreshTimeout?: () => void }; if (typeof w.RefreshTimeout === "function") w.RefreshTimeout(); }).catch(() => {}); }, 45_000);
  const stamp = (state.stamp ??= Date.now().toString().slice(-6)); save();
  const preset = (state.PRESET1 ??= `CLExpPre${stamp}`);
  let f: Frame;

  if (!state.presetDone) {
    f = await wf.openWorkflowManagement(page);
    const pf = await wf.openPresetManagement(page, f);
    await wf.createPreset(page, pf, preset, [`${USERNAME} (`], 'Dry run PRESET1');
    state.presetDone = true; save();
  }

  for (const [key, tag] of [['ITM1', 'A'], ['ITM2', 'B']] as const) {
    if (state[key + 'Sent']) continue;
    await page.goto(BASE_URL); await page.waitForTimeout(2500);
    await openMenuItem(page, 'Campaign Manager');
    const cmFrame = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1500);
    const itemNumber = state[key] ?? `CLExpItm${tag}${stamp}`;
    let editFrame: Frame;
    if (state[key]) { editFrame = cmFrame; } else {
    await cmFrame.click('#btnCreateNew');
    await cmFrame.waitForSelector('#txtItemNumber', { state: 'visible' });
    await cmFrame.fill('#txtItemNumber', itemNumber);
    await cmFrame.selectOption('#ddlLabelType', 'Carton Label');
    await cmFrame.click('.ui-dialog-buttonpane button:has-text("Submit")');
    editFrame = await findFrame(page, 'items/edit');
    await editFrame.waitForLoadState('networkidle').catch(() => {});
    await page.waitForTimeout(500);
    await editFrame.selectOption('select[name="txtTemplateName"]', 'A1Template');
    await editFrame.fill('input[name="txtDescription"]', `Dry run ${key}`);
    await editFrame.click('button:has-text("Save")');
    await page.waitForTimeout(1500);
    state[key] = itemNumber; save();
    }
    const grid = state[key + "grid"] ? cmFrame : (state[key] && editFrame === cmFrame ? cmFrame : await cm.backToGrid(page, editFrame));
    await cm.retrieveAndSelectItem(page, grid, itemNumber);
    await cm.startBulkAction(page, grid, 'WorkFlowSendTo');
    await grid.fill('#txtDescription', `Dry run ${key} workflow`);
    await grid.fill('#txtComments', `${key} sent to workflow (dry run)`);
    await Promise.all([page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/GetWorkflowSteps'), { timeout: 10_000 }), grid.selectOption('#drpPreset', { label: preset })]);
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/SubmitJob'), { timeout: 15_000 }), grid.click('#btnSubmit')]);
    expect((await response.json()).Success).toBe(true);
    let text = '';
    for (let i = 0; i < 20; i++) {
      await page.waitForTimeout(2500);
      const jf = page.frames().filter((x) => x.url().includes('CampaignManager/JobDetail')).pop() ?? grid;
      text = (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/Status Completed/.test(text)) break;
    }
    expect(text).toContain('Status Completed');
    state[key + 'Sent'] = true; save();
  }

  if (!state.TMP2) {
    await page.goto(BASE_URL); await page.waitForTimeout(2500);
    await openMenuItem(page, 'Template Management');
    const tm = await findFrame(page, 'TemplateManagement');
    for (const key of ['TMP2', 'TMP3']) {
      const name = `CLExpTmp${key.slice(3)}${stamp}`;
      await tm.click('#drpMainActions'); await page.waitForTimeout(500);
      await tm.click('#actCreateTemplate', { force: true }); await page.waitForTimeout(1000);
      await tm.fill('#txtTemplateName', name);
      await tm.fill('#txtDescription', `Dry run ${key}`);
      await tm.selectOption('#ddlLabelType', { value: 'Carton Label' });
      await tm.setInputFiles('#newFileInput', resolveBtwFile());
      await page.waitForTimeout(500);
      const [createResponse] = await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
        tm.locator('button:has-text("Submit"):visible').first().click({ force: true }),
      ]);
      expect((await createResponse.json()).Success).toBe(true);
      state[key] = name; save();
      await page.waitForTimeout(2000);
    }
  }
});
