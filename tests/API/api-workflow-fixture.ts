// "An item that is being routed in a workflow" for the API specs (Items F.2.9, Master Data "item in workflow"): the API decides this from ONE database flag, Items.DocumentOwner = 'Workflow' (any version of the
// item number). ensureWorkflowItem() first LOOKS for a CL / MB item that is already in a workflow (read-only SQL; items of other specs such as WM* / WF* are never used as the target of a write attempt) and only when
// there is none, creates the fixture item CLAPIWFItem01 (through the API, supplied by the caller) and sends it to a workflow through Campaign Manager > Send to Workflow, once. The workflow is never voted, so the
// item stays locked for good: later runs only do the SQL lookup. Items, workflows and presets cannot be deleted; this leaves one of each behind.
import type { Browser } from '@playwright/test';
import { expect } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, BASE_URL } from '../support/robar';
import * as cm from '../support/campaign-manager';
import * as wf from '../support/workflow';
import { lit, sql, note } from './api-support';
import { LT_MAIN, LT_SECOND } from './api-fixtures';

export const WF_ITEM = 'CLAPIWFItem01';
/** Does not match the /^(MB|CL)PW(Flow|Preset)/ clean-up of the other workflow specs, so they leave it alone. */
export const WF_PRESET = 'CLAPIWFPreset01';

export interface WorkflowItem { itemNumber: string; labelType: string; versionNumber: number; source: 'existing' | 'fixture' }

/** CL / MB items (in a label type the API group may use) that are routed in a workflow right now. Read only. */
export function findWorkflowItems(): Array<{ ItemNumber: string; LabelType: string; VersionNumber: number }> {
  return sql(
    `select ItemNumber, LabelType, VersionNumber from Items where DocumentOwner = 'Workflow' and (ItemNumber like 'CL%' or ItemNumber like 'MB%') and LabelType in (${[LT_MAIN, LT_SECOND].map(lit).join(',')}) order by case when ItemNumber = ${lit(WF_ITEM)} then 0 else 1 end, ItemNumber, VersionNumber desc`,
    'CL / MB items that are routed in a workflow (Items.DocumentOwner = Workflow)',
  );
}

function ownerOf(item: string): string | undefined {
  return sql<{ DocumentOwner: string }>(`select top 1 DocumentOwner from Items where ItemNumber = ${lit(item)} order by VersionNumber desc`, `DocumentOwner of ${item}`)[0]?.DocumentOwner;
}

/**
 * Returns an item that is in a workflow, creating the fixture when none exists. `createItem` must create the fixture item through the API (caller's helper) and throw if it fails.
 * Needs a browser only for the one-time Send to Workflow.
 */
export async function ensureWorkflowItem(browser: Browser, createItem: () => Promise<void>): Promise<WorkflowItem> {
  const existing = findWorkflowItems();
  if (existing.length) {
    const e = existing[0];
    return { itemNumber: e.ItemNumber, labelType: e.LabelType, versionNumber: e.VersionNumber, source: e.ItemNumber === WF_ITEM ? 'fixture' : 'existing' };
  }

  note(`no CL / MB item is in a workflow yet: creating the fixture ${WF_ITEM} and sending it to a workflow (one time)`);
  if (ownerOf(WF_ITEM) === undefined) await createItem();
  if (ownerOf(WF_ITEM) === undefined) throw new Error(`fixture item ${WF_ITEM} was not created`);

  const page = await browser.newPage();
  try {
    await login(page);
    // 1. a one-step preset for the test user (kept: presets cannot be reused after deletion by other specs' clean-up because its name does not match their pattern)
    let f = await wf.openWorkflowManagement(page);
    const pf = await wf.openPresetManagement(page, f);
    const presets = (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim());
    if (!presets.includes(WF_PRESET)) await wf.createPreset(page, pf, WF_PRESET, [`${USERNAME} (`], 'Playwright REST API fixture preset (do not delete)');

    // 2. Campaign Manager > Send to Workflow for the fixture item
    await page.goto(BASE_URL);
    await page.waitForTimeout(2500);
    await openMenuItem(page, 'Campaign Manager');
    const grid = await findFrame(page, 'campaignmanager');
    await page.waitForTimeout(1500);
    await cm.retrieveAndSelectItem(page, grid, WF_ITEM);
    await cm.startBulkAction(page, grid, 'WorkFlowSendTo');
    await grid.fill('#txtDescription', `Playwright REST API fixture ${WF_ITEM}`);
    await grid.fill('#txtComments', 'Fixture for the API specs: stays open on purpose (do not vote)');
    await Promise.all([page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/GetWorkflowSteps'), { timeout: 10_000 }), grid.selectOption('#drpPreset', { label: WF_PRESET })]);
    const [response] = await Promise.all([page.waitForResponse((r) => r.url().includes('/WorkFlowSendTo/SubmitJob'), { timeout: 15_000 }), grid.click('#btnSubmit')]);
    expect((await response.json()).Success, 'SubmitJob').toBe(true);
    // the job runs asynchronously: wait for Completed on the Job Detail page
    let text = '';
    for (let i = 0; i < 24; i++) {
      await page.waitForTimeout(2500);
      const jf = page.frames().filter((x) => x.url().includes('CampaignManager/JobDetail')).pop() ?? grid;
      text = (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
      if (/Status Completed/.test(text)) break;
    }
    expect(text, 'the Send to Workflow job').toContain('Status Completed');
    expect(text).toContain(WF_ITEM);
  } finally {
    await page.close();
  }

  const after = findWorkflowItems();
  if (!after.length) throw new Error(`${WF_ITEM} is still not routed in a workflow (DocumentOwner = ${ownerOf(WF_ITEM)})`);
  return { itemNumber: after[0].ItemNumber, labelType: after[0].LabelType, versionNumber: after[0].VersionNumber, source: 'fixture' };
}
