// Workflow Management helpers (live-confirmed 2026-10-05). Pages (all inside the one Workflow Management tab, same iframe):
//   Management            `InnoPages/WorkflowManagement/Management`      -- search grid `#gridResults`, Actions + Bulk Actions
//   PresetManagement      `.../PresetManagement`                         -- presets and their steps
//   SendToWorkflowJobSubmission?jobId=<guid>  (Actions > Create New Workflow, and Campaign Manager / Template Management
//                                              "Send to Workflow") -- Job Description, Workflow Comments, Preset, steps, attachments
// Presets can be created AND deleted, so tests create throw-away `MBPW...` presets and delete them again. Workflows cannot be
// deleted (a test leaves its closed workflow behind).

import type { Frame, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { openMenuItem, findFrame } from './robar';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Condition-based replacement for the old fixed sleeps (2026-10-16, the module took 90 min of the full run, mostly in fixed waits of 1-9 s after every click): polls every 150 ms for the NEWEST frame whose
 * URL contains `part` and in which `selector` is visible (a page that navigated inside the same tab can leave the old frame listed, so newest-first and "visible" together avoid stale frames).
 */
export async function frameWhere(page: Page, part: string, selector: string, timeout = 20_000): Promise<Frame> {
  const t0 = Date.now();
  while (Date.now() - t0 < timeout) {
    const frames = page.frames().filter((x) => x.url().toLowerCase().includes(part.toLowerCase())); // case-insensitive like findFrame (the Preset page's URL is not cased like the menu name)
    for (let i = frames.length - 1; i >= 0; i--) {
      if (await frames[i].locator(selector).first().isVisible().catch(() => false)) return frames[i];
    }
    await delay(150);
  }
  throw new Error(`no frame with "${part}" showing ${selector} within ${timeout} ms`);
}

/** The frame has finished its network activity (capped: some pages poll forever) plus a short settle for knockout bindings. */
async function settle(f: Frame, cap = 4000): Promise<void> {
  await f.waitForLoadState('networkidle', { timeout: cap }).catch(() => {});
  await delay(250);
}

/** Opens (or re-opens) the Workflow Management Management page and returns its frame. */
export async function openWorkflowManagement(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Workflow Management');
  const f = await findFrame(page, 'WorkflowManagement');
  await f.locator('#btGetWorkflows').waitFor({ timeout: 20_000 });
  await settle(f);
  return f;
}

/**
 * Reset (clears the persisted criteria row -- the page re-applies the last search), "Any User", optional Open/Closed filter
 * (`status` = 'Open Only' | 'Closed Only', lives in the collapsed Advanced Options), then the grid sorted by Workflow ID
 * DESCENDING (the default order is ascending) so brand-new workflows are on page 1. Returns the Management frame.
 */
export async function showNewestFirst(page: Page, status?: string): Promise<Frame> {
  let f = await openWorkflowManagement(page);
  // Reset reloads the page: mark the OLD document first so the new one is recognised (the old frame is still visible for a moment and would otherwise be taken for the reloaded page)
  await f.evaluate(() => { (window as unknown as { __pwOld?: boolean }).__pwOld = true; });
  await f.click('#btCancel', { timeout: 5000 });
  for (let i = 0; i < 200; i++) {
    const fresh = page.frames().filter((x) => x.url().toLowerCase().includes('workflowmanagement/management'));
    const cand = fresh[fresh.length - 1];
    if (cand && (await cand.locator('#btGetWorkflows').isVisible().catch(() => false)) && !(await cand.evaluate(() => (window as unknown as { __pwOld?: boolean }).__pwOld === true).catch(() => true))) { f = cand; break; }
    await delay(150);
  }
  f = lastFrame(page, 'WorkflowManagement/Management');
  await settle(f, 3000);
  await f.locator('#drpUser').selectOption({ label: 'Any User' });
  if (status) {
    if (!(await f.locator('#drpApproved').isVisible())) {
      await f.locator('#btAdvanced').click({ timeout: 5000 });
      await f.locator('#drpApproved').waitFor({ state: 'visible', timeout: 5000 });
    }
    await f.locator('#drpApproved').selectOption({ label: status }, { timeout: 5000 });
  }
  await f.click('#btGetWorkflows');
  await f.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 20_000 });
  await settle(f, 2500);
  for (let i = 0; i < 3; i++) {
    const idsOf = async () => (await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts()).map((t) => t.trim());
    const col = await idsOf();
    if (col.length < 2 || col[0] >= col[col.length - 1]) break;
    await f.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
    // wait until the grid shows the new order (first id now the largest) instead of a fixed 2.5 s
    for (let w = 0; w < 30; w++) {
      const now = await idsOf();
      if (now.length >= 2 && now[0] >= now[now.length - 1]) break;
      await delay(150);
    }
    await delay(300);
  }
  return f;
}

