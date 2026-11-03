// Part 2 of the WM_ExportToExcel-18.1 dry-run data: submit TMP2/TMP3 to workflow (PRESET1) and read all four workflow ids.
import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import { login, openMenuItem, findFrame, BASE_URL } from '../support/robar';
import * as wf from '../support/workflow';

const OUT = 'test-data/dryrun-wm-export.json';
const state = JSON.parse(fs.readFileSync(OUT, 'utf8'));
const save = () => fs.writeFileSync(OUT, JSON.stringify(state, null, 1));

test('submit TMP2/TMP3 to workflow and read WF1-WF4 ids', async ({ page }) => {
  test.setTimeout(600_000);
  await login(page);
  setInterval(() => { page.evaluate(() => { const w = window as any; if (typeof w.RefreshTimeout === 'function') w.RefreshTimeout(); }).catch(() => {}); }, 45_000);
  if (!state.templatesSent) {
    await openMenuItem(page, 'Template Management');
    let t = await findFrame(page, 'TemplateManagement');
    await t.locator('#btnRetrieveData').waitFor({ timeout: 20_000 });
    await t.click('#btnReset', { timeout: 5000 }); await page.waitForTimeout(2000);
    t = await findFrame(page, 'TemplateManagement');
    if (await t.locator('#chkFilterByDataSource').isChecked().catch(() => false)) await t.locator('#chkFilterByDataSource').uncheck();
    await t.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await t.locator('select[name="dvFilters[0].Column"]').selectOption('LabelName', { timeout: 5000 });
    await t.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: 'In' }, { timeout: 5000 });
    await t.locator('input[name="dvFilters[0].Value"]').fill(`${state.TMP2},${state.TMP3}`, { timeout: 5000 });
    await t.selectOption('#drpApprove', { label: 'Approved and Unapproved' }).catch(() => {});
    await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), t.click('#btnRetrieveData')]);
    await page.waitForTimeout(2500);
    await expect(t.locator('#grdJqGrid tr.jqgrow')).toHaveCount(2);
    for (const name of [state.TMP2, state.TMP3]) {
      await Promise.all([
        page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
        t.locator('#grdJqGrid tr.jqgrow').filter({ hasText: name }).locator('input[type="checkbox"]').check(),
      ]);
      await page.waitForTimeout(500);
    }
    await t.getByText('Bulk Actions', { exact: true }).click(); await page.waitForTimeout(500);
    await t.getByText('Submit to Workflow', { exact: true }).click();
    await t.getByRole('heading', { name: 'Submit to Workflow' }).waitFor({ state: 'visible', timeout: 15_000 });
    await t.fill('#txtJobDescription', 'Dry run TMP2 TMP3 workflows');
    await t.fill('#txtComment', 'Templates sent to workflow (dry run)');
    await t.locator('#txtComment').press('Tab');
    await Promise.all([page.waitForResponse((r) => r.url().includes('GetWorkflowSteps'), { timeout: 10_000 }).catch(() => null), t.selectOption('#drpPreset', { label: state.PRESET1 })]);
    await page.waitForTimeout(800);
    await expect(t.locator('#btnSubmit')).toBeEnabled({ timeout: 10_000 });
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('SubmitJob') && r.request().method() === 'POST', { timeout: 15_000 }), t.locator('#btnSubmit').click()]);
    expect((await response.json()).Success).toBe(true);
    let text = '';
    for (let i = 0; i < 20; i++) { text = (await t.locator('body').innerText()).replace(/\s+/g, ' '); if (/Status Completed/.test(text)) break; await page.waitForTimeout(2500); }
    expect(text).toContain('Status Completed');
    state.templatesSent = true; save();
  }
  await page.goto(BASE_URL); await page.waitForTimeout(2500);
  const f = await wf.showNewestFirst(page);
  const rows = (await f.locator('#gridResults tr.jqgrow').allInnerTexts()).map((r) => r.replace(/\s+/g, ' ').trim());
  const find = (needle: string) => (rows.find((r) => r.includes(needle)) ?? '').match(/^(\d{8}-\d{4})(.*)$/);
  for (const [k, needle] of [['WF1', state.ITM1], ['WF2', state.ITM2], ['WF3', state.TMP2], ['WF4', state.TMP3]] as const) {
    const m = find(needle); state[k] = m?.[1]; state[k + 'row'] = m?.[0];
  }
  save();
  console.log(JSON.stringify(state, null, 1));
  for (const k of ['WF1', 'WF2', 'WF3', 'WF4']) expect(state[k], k).toBeTruthy();
});
