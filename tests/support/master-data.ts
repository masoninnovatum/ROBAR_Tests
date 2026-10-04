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

/**
 * Fills a plain schema field by its row caption (e.g. "Primary DI Number", "Brand Name",
 * "Device Count"). Confirmed live: a numeric-typed schema field renders as `<input
 * type="number">`, whose ARIA role is `spinbutton`, NOT `textbox` -- `getByRole('textbox')` (the
 * original implementation) silently matches zero elements for these fields and hangs for the
 * whole test timeout waiting for one to appear (this app's actionTimeout defaults to unlimited).
 * Match on the row's actual `<input>` element directly instead of an ARIA role, since a field row
 * only ever renders one live input at a time (Knockout `ko if: fieldTypeIs...()` blocks make the
 * rest empty comments) regardless of whether it's text or numeric.
 */
export async function fillFieldByCaption(frame: Frame, caption: string, value: string): Promise<void> {
  await frame.getByRole('row', { name: caption }).locator('input[type=text], input[type=number]').first().fill(value);
}

/**
 * Sets the Master Data Edit page's built-in "Effective Begin" date field (jQuery UI datepicker,
 * bound `datepicker: itemHeader().effectiveBegin`).
 *
 * This field's input renders `readonly` (by design -- it's meant to be set only via the
 * datepicker popup, not typed into), so Playwright's `.fill()` refuses it outright ("element is
 * not editable", confirmed live: hangs retrying for the full test timeout since this state never
 * changes). Same class of problem as `setItemDescription` (an `itemHeader()`-level Knockout
 * observable, not a plain schema-field `value` binding) -- fixed the identical way, by pushing a
 * real JS `Date` directly into the observable rather than fighting the widget's own UI.
 */
export async function setEffectiveBegin(frame: Frame, date: Date): Promise<void> {
  await frame.evaluate((dateMs) => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    vm.itemHeader().effectiveBegin(new Date(dateMs));
  }, date.getTime());
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

// ---------------------------------------------------------------------------------------------------------
// Added 2026-10-02 for the MDM spec set (Record_Lifecycle etc.). Live-confirmed selectors:
//  - Edit page Actions trigger `#drpToSelect`; items `#menuApprove`, `#menuSaveAsNewVersion`,
//    `#menuSaveAsNewRecord`, `#menuRetire` / `#menuUnretire` (one or the other by active state), `#menuGetRemoteData`,
//    `#menuViewTransmissions`, `#menuCreateNewRecord`. Same dropmenu force-click pattern as everywhere else.
//  - Approve / Retire / Unretire dialogs use the shared signature ids (#sigUser #sigPassword #sigReason #sigComments)
//    and submit buttons `#btnApproveSubmit` / `#btnRetireSubmit` (Unretire reuses `#btnRetireSubmit`).
//  - Approve reasons: "General Approval", "QA Approval", "RA Approval", "Ready for GUDID".
// ---------------------------------------------------------------------------------------------------------

import { expect } from '@playwright/test';
import { login, findFrame, USERNAME, PASSWORD, BASE_URL } from './robar';

/** Logs in and opens the Master Data Management grid frame ("Master Data" is a substring of "Master Data Excel Import"). */
export async function openMasterData(page: Page): Promise<Frame> {
  await login(page);
  await page.getByRole('button', { name: 'Master Data', exact: true }).click({ timeout: 10_000 });
  const frame = await findFrame(page, 'MasterData');
  await page.waitForTimeout(1500);
  return frame;
}

export interface NewRecordOptions {
  schema?: string;
  itemNumber?: string;
  description?: string;
  brandName?: string;
  /** Primary DI Number (default: "00841646" + 6 random digits). */
  primaryDi?: string;
}

/**
 * Creates and saves a valid RobarMasterData item record (see Create_New_Record.spec.ts for why each field is needed),
 * leaving the browser on the Master Data Edit page. Returns the item number.
 */