/**
 * Management page > Actions > Create New Workflow with `preset`, Submit Job; returns the new Workflow Id ("YYYYMMDD-NNNN") and
 * leaves the browser back on the Management page (frame re-resolved by the caller with lastFrame).
 */
export async function createWorkflow(page: Page, preset: string, description: string, comment: string): Promise<string> {
  let f = lastFrame(page, 'WorkflowManagement/Management');
  await f.locator('#drpMainActions').click();
  await delay(500); // the drop-down menu needs a moment before its items react to clicks (a click right after opening it is ignored)
  await f.locator('#actCreateWorflow').waitFor({ state: 'visible', timeout: 5000 });
  await f.locator('#actCreateWorflow').click({ force: true });
  f = await frameWhere(page, 'SendToWorkflowJobSubmission', '#txtJobDescription');
  await settle(f, 3000);
  await f.locator('#txtJobDescription').fill(description);
  await f.locator('#txtComment').fill(comment);
  await f.locator('#txtComment').press('Tab');
  await f.locator('#drpPreset').selectOption({ label: preset });
  await settle(f, 4000); // the preset's steps load through ajax
  await f.locator('#txtComment').press('Tab');
  await expect(f.locator('#btnFormSubmit')).toBeEnabled({ timeout: 8000 });
  await f.locator('#btnFormSubmit').click();
  let jf = await frameWhere(page, 'WFJobDetail', 'body', 30_000);
  let text = '';
  for (let i = 0; i < 40; i++) {
    text = (await jf.locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (/Status Completed/.test(text) && /Workflow Id:\s*\d/.test(text)) break;
    await delay(1000);
    jf = lastFrame(page, 'WFJobDetail');
  }
  const id = (text.match(/Workflow Id:\s*(\d{8}-\d{4})/) ?? [])[1];
  expect(id, 'a Workflow Id like YYYYMMDD-NNNN').toBeTruthy();
  await jf.getByText('Workflow Management').first().click();
  await frameWhere(page, 'WorkflowManagement/Management', '#btGetWorkflows', 30_000);
  await delay(500);
  return id;
}

/**
 * With the workflow rows already ticked in `f`: Bulk Actions > View And Vote, vote each row (`votes[i]` = 'approve' | 'reject',
 * in grid order of the vote page), sign with the given credentials and wait for the job to complete. Returns the job text.
 */
export type VoteKind = 'approve' | 'reject' | 'approveForDept' | 'rejectForDept' | 'approveVeto' | 'rejectVeto';

export async function voteTickedWorkflows(page: Page, f: Frame, votes: VoteKind[], user: string, password: string, comment = 'Voted by Playwright'): Promise<string> {
  await f.locator('#drpActions').click();
  await delay(500); // the drop-down menu needs a moment before its items react to clicks (a click right after opening it is ignored)
  await f.locator('#actViewAndVote').waitFor({ state: 'visible', timeout: 5000 });
  await f.locator('#actViewAndVote').click({ force: true });
  const vf = await frameWhere(page, 'WFViewAndVote/JobSubmission', 'table.ui-jqgrid-btable tr.jqgrow', 30_000);
  const voteRows = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
  await expect(voteRows).toHaveCount(votes.length);
  // checkbox order per row: [Approve, Reject, Vote For Dept, Veto]; "Vote For Dept" is enabled only for a step with "Vote For Entire Group", Veto only for a veto step
  for (let i = 0; i < votes.length; i++) {
    const boxes = voteRows.nth(i).locator('input[type=checkbox]');
    const v = votes[i];
    await boxes.nth(v.startsWith('approve') ? 0 : 1).check();
    if (v.endsWith('ForDept')) await boxes.nth(2).check();
    if (v.endsWith('Veto')) await boxes.nth(3).check();
  }
  await vf.locator('#btnUpdate').click();
  await vf.locator('#jobDescription').waitFor({ state: 'visible', timeout: 10_000 });
  await vf.locator('#jobDescription').fill('PW vote');
  await vf.locator('#UserID').fill(user);
  await vf.locator('#Password').fill(password);
  await vf.locator('#Reason').selectOption({ label: 'General' });
  await vf.locator('#Comment').fill(comment);
  await vf.locator('#Password').press('Tab');
  await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
  let text = '';
  for (let i = 0; i < 90; i++) {
    const frames = page.frames().filter((x) => x.url().includes('WFViewAndVote/JobDetail'));
    if (frames.length) text = (await frames[frames.length - 1].locator('body').innerText().catch(() => '')).replace(/\s+/g, ' ');
    if (/Status Completed/.test(text)) break;
    await delay(1000);
  }
  return text;
}

/**
 * Closes ONE open workflow the signed-in test user can vote: opens View And Vote for it, ticks Reject on every ENABLED row and signs. A workflow whose steps are all voted (e.g. after
 * the last open step was deleted with Edit Workflows -- it then stays Open with nothing votable) first gets a new step for `user` (Edit Workflows > Add User > at End).
 * Returns false when nothing is votable by this user (the open steps belong to other users).
 */
export async function closeWorkflow(page: Page, id: string, user: string, password: string): Promise<boolean> {
  const openVotePage = async (): Promise<{ vf: Frame; enabled: number; rows: string[] }> => {
    const f = await showNewestFirst(page, 'Open Only');
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await delay(300);
    await f.locator('#drpActions').click();
    await delay(500); // the drop-down menu needs a moment before its items react to clicks (a click right after opening it is ignored)
  await f.locator('#actViewAndVote').waitFor({ state: 'visible', timeout: 5000 });
    await f.locator('#actViewAndVote').click({ force: true });
    const vf = await frameWhere(page, 'WFViewAndVote/JobSubmission', 'body', 30_000);
    await vf.locator('table.ui-jqgrid-btable tr.jqgrow').first().waitFor({ timeout: 8000 }).catch(() => {}); // a workflow with nothing to vote shows no rows: not an error here
    await settle(vf, 3000);
    const rows = (await vf.locator('table.ui-jqgrid-btable tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const enabled = await vf.locator('table.ui-jqgrid-btable tr.jqgrow').evaluateAll((trs) => trs.filter((r) => { const b = r.querySelectorAll('input[type=checkbox]')[1] as HTMLInputElement | undefined; return !!b && !b.disabled; }).length);
    return { vf, enabled, rows };
  };
  let { vf, enabled, rows } = await openVotePage();
  if (enabled === 0 && rows.length > 0 && rows.every((r) => /Approved|Rejected/.test(r))) {
    const f = await showNewestFirst(page, 'Open Only');
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await delay(300);
    await f.locator('#drpActions').click();
    await delay(500); // the drop-down menu needs a moment before its items react to clicks (a click right after opening it is ignored)
  await f.locator('#actWfEdit').waitFor({ state: 'visible', timeout: 5000 });
    await f.locator('#actWfEdit').click({ force: true });
    const ef = await frameWhere(page, 'WorkflowManagement/Edit', '#drpActions', 30_000);
    await settle(ef, 3000);
    await ef.locator('#drpActions').click();
    await ef.getByText('Add User', { exact: true }).waitFor({ state: 'visible', timeout: 5000 });
    await ef.getByText('Add User', { exact: true }).hover();
    await ef.locator('#lnkAddToEnd').waitFor({ state: 'visible', timeout: 5000 });
    await ef.locator('#lnkAddToEnd').click({ timeout: 5000 });
    await ef.locator('#dvMainEdit #drpUser').waitFor({ state: 'visible', timeout: 8000 });
    const opt = (await ef.locator('#dvMainEdit #drpUser option').allInnerTexts()).map((t) => t.trim()).find((t) => t.toLowerCase().startsWith(`${user.toLowerCase()} (`));
    await ef.locator('#dvMainEdit #drpUser').selectOption({ label: opt! });
    await ef.locator('#btCreateStep').click();
    await ef.locator('#dvMainEdit #drpUser').waitFor({ state: 'hidden', timeout: 20_000 }).catch(() => {}); // the add-step panel closes once the step is stored
    await settle(ef, 5000);
    await delay(1000);
    ({ vf, enabled, rows } = await openVotePage());
  }
  if (enabled === 0) return false;
  const trs = vf.locator('table.ui-jqgrid-btable tr.jqgrow');
  const n = await trs.count();
  for (let i = 0; i < n; i++) {
    const boxes = trs.nth(i).locator('input[type=checkbox]');
    if (await boxes.nth(1).isEnabled()) await boxes.nth(1).check();
  }
  await vf.locator('#btnUpdate').click();
  await vf.locator('#jobDescription').waitFor({ state: 'visible', timeout: 10_000 });
  await vf.locator('#jobDescription').fill('PW close');
  await vf.locator('#UserID').fill(user);
  await vf.locator('#Password').fill(password);
  await vf.locator('#Reason').selectOption({ label: 'General' });
  await vf.locator('#Comment').fill('closed by the test cleanup');
  await vf.locator('#Password').press('Tab');
  await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
  // wait for the close job to finish (the old code slept 8 s)
  for (let i = 0; i < 60; i++) {
    const frames = page.frames().filter((x) => x.url().includes('WFViewAndVote/JobDetail'));
    if (frames.length && /Status Completed/.test((await frames[frames.length - 1].locator('body').innerText().catch(() => '')).replace(/\s+/g, ' '))) break;
    await delay(1000);
  }
  return true;
}

/** The newest frame whose URL contains `part` (a page that navigated inside the same tab leaves the old frame listed). */
export function lastFrame(page: Page, part: string): Frame {
  const frames = page.frames().filter((x) => x.url().includes(part));
  if (frames.length === 0) throw new Error(`no frame with "${part}"`);
  return frames[frames.length - 1];
}

export async function dialogText(f: Frame): Promise<string> {
  return (await f.locator('.ui-dialog:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ');
}

/** Clicks a button of the topmost visible jQuery UI dialog. */
export async function dialogButton(f: Frame, label: RegExp | string): Promise<void> {
  const re = typeof label === 'string' ? new RegExp('^' + label + '$') : label;
  await f.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: re }).first().click({ timeout: 5000 });
  await delay(300);
}

/** Opens Preset Management from the Management page. */
export async function openPresetManagement(page: Page, f: Frame): Promise<Frame> {
  await f.locator('#drpMainActions').click();
  await delay(500); // the drop-down menu needs a moment before its items react to clicks (a click right after opening it is ignored)
  await f.locator('#actCreateWFPreset').waitFor({ state: 'visible', timeout: 5000 });
  await f.locator('#actCreateWFPreset').click({ force: true });
  const pf = await frameWhere(page, 'PresetManagement', '#ddlSelectPreset', 30_000);
  await settle(pf, 3000);
  return pf;
}

/**
 * Creates a preset with one step per entry of `stepUsers` (an option label PREFIX such as "Claude01 (" or "MBUser1 (") and
 * returns the Preset Management frame. Approval Group auto-increments per step (1, 2, ...).
 */
export interface PresetStep {
  /** option text prefix of the step user, e.g. "Claude01 (" */
  user: string;
  /** approval group number (steps of the same group are voted in parallel); default = the form's auto-incremented value (a new group) */
  group?: number;
  voteForGroup?: boolean;
  veto?: 'None' | 'Approve' | 'Reject' | 'Both';
}

/** Adds ONE step to the open preset (the LAST "Add Step" link) with the given approval group / Vote For Entire Group / veto settings. */
export async function addPresetStep(pf: Frame, step: PresetStep): Promise<void> {
  await pf.locator('#steps-container').getByText('Add Step').last().click({ timeout: 5000 });
  await pf.locator('#drpUser').waitFor({ state: 'visible', timeout: 8000 });
  const option = (await pf.locator('#drpUser option').allInnerTexts()).find((t) => t.trim().startsWith(step.user));
  if (!option) throw new Error(`no step user starting with "${step.user}"`);
  await pf.locator('#drpUser').selectOption({ label: option.trim() });
  await pf.locator('#txtDepartment').fill('QA');
  if (step.group !== undefined) await pf.locator('#txtApprovalGroup').fill(String(step.group));
  if (step.voteForGroup !== undefined) await pf.locator('#chkVoteForGroup').setChecked(step.voteForGroup);
  if (step.veto) await pf.locator('#drpVoteVeto').selectOption({ label: step.veto });
  await pf.locator('#btCreateStep').click();
  await pf.locator('#drpUser').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {}); // the step panel closes once the step is stored
  await settle(pf, 3000);
}

/** Creates the preset `name` and adds `steps` in order. */
export async function createPresetWithSteps(page: Page, pf: Frame, name: string, steps: PresetStep[], description = 'Playwright preset'): Promise<void> {
  await createPreset(page, pf, name, [], description);
  for (const s of steps) await addPresetStep(pf, s);
}

export async function createPreset(page: Page, pf: Frame, name: string, stepUsers: string[], description = 'Playwright preset'): Promise<void> {
  await pf.getByRole('button', { name: 'Create New' }).click();
  await pf.locator('#txtCreateNewName').waitFor({ state: 'visible', timeout: 8000 });
  await pf.locator('#txtCreateNewName').fill(name);
  await pf.locator('#txtCreateNewDescription').fill(description);
  await dialogButton(pf, 'Submit');
  await settle(pf, 4000);
  for (const user of stepUsers) {
    // the LAST "Add Step" link appends a new approval group (the approval group number auto-increments: 1, 2, ...)
    await pf.locator('#steps-container').getByText('Add Step').last().click({ timeout: 5000 });
    await pf.locator('#drpUser').waitFor({ state: 'visible', timeout: 8000 });
    const option = (await pf.locator('#drpUser option').allInnerTexts()).find((t) => t.trim().startsWith(user));
    if (!option) throw new Error(`no step user starting with "${user}"`);
    await pf.locator('#drpUser').selectOption({ label: option.trim() });
    await pf.locator('#txtDepartment').fill('QA');
    await pf.locator('#btCreateStep').click();
    await pf.locator('#drpUser').waitFor({ state: 'hidden', timeout: 15_000 }).catch(() => {});
    await settle(pf, 3000);
  }
}

/** Deletes a preset by name (no-op when absent). */
export async function deletePreset(pf: Frame, name: string): Promise<void> {
  const names = (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim());
  if (!names.includes(name)) return;
  await pf.locator('#ddlSelectPreset').selectOption({ label: name }, { timeout: 5000 });
  await settle(pf, 4000);
  await pf.locator('#btDeletePreset').click({ timeout: 5000 });
  await pf.locator('.ui-dialog:visible').first().waitFor({ state: 'visible', timeout: 8000 });
  await dialogButton(pf, /^(Yes|OK|Delete)$/);
  await pf.locator('.ui-dialog:visible').first().waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});
  await settle(pf, 4000);
}

export { expect };
