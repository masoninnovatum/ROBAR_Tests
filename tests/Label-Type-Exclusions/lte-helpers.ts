// Helpers for Label Type Exclusions (tile "Label Type Excl.", process Maintain_LabelType_Exclusions): the legacy ASP.NET page
// `Innovatum/ROBAR/management/LabelTypeExclusion/ExclusionEdit.aspx` (source: Web/ROBAR/Management/LabelTypeExclusion). Live-confirmed 2026-11-03.
//
// Anatomy: left, the multi-select `select[id$=lbWorkstations]` (workstations that printed in the last 90 days OR already have exclusions; AutoPostBack) with the text box
// `input[id$=txtboxAddWorkstation]` + button `input[id$=btnAddWorkstation]` ("Add": the name is only added to the page's view state, nothing is stored until an exclusion is ticked);
// right, `table.EditGridTable` (shown after at least one workstation is selected): optional `tr.SelectAllRow` (only with 2+ workstations selected), `tr.LabelTypesRow` (one header cell
// per label type after an empty first cell) and one `tr.WorkstationRow` per selected workstation (first cell = name, then one checkbox cell per label type). A tick posts back at once and
// writes / deletes the LabelTypeExclusions row (workstation + label type): "All changes are immediately reflected in the database."
// REAL workstations are listed too (LAN-PC, MASON-LAPTOP, TAMMY-SAMSUNG, VMSRVTST703 on TST703): the specs only ever touch workstations named CLWS<stamp>.

import type { Frame, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { findFrame, openMenuItem } from '../support/robar';

export const PAGE_URL_PART = 'LabelTypeExclusion';

export async function openExclusions(page: Page, reopen = false): Promise<Frame> {
  if (reopen) {
    await page.locator('li.ui-tabs-tab:has-text("Label Type Excl") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  }
  await openMenuItem(page, 'Label Type Excl.');
  const f = await findFrame(page, PAGE_URL_PART);
  await f.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
  await f.locator('select[id$=lbWorkstations]').waitFor({ timeout: 20_000 });
  await page.waitForTimeout(1500);
  return f;
}

export const frameOf = (page: Page) => findFrame(page, PAGE_URL_PART);

export async function workstationList(f: Frame): Promise<string[]> {
  return (await f.locator('select[id$=lbWorkstations] option').allInnerTexts()).map((t) => t.trim());
}

export async function addWorkstation(page: Page, f: Frame, name: string): Promise<Frame> {
  await f.locator('input[id$=txtboxAddWorkstation]').fill(name);
  await f.locator('input[id$=btnAddWorkstation]').click();
  await page.waitForTimeout(2500);
  return frameOf(page);
}

/** Selects exactly these workstations in the multi-select (Ctrl-click semantics via selectOption of several labels) and waits for the grid to be rebuilt. */
export async function selectWorkstations(page: Page, f: Frame, names: string[]): Promise<Frame> {
  await f.locator('select[id$=lbWorkstations]').selectOption(names.map((label) => ({ label })));
  await page.waitForTimeout(3500);
  return frameOf(page);
}

export const grid = (f: Frame) => f.locator('table.EditGridTable');

export async function labelTypes(f: Frame): Promise<string[]> {
  return (await grid(f).locator('tr.LabelTypesRow td').allInnerTexts()).map((t) => t.trim()).slice(1);
}

/** Checkbox of workstation row `workstation` under label type `labelType`. */
export function box(f: Frame, workstation: string, labelType: string, types: string[]) {
  const i = types.indexOf(labelType);
  if (i < 0) throw new Error(`label type ${labelType} is not a column of the grid`);
  return grid(f).locator('tr.WorkstationRow').filter({ hasText: workstation }).locator('td').nth(i + 1).locator('input[type=checkbox]');
}

/** Ticked label types of a workstation row. */
export async function ticked(f: Frame, workstation: string): Promise<string[]> {
  const types = await labelTypes(f);
  const states = await grid(f).locator('tr.WorkstationRow').filter({ hasText: workstation }).locator('td').evaluateAll((tds) => tds.slice(1).map((td) => !!(td.querySelector('input[type=checkbox]') as HTMLInputElement | null)?.checked));
  return types.filter((_, i) => states[i]);
}

/** Clicks a checkbox (it posts back) and waits for the grid to settle; returns the re-resolved frame. */
export async function toggle(page: Page, f: Frame, workstation: string, labelType: string, want: boolean): Promise<Frame> {
  const types = await labelTypes(f);
  const cb = box(f, workstation, labelType, types);
  if ((await cb.isChecked()) !== want) {
    await cb.click();
    await page.waitForTimeout(3000);
  }
  const g = await frameOf(page);
  const types2 = await labelTypes(g);
  expect(await box(g, workstation, labelType, types2).isChecked(), `${workstation} / ${labelType} is ${want ? 'ticked' : 'cleared'}`).toBe(want);
  return g;
}
