// Helpers for the "Dynamic UI" framework pages (`InnoPages/DynamicUI/DynamicUI?Definition=<Name>`): Label Type Management
// (Definition=LabelTypes), Lot Management, ... A config-driven jqGrid page, live-confirmed 2026-10-04 on Label Type Management.
//
// Anatomy: Actions menu `#drpMainActions` (Excel Import `#actExcelImport`, Excel Export `#actExcelExport`, Audit `#actAuditView`,
// Save Search `#actSaveFilter`, Load Search `#actLoadFilter`, Adjust Page Size `#actAdjustPageSize`); shared CriteriaFilter widget
// instance "dvFilters" (`dvFilters[0].Column/Operator/Value`) with `+ Add Filter`, `#btnRetrieveData`, `#resultLimitTxt`;
// grid `#grdJqGrid` (jqGrid, pager `#grdPager`) whose nav icons are `#add_grdJqGrid`, `#edit_grdJqGrid`, `#view_grdJqGrid`,
// `#del_grdJqGrid` (edit/view/delete are `ui-state-disabled` until a row is selected).
// The Add / Edit / View dialogs are jqGrid FORM dialogs (`.ui-jqdialog`, NOT `.ui-dialog`): fields by id (`#LabelType` ...),
// buttons `#sData` (Submit) / `#cData` (Cancel); View has a Close button. Probing `.ui-dialog:visible` here matches nothing.
// The filter row PERSISTS per user: only add a row when none exists, or the new blank row ANDs with the old one and empties the grid.

import type { Frame, Locator, Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from './robar';

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function openDynamicUi(page: Page, tile: string): Promise<Frame> {
  await login(page);
  return reopenDynamicUi(page, tile);
}

export async function reopenDynamicUi(page: Page, tile: string): Promise<Frame> {
  await page.locator(`li.ui-tabs-tab:has-text("${tile}") .ui-icon-close`).click({ timeout: 2000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await openMenuItem(page, tile);
  const f = await findFrame(page, 'DynamicUI');
  await f.locator('#btnRetrieveData').waitFor({ timeout: 20_000 });
  await delay(2500);
  return f;
}

/** Sets filter row 0 (adding it only if no row exists), Retrieves, and returns the grid rows' normalised texts. */
export async function retrieve(page: Page, f: Frame, column: string, operator: string, value: string, { expectRows = true }: { expectRows?: boolean } = {}): Promise<string[]> {
  if ((await f.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await delay(500);
  }
  await f.locator('select[name="dvFilters[0].Column"]').selectOption(column, { timeout: 5000 });
  // The operator <option> values are plain indexes (0-9) on these pages: select by the visible LABEL ("Contains",
  // "Exactly Matches", "Is Blank" ...).
  await f.locator('select[name="dvFilters[0].Operator"]').selectOption({ label: operator }, { timeout: 5000 });
  if (!/^Is (Not )?Blank$/.test(operator)) {
    // the Value editor follows the column's type: a text input, or a <select> for columns with a fixed value list (e.g. File/Form)
    await delay(400);
    if ((await f.locator('input[name="dvFilters[0].Value"]').count()) > 0) {
      await f.locator('input[name="dvFilters[0].Value"]').fill(value, { timeout: 5000 });
    } else {
      await f.locator('select[name="dvFilters[0].Value"]').selectOption({ label: value }, { timeout: 5000 });
    }
  }
  await f.click('#btnRetrieveData', { timeout: 5000 });
  await delay(2500);
  if (expectRows) await f.locator('tr.jqgrow').first().waitFor({ timeout: 15_000 });
  return rows(f);
}

export async function rows(f: Frame): Promise<string[]> {
  return (await f.locator('tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ').trim());
}

export function gridRow(f: Frame, text: string): Locator {
  return f.locator('tr.jqgrow').filter({ hasText: text });
}

/** Selects the row containing `text` (idempotent: the grid is multi-select, so a second click would UN-select it). */
export async function selectGridRow(f: Frame, text: string): Promise<void> {
  const row = gridRow(f, text);
  const selected = await row.first().evaluate((r) => r.classList.contains('ui-state-highlight') || r.getAttribute('aria-selected') === 'true');
  if (!selected) {
    await row.first().click({ timeout: 5000 });
    await delay(500);
  }
}

/** True when a jqGrid nav icon (`add`/`edit`/`view`/`del`) is enabled. */
export async function navEnabled(f: Frame, icon: 'add' | 'edit' | 'view' | 'del'): Promise<boolean> {
  return !(await f.locator(`#${icon}_grdJqGrid`).evaluate((e) => e.classList.contains('ui-state-disabled')));
}

/** Opens a jqGrid form dialog via its nav icon and returns the visible `.ui-jqdialog`. */
export async function openFormDialog(f: Frame, icon: 'add' | 'edit' | 'view'): Promise<Locator> {
  await f.click(`#${icon}_grdJqGrid`, { timeout: 5000 });
  const dialog = f.locator('.ui-jqdialog:visible').last();
  await dialog.waitFor({ timeout: 10_000 });
  await delay(800);
  return dialog;
}

/** The visible jqGrid form-dialog error line (`#FormError` text), e.g. "Record already exists." */
export async function formError(f: Frame): Promise<string> {
  // the red row at the top of the dialog (client-side "<Column>: Field is required" and the server's refusals alike)
  return (await f.locator('.ui-jqdialog:visible tr.FormError:visible, .ui-jqdialog:visible td.ui-state-error:visible').allInnerTexts()).join(' ').replace(/\s+/g, ' ').trim();
}

export async function submitForm(f: Frame): Promise<void> {
  await f.click('#sData', { timeout: 5000 });
  await delay(1500);
}

export async function cancelForm(f: Frame): Promise<void> {
  await f.click('#cData', { timeout: 5000 });
  await delay(600);
  await expect(f.locator('.ui-jqdialog:visible')).toHaveCount(0, { timeout: 5000 });
}
