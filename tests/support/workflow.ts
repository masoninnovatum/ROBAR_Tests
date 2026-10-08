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

/** Opens (or re-opens) the Workflow Management Management page and returns its frame. */
export async function openWorkflowManagement(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Workflow Management") .ui-icon-close').click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, 'Workflow Management');
  const f = await findFrame(page, 'WorkflowManagement');
  await f.locator('#btGetWorkflows').waitFor({ timeout: 20_000 });
  await delay(2500);
  return f;
}

/**
 * Reset (clears the persisted criteria row -- the page re-applies the last search), "Any User", optional Open/Closed filter
 * (`status` = 'Open Only' | 'Closed Only', lives in the collapsed Advanced Options), then the grid sorted by Workflow ID
 * DESCENDING (the default order is ascending) so brand-new workflows are on page 1. Returns the Management frame.
 */
export async function showNewestFirst(page: Page, status?: string): Promise<Frame> {
  let f = await openWorkflowManagement(page);
  await f.click('#btCancel', { timeout: 5000 });
  await delay(2500);
  f = lastFrame(page, 'WorkflowManagement/Management');
  await f.locator('#drpUser').selectOption({ label: 'Any User' });
  if (status) {
    if (!(await f.locator('#drpApproved').isVisible())) {
      await f.locator('#btAdvanced').click({ timeout: 5000 });
      await delay(1000);
    }
    await f.locator('#drpApproved').selectOption({ label: status }, { timeout: 5000 });
  }
  await f.click('#btGetWorkflows');
  await f.locator('#gridResults tr.jqgrow').first().waitFor({ timeout: 20_000 });
  await delay(1500);
  for (let i = 0; i < 3; i++) {
    const col = await f.locator('#gridResults tr.jqgrow td[aria-describedby="gridResults_WorkflowID"]').allInnerTexts();
    if (col.length < 2 || col[0].trim() >= col[col.length - 1].trim()) break;
    await f.locator('#gridResults_WorkflowID').click({ timeout: 5000 });
    await delay(2500);
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
  await delay(500);
  await f.locator('#actCreateWorflow').click({ force: true });
  await delay(4000);
  f = lastFrame(page, 'SendToWorkflowJobSubmission');
  await f.locator('#txtJobDescription').fill(description);
  await f.locator('#txtComment').fill(comment);
  await f.locator('#txtComment').press('Tab');
  await f.locator('#drpPreset').selectOption({ label: preset });
  await delay(2500);
  await f.locator('#txtComment').press('Tab');
  await expect(f.locator('#btnFormSubmit')).toBeEnabled({ timeout: 5000 });
  await f.locator('#btnFormSubmit').click();
  await delay(4000);
  let jf = lastFrame(page, 'WFJobDetail');
  let text = '';
  for (let i = 0; i < 20; i++) {
    text = (await jf.locator('body').innerText()).replace(/\s+/g, ' ');
    if (/Status Completed/.test(text) && /Workflow Id:\s*\d/.test(text)) break;
    await delay(2000);
    jf = lastFrame(page, 'WFJobDetail');
  }
  const id = (text.match(/Workflow Id:\s*(\d{8}-\d{4})/) ?? [])[1];
  expect(id, 'a Workflow Id like YYYYMMDD-NNNN').toBeTruthy();
  await jf.getByText('Workflow Management').first().click();
  await delay(4000);
  return id;
}

/**
 * With the workflow rows already ticked in `f`: Bulk Actions > View And Vote, vote each row (`votes[i]` = 'approve' | 'reject',
 * in grid order of the vote page), sign with the given credentials and wait for the job to complete. Returns the job text.
 */
export type VoteKind = 'approve' | 'reject' | 'approveForDept' | 'rejectForDept' | 'approveVeto' | 'rejectVeto';

export async function voteTickedWorkflows(page: Page, f: Frame, votes: VoteKind[], user: string, password: string, comment = 'Voted by Playwright'): Promise<string> {
  await f.locator('#drpActions').click();
  await delay(500);
  await f.locator('#actViewAndVote').click({ force: true });
  await delay(5000);
  const vf = lastFrame(page, 'WFViewAndVote/JobSubmission');
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
  await delay(2000);
  await vf.locator('#jobDescription').fill('PW vote');
  await vf.locator('#UserID').fill(user);
  await vf.locator('#Password').fill(password);
  await vf.locator('#Reason').selectOption({ label: 'General' });
  await vf.locator('#Comment').fill(comment);
  await vf.locator('#Password').press('Tab');
  await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
  await delay(5000);
  let text = '';
  for (let i = 0; i < 45; i++) {
    text = (await lastFrame(page, 'WFViewAndVote/JobDetail').locator('body').innerText()).replace(/\s+/g, ' ');
    if (/Status Completed/.test(text)) break;
    await delay(2000);
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
    await delay(1000);
    await f.locator('#drpActions').click();
    await delay(500);
    await f.locator('#actViewAndVote').click({ force: true });
    await delay(6000);
    const vf = lastFrame(page, 'WFViewAndVote/JobSubmission');
    const rows = (await vf.locator('table.ui-jqgrid-btable tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
    const enabled = await vf.locator('table.ui-jqgrid-btable tr.jqgrow').evaluateAll((trs) => trs.filter((r) => { const b = r.querySelectorAll('input[type=checkbox]')[1] as HTMLInputElement | undefined; return !!b && !b.disabled; }).length);
    return { vf, enabled, rows };
  };
  let { vf, enabled, rows } = await openVotePage();
  if (enabled === 0 && rows.length > 0 && rows.every((r) => /Approved|Rejected/.test(r))) {
    const f = await showNewestFirst(page, 'Open Only');
    await f.locator('#gridResults tr.jqgrow').filter({ hasText: id }).locator('input[type=checkbox]').check({ timeout: 10_000 });
    await delay(1000);
    await f.locator('#drpActions').click();
    await delay(500);
    await f.locator('#actWfEdit').click({ force: true });
    await delay(5000);
    const ef = lastFrame(page, 'WorkflowManagement/Edit');
    await ef.locator('#drpActions').click();
    await delay(500);
    await ef.getByText('Add User', { exact: true }).hover();
    await delay(800);
    await ef.locator('#lnkAddToEnd').click({ timeout: 5000 });
    await delay(1500);
    const opt = (await ef.locator('#dvMainEdit #drpUser option').allInnerTexts()).map((t) => t.trim()).find((t) => t.toLowerCase().startsWith(`${user.toLowerCase()} (`));
    await ef.locator('#dvMainEdit #drpUser').selectOption({ label: opt! });
    await ef.locator('#btCreateStep').click();
    await delay(9000);
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
  await delay(2000);
  await vf.locator('#jobDescription').fill('PW close');
  await vf.locator('#UserID').fill(user);
  await vf.locator('#Password').fill(password);
  await vf.locator('#Reason').selectOption({ label: 'General' });
  await vf.locator('#Comment').fill('closed by the test cleanup');
  await vf.locator('#Password').press('Tab');
  await vf.locator('.ui-dialog:visible .ui-dialog-buttonpane button').filter({ hasText: 'Submit' }).click();
  await delay(8000);
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
  await delay(700);
}

/** Opens Preset Management from the Management page. */
export async function openPresetManagement(page: Page, f: Frame): Promise<Frame> {
  await f.locator('#drpMainActions').click();
  await delay(500);
  await f.locator('#actCreateWFPreset').click({ force: true });
  await delay(4000);
  const pf = await findFrame(page, 'PresetManagement');
  await pf.locator('#ddlSelectPreset').waitFor({ timeout: 15_000 });
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
  await delay(1000);
  const option = (await pf.locator('#drpUser option').allInnerTexts()).find((t) => t.trim().startsWith(step.user));
  if (!option) throw new Error(`no step user starting with "${step.user}"`);
  await pf.locator('#drpUser').selectOption({ label: option.trim() });
  await pf.locator('#txtDepartment').fill('QA');
  if (step.group !== undefined) await pf.locator('#txtApprovalGroup').fill(String(step.group));
  if (step.voteForGroup !== undefined) await pf.locator('#chkVoteForGroup').setChecked(step.voteForGroup);
  if (step.veto) await pf.locator('#drpVoteVeto').selectOption({ label: step.veto });
  await pf.locator('#btCreateStep').click();
  await delay(2200);
}

/** Creates the preset `name` and adds `steps` in order. */
export async function createPresetWithSteps(page: Page, pf: Frame, name: string, steps: PresetStep[], description = 'Playwright preset'): Promise<void> {
  await createPreset(page, pf, name, [], description);
  for (const s of steps) await addPresetStep(pf, s);
}

export async function createPreset(page: Page, pf: Frame, name: string, stepUsers: string[], description = 'Playwright preset'): Promise<void> {
  await pf.getByRole('button', { name: 'Create New' }).click();
  await delay(1200);
  await pf.locator('#txtCreateNewName').fill(name);
  await pf.locator('#txtCreateNewDescription').fill(description);
  await dialogButton(pf, 'Submit');
  await delay(2000);
  for (const user of stepUsers) {
    // the LAST "Add Step" link appends a new approval group (the approval group number auto-increments: 1, 2, ...)
    await pf.locator('#steps-container').getByText('Add Step').last().click({ timeout: 5000 });
    await delay(1000);
    const option = (await pf.locator('#drpUser option').allInnerTexts()).find((t) => t.trim().startsWith(user));
    if (!option) throw new Error(`no step user starting with "${user}"`);
    await pf.locator('#drpUser').selectOption({ label: option.trim() });
    await pf.locator('#txtDepartment').fill('QA');
    await pf.locator('#btCreateStep').click();
    await delay(2200);
  }
}

/** Deletes a preset by name (no-op when absent). */
export async function deletePreset(pf: Frame, name: string): Promise<void> {
  const names = (await pf.locator('#ddlSelectPreset option').allInnerTexts()).map((t) => t.trim());
  if (!names.includes(name)) return;
  await pf.locator('#ddlSelectPreset').selectOption({ label: name }, { timeout: 5000 });
  await delay(2200);
  await pf.locator('#btDeletePreset').click({ timeout: 5000 });
  await delay(1000);
  await dialogButton(pf, /^(Yes|OK|Delete)$/);
  await delay(2200);
}

export { expect };