export async function createValidRecord(page: Page, frame: Frame, options: NewRecordOptions = {}): Promise<string> {
  const itemNumber = options.itemNumber ?? 'MBMDM' + Date.now().toString().slice(-7);
  await selectSchema(frame, options.schema ?? 'RobarMasterData');
  await openNewRecordAction(frame);
  await submitNewItemDialog(page, frame, itemNumber, options.description ?? 'Playwright MDM record');
  await expect(frame.getByRole('heading', { name: 'Master Data Edit' })).toBeVisible({ timeout: 15_000 });
  await setItemDescription(frame, options.description ?? 'Playwright MDM record');
  await selectDropdownFieldByCaption(frame, 'Labeler Duns Number', 'Innovatum');
  await fillFieldByCaption(frame, 'Primary DI Number', options.primaryDi ?? '00841646' + String(Math.floor(Math.random() * 1000000)).padStart(6, '0'));
  await fillFieldByCaption(frame, 'Brand Name', options.brandName ?? 'Playwright Brand');
  await saveRecord(page, frame);
  await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  return itemNumber;
}

/** Opens the Edit page's Actions menu and clicks one item by its anchor id (e.g. 'menuApprove'). */
export async function clickEditAction(page: Page, frame: Frame, menuId: string): Promise<void> {
  await frame.locator('#drpToSelect').click({ timeout: 5000 });
  await delay(600);
  await frame.locator('#' + menuId).click({ force: true, timeout: 5000 });
  await delay(600);
}

/** Whether an Edit-page Actions item is rendered disabled (`ui-state-disabled` on its <li>). */
export async function editActionDisabled(frame: Frame, menuId: string): Promise<boolean> {
  await frame.locator('#drpToSelect').click({ timeout: 5000 });
  await delay(500);
  const disabled = await frame.locator('#' + menuId).evaluate((a) => !!a.closest('li')?.classList.contains('ui-state-disabled'), undefined, { timeout: 5000 });
  await frame.locator('#drpToSelect').click({ timeout: 5000 }).catch(() => {});
  await delay(300);
  return disabled;
}

/** Fills the shared signature block inside `scope` (e.g. '#approveDialog') and clicks the dialog's submit button. */
export async function signAndSubmit(frame: Frame, scope: string, submitId: string, reason: string): Promise<void> {
  await frame.locator(`${scope} #sigUser`).fill(USERNAME, { timeout: 5000 });
  await frame.locator(`${scope} #sigPassword`).fill(PASSWORD, { timeout: 5000 });
  await frame.locator(`${scope} #sigReason`).selectOption({ label: reason }, { timeout: 5000 });
  await frame.locator(`${scope} #sigComments`).fill('Playwright MDM test', { timeout: 5000 });
  // #btnRetireSubmit exists in BOTH the Retire and Unretire dialogs, so scope to the visible one.
  await frame.locator('.ui-dialog:visible #' + submitId).click({ timeout: 5000 });
}

/** Clicks the visible confirm-style jQuery UI dialog's affirmative button (OK / Yes / Continue / Proceed). */
export async function confirmDialog(frame: Frame): Promise<string> {
  const dialog = frame.locator('.ui-dialog:visible').last();
  const text = (await dialog.innerText({ timeout: 5000 })).replace(/\s+/g, ' ').trim();
  const button = dialog.locator('button').filter({ hasText: /^(OK|Yes|Continue|Proceed|Confirm)$/i }).first();
  await button.click({ timeout: 5000 });
  return text;
}

// ---- Grid helpers (live-confirmed 2026-10-02): grid `#grdMasterData` (rows `tr.jqgrow`, id = masterDataId), row checkbox
// `#jqg_grdMasterData_<id>`, columns id / Actions / Item Number / Version Number. Filter row 0 is always present when the
// page loads (the persisted last-used filter); columns by value (`ItemNumber`, `Description`, `Primary_DI_Number`...).
// Bulk Actions menu `#drpActions` -> `#actMassUpdate #actMassApprove #actMassRetire #actSaveAsNew #actExportExcel
// #actAssignGTIN #actAssignLabels #actTradingPartnerUpload #actEndDistribution`; Quick Edit is the button `#btnEditSelCol`.

/** Returns to the grid from an Edit page via the "Previous Page" link and re-resolves the (reloaded) frame. */
export async function backToGrid(page: Page, frame: Frame): Promise<Frame> {
  await frame.click('a:has-text("Previous Page")', { timeout: 5000 });
  await delay(2000);
  const grid = await findFrame(page, 'MasterData');
  await grid.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await delay(500);
  return grid;
}

