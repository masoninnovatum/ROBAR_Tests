// Master Data Management helpers shared across tests/Master-Data-Management/*.spec.ts.
//
// Live-confirmed (2026-09-14) via direct MCP browser exploration before writing the first test in
// this module (Create_New_Record, mapping MDM_New_Record21.1) -- see robar-module-reference.md's
// "Master Data Management" section for the full exploration notes.

import type { Frame, Page } from '@playwright/test';

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Selects a schema in the Master Data Management page's Schema drop-down (id="ddlSchemas"). */
export async function selectSchema(frame: Frame, schemaName: string): Promise<void> {
  await frame.selectOption('#ddlSchemas', { label: schemaName });
}

/**
 * Opens the Master Data Management page's top "Actions" drop-down and clicks "New Record".
 * `{ force: true }` on the action item click matches the same jQuery dropmenu-toggle pattern
 * already documented for Template Management's `#actCreateTemplate` (Innovatum's shared
 * dropmenu-toggle widget renders an icon <span> overlapping the link's hit-testable area).
 *
 * The wait between the two clicks is NOT optional -- every existing Template Management test using
 * this same dropmenu-toggle widget (e.g. `#drpMainActions` / `#actCreateTemplate`) includes one too.
 * The menu opens asynchronously (jQuery UI menu), and `{ force: true }` on the second click bypasses
 * Playwright's own "wait until visible" actionability check -- without the wait, that force click
 * can silently land on `#actNewRecord` before the menu has actually opened/positioned it, doing
 * nothing and leaving the dialog never opened (confirmed live: this is exactly what happened when
 * the wait was missing -- no error, no dialog, just a silent no-op click).
 */
export async function openNewRecordAction(frame: Frame): Promise<void> {
  await frame.click('#drpMainActions');
  await delay(500);
  await frame.click('#actNewRecord', { force: true });
  await delay(500);
}

export interface CreatedItemRecord {
  createResponse: any;
}

/**
 * Fills and submits the "Create New Master Data" dialog (item schemas only -- non-item schemas
 * skip this dialog entirely and go straight to the Master Data Edit page, see openNewRecordAction's
 * caller in the non-item-schema flow). Field ids confirmed live: #txtNewItemNumber,
 * #txtNewItemDescription, dialog Submit button id #btnSubmitNewitem (NOT scoped by
 * ".ui-dialog-buttonpane button:has-text('Submit')" -- the page has multiple hidden ui-dialogs
 * whose buttons are also literally labelled "Submit" (e.g. Approve), which would make that selector
 * ambiguous/strict-mode-unsafe here).
 */
export async function submitNewItemDialog(page: Page, frame: Frame, itemNumber: string, description: string): Promise<CreatedItemRecord> {
  await frame.fill('#txtNewItemNumber', itemNumber);
  await frame.fill('#txtNewItemDescription', description);

  const [createResponse] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/InnovatumMDM/MasterData/CreateMasterData'), { timeout: 15_000 }),
    frame.click('#btnSubmitNewitem'),
  ]);
  return { createResponse: await createResponse.json() };
}

/**
 * Sets the Master Data Edit page's built-in item "Description" field (the one shown directly under
 * the Item Number/Version/Schema Name header row, NOT a custom schema field in a tab).
 *
 * Confirmed live: this field's Knockout binding is
 * `value: itemHeader().description, valueUpdate: 'afterkeydown'` -- unlike ordinary schema fields
 * (which use the standard `textInput: $data.value` binding and work fine with a plain
 * `frame.fill()`/real keystrokes), this one does NOT reliably accept scripted keystrokes: every
 * character typed (via Playwright's normal `fill()` or even real per-character `pressSequentially()`
 * keyboard events) gets wiped back to empty, because writing to the observable triggers a
 * synchronous re-render of the row that recreates the input from the pre-keystroke value. The only
 * reliable way to set it is to reach into the page's own Knockout view model directly and push the
 * value into the observable itself, which is exactly what the real `afterkeydown` handler does
 * internally anyway (just without the concurrent DOM-recreation race scripted input hits).
 */
export async function setItemDescription(frame: Frame, description: string): Promise<void> {
  await frame.evaluate((desc) => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    vm.itemHeader().description(desc);
  }, description);
}

/**
 * Clicks Save on the Master Data Edit page and waits for the save response. Works for both item
 * and non-item schema records (same Save button either way) -- but confirmed live, they POST to
 * DIFFERENT endpoints: item records hit `SaveMasterDataItem`, non-item records hit `SaveMasterData`
 * (no "Item" suffix). Matching the common `SaveMasterData` substring covers both without needing to
 * know which schema kind is in play (no other endpoint in this module contains that substring).
 */
export async function saveRecord(page: Page, frame: Frame): Promise<any> {
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().includes('/InnovatumMDM/MasterData/SaveMasterData'), { timeout: 15_000 }),
    frame.click('button:has-text("Save")'),
  ]);
  return response.json();
}

/** Fills a plain text schema field by its row caption (e.g. "Primary DI Number", "Brand Name"). */
export async function fillFieldByCaption(frame: Frame, caption: string, value: string): Promise<void> {
  await frame.getByRole('row', { name: caption }).getByRole('textbox').fill(value);
}

/**
 * Changes a Select2-backed dropdown schema field (e.g. "Labeler Duns Number") to a different
 * option by its visible label. Confirmed live: Select2 hides the real `<select>` behind its own
 * fake widget (via the standard `select2-hidden-accessible` screen-reader-only CSS pattern) --
 * Playwright's `selectOption()` still targets and updates the real, hidden `<select>` directly and
 * fires the events Knockout's `value` binding listens for, so there's no need to drive Select2's
 * own open/click/pick UI at all.
 */
export async function selectDropdownFieldByCaption(frame: Frame, caption: string, optionLabel: string): Promise<void> {
  await frame.getByRole('row', { name: caption }).locator('select').selectOption({ label: optionLabel });
}