/**
 * Filters the grid on one column (row 0) and retrieves; waits for the expected number of rows (poll, the grid can still
 * be loading) when `expectRows` is given. Returns the data-row locator.
 */
export async function retrieve(
  page: Page,
  frame: Frame,
  {
    column = 'ItemNumber',
    operator = 'Contains',
    value,
    forItems,
    schema,
    expectRows,
    latestOnly = false,
    effectiveOnly = false,
    limit = 500,
  }: { column?: string; operator?: string; value: string; forItems?: string; schema?: string; expectRows?: number; latestOnly?: boolean; effectiveOnly?: boolean; limit?: number }
) {
  if (schema) {
    await selectSchema(frame, schema);
  } else if (!(await frame.locator('#ddlSchemas').inputValue({ timeout: 5000 }))) {
    // A user who has never opened the grid has NO schema selected, and the whole filter area stays hidden until one is picked
    // (the previous seed user always had one persisted). Default to the standard item schema.
    await selectSchema(frame, 'RobarMasterData');
    await delay(1500);
  }
  if ((await frame.locator('select[name="dvFilters[0].Column"]').count()) === 0) {
    await frame.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await delay(500);
  }
  // The account persists the last-used filter (For Items, Latest Version Only, Effective Only), so ALWAYS set them
  // explicitly -- a previous spec's "Unapproved" silently hid approved records here once.
  await frame.locator('#drpApproved').selectOption({ label: forItems ?? 'Any' }, { timeout: 5000 });
  await frame.locator('#chkLatest').setChecked(latestOnly, { timeout: 5000 });
  await frame.locator('#chkEffective').setChecked(effectiveOnly, { timeout: 5000 });
  // Advanced Options > Limit Results is ALSO persisted per account (a "Limit Results = 2" step once capped every later run to
  // 2 rows). The input lives in the (usually collapsed) accordion, so set it by script + events rather than typing.
  await frame.locator('#txtResultLimit').evaluate((el, v) => {
    const input = el as HTMLInputElement;
    input.value = String(v);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
  }, limit, { timeout: 5000 });
  await frame.locator('select[name="dvFilters[0].Column"]').selectOption(column, { timeout: 5000 });
  await frame.locator('select[name="dvFilters[0].Operator"]').selectOption(operator, { timeout: 5000 });
  await frame.locator('input[name="dvFilters[0].Value"]').fill(value, { timeout: 5000 });
  await frame.click('#btnRetrieveData', { timeout: 5000 });
  await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await delay(2000);
  const rows = frame.locator('#grdMasterData tr.jqgrow');
  if (expectRows !== undefined) {
    for (let attempt = 0; attempt < 10; attempt++) {
      if ((await rows.count()) === expectRows && (expectRows > 0 || attempt >= 1)) break;
      await delay(1500);
    }
  }
  return rows;
}

/** Checks the grid rows whose text contains each given item number (settle wait after each check). */
export async function checkRows(frame: Frame, itemNumbers: string[]): Promise<void> {
  for (const n of itemNumbers) {
    const row = frame.locator('#grdMasterData tr.jqgrow').filter({ hasText: n });
    await expect(row, `grid row for ${n}`).toHaveCount(1, { timeout: 10_000 });
    await row.locator('input[type="checkbox"]').first().check({ timeout: 5000 });
    await delay(500);
  }
}

/** Opens the Bulk Actions menu and clicks one action (e.g. 'actMassApprove'). */
export async function openBulkAction(frame: Frame, actionId: string): Promise<void> {
  await frame.click('#drpActions', { timeout: 5000 });
  await delay(500);
  await frame.locator('#' + actionId).click({ force: true, timeout: 5000 });
  await delay(1500);
}

/**
 * Fills a bulk-action job page (found by URL fragment, e.g. 'MasterDataMassApprove/JobSubmission'): job description +
 * the shared signature block, then clicks the id-less "Submit Job" / "Submit" button (`button[type=submit]`).
 * Returns the job frame so the caller can fill action-specific controls BEFORE calling `submitJob`.
 */
export async function openJobPage(page: Page, urlPart: string): Promise<Frame> {
  const jobFrame = await findFrame(page, urlPart);
  await jobFrame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  await delay(1000);
  return jobFrame;
}

export async function fillJobSignature(jobFrame: Frame, description: string, reasonLabel?: string): Promise<void> {
  if ((await jobFrame.locator('#txtJobDescription').count()) > 0) {
    await jobFrame.fill('#txtJobDescription', description, { timeout: 5000 });
  }
  await jobFrame.fill('#sigUser', USERNAME, { timeout: 5000 });
  await jobFrame.fill('#sigPassword', PASSWORD, { timeout: 5000 });
  if (reasonLabel) {
    await jobFrame.selectOption('#sigReason', { label: reasonLabel }, { timeout: 5000 });
  } else {
    await jobFrame.selectOption('#sigReason', { index: 1 }, { timeout: 5000 });
  }
  await jobFrame.fill('#sigComments', 'Playwright MDM bulk test', { timeout: 5000 });
}

/** Clicks Submit and waits for the job's Detail frame; polls its text until a terminal status. Returns text + status. */
export async function submitJobAndRead(page: Page, jobFrame: Frame, detailUrlPart: string): Promise<{ text: string; status: string }> {
  await jobFrame.getByRole('button', { name: /^Submit/ }).click({ timeout: 5000 });
  let detail = await findFrame(page, detailUrlPart);
  await detail.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
  let text = '';
  for (let attempt = 0; attempt < 60; attempt++) {
    text = (await detail.locator('body').innerText({ timeout: 3000 }).catch(() => '')).replace(/[ \t]+/g, ' ');
    if (/Status:?\s*(Completed|CompletedWithErrors|Failed|Error)/i.test(text) && !/Page\s+of\s+0/.test(text)) break;
    await delay(2000);
    detail = await findFrame(page, detailUrlPart);
  }
  const status = (text.match(/Status:?\s*(\w+)/) ?? [])[1] ?? '';
  return { text, status };
}

/** Closes the Master Data tab (if open) and reopens the module from the Main Menu, returning the fresh grid frame. */
export async function reopenMasterData(page: Page): Promise<Frame> {
  await page.locator('li.ui-tabs-tab:has-text("Master Data") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
  await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
  await page.getByRole('button', { name: 'Master Data', exact: true }).click({ timeout: 10_000 });
  const frame = await findFrame(page, 'MasterData');
  await delay(1500);
  return frame;
}

/**
 * Returns to the Master Data grid after the page was navigated TOP-LEVEL away from the WebMenu (e.g. `cm.goToItem`):
 * loads the WebMenu again (logging in only if the login form is showing) and opens the Master Data tile.
 */
export async function gotoMasterData(page: Page): Promise<Frame> {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded').catch(() => {});
  if (await page.locator('.userID').isVisible({ timeout: 3000 }).catch(() => false)) {
    await login(page);
  }
  await page.getByRole('button', { name: 'Master Data', exact: true }).click({ timeout: 15_000 });
  const frame = await findFrame(page, 'MasterData');
  await delay(1500);
  return frame;
}

/**
 * Advanced Options > Selected Fields is PERSISTED per account (like the filters), so a previous run's extra columns come back.
 * Moves every extra column (anything except the default "Item Number" / "Version Number") back to Available and leaves the
 * accordion open. Returns the Selected Fields afterwards.
 */
export async function resetSelectedColumns(frame: Frame): Promise<string[]> {
  const panel = frame.locator('#selectedLimitColumns');
  if (!(await panel.isVisible().catch(() => false))) {
    await frame.locator('#advancedOptions h3 a').click({ timeout: 5000 });
    await delay(600);
  }
  const keep = new Set(['Item Number', 'Version Number']);
  for (const text of (await panel.locator('option').allInnerTexts()).map((t) => t.trim())) {
    if (keep.has(text)) continue;
    await panel.selectOption({ label: text }, { timeout: 5000 });
    await frame.click('#btSelToAvl', { timeout: 5000 });
    await delay(250);
  }
  return (await panel.locator('option').allInnerTexts()).map((t) => t.trim());
}

/** Sets the Master Data Edit page's built-in "Effective End" date (readonly datepicker -> push a Date into the observable, like setEffectiveBegin). */
export async function setEffectiveEnd(frame: Frame, date: Date): Promise<void> {
  await frame.evaluate((dateMs) => {
    const ko = (window as any).ko;
    const vm = ko.dataFor(document.body);
    vm.itemHeader().effectiveEnd(new Date(dateMs));
  }, date.getTime());
}
