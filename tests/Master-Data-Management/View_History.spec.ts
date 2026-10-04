// MDM View History (grid row Actions > "View History", `InnovatumMDM/MasterData/ChangeHistory/<masterDataId>`): a per-VERSION
// change log of schema-field values -- Change Date, Change User, Changed Field, Value Before, Value After, and a "View Detail"
// link that opens a dialog with a snapshot of the whole record at that change. Observed on a fresh record with a known history:
//   v0: create (initial values are logged as "(null)" -> value), edit Brand Name, approve (logs ApprovalDateTime)
//   v1: Save as New Version, edit Brand Name (history is per version -- v1 shows only ITS changes)
// Web-only.

import { test, expect } from '@playwright/test';
import type { Frame } from '@playwright/test';
import * as mdm from '../support/master-data';
import { findFrame, USERNAME } from '../support/robar';

test('View History lists the per-version field changes, filters by field and opens a record snapshot', async ({ page }) => {
  test.setTimeout(420_000);
  let frame: Frame = await mdm.openMasterData(page);
  const item = 'MBMDH' + Date.now().toString().slice(-6);

  await test.step('build a record with a known history (v0: create, edit, approve; v1: new version + edit)', async () => {
    await mdm.createValidRecord(page, frame, { itemNumber: item, brandName: 'History Brand 1' });
    await mdm.fillFieldByCaption(frame, 'Brand Name', 'History Brand 2');
    await mdm.saveRecord(page, frame);
    await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
    await mdm.clickEditAction(page, frame, 'menuApprove');
    await mdm.signAndSubmit(frame, '#approveDialog', 'btnApproveSubmit', 'General Approval');
    await expect(frame.getByText(new RegExp(`Approved By:\\s*${USERNAME}`, 'i'))).toBeVisible({ timeout: 15_000 });
    await mdm.clickEditAction(page, frame, 'menuSaveAsNewVersion');
    await page.waitForTimeout(1000);
    await mdm.confirmDialog(frame);
    await page.waitForTimeout(3500);
    frame = await findFrame(page, 'MasterData/Edit');
    await expect(frame.getByText('Approved By: Unapproved')).toBeVisible({ timeout: 10_000 });
    await mdm.fillFieldByCaption(frame, 'Brand Name', 'History Brand 3');
    await mdm.saveRecord(page, frame);
    await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
    frame = await mdm.backToGrid(page, frame);
  });

  /** Opens View History for one version row (0 = v0, 1 = v1) and returns the history frame. */
  const openHistory = async (index: number): Promise<Frame> => {
    frame = await findFrame(page, 'MasterData');
    const rows = await mdm.retrieve(page, frame, { value: item, expectRows: 2 });
    await rows.nth(index).locator('a:has-text("Actions")').click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await frame.locator('ul:visible a').filter({ hasText: 'View History' }).first().click({ force: true, timeout: 5000 });
    const hf = await findFrame(page, 'MasterData/ChangeHistory');
    await expect(hf.locator('tr.jqgrow').first()).toBeVisible({ timeout: 15_000 });
    return hf;
  };
  /** The grid's rows as [changeUser, field, before, after] (change date and the View Detail link are dropped). */
  const gridRows = async (hf: Frame) =>
    (await hf.locator('tr.jqgrow').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => (td.textContent ?? '').trim()))))
      .map((cells) => cells.filter(Boolean))
      .map((c) => ({ date: c[0], user: c[1], field: c[2], before: c[3], after: c[4] }));
  const backToMdmGrid = async (hf: Frame) => {
    await hf.click('a:has-text("Previous Page")', { timeout: 5000 });
    await page.waitForTimeout(2500);
  };

  await test.step('v0 history: header, the initial values, the Brand Name edit and the approval date', async () => {
    const hf = await openHistory(0);
    const text = (await hf.locator('body').innerText()).replace(/\s+/g, ' ');
    expect(text).toContain(`Item Number: ${item}`);
    expect(text).toContain('Version: 0');
    expect(text).toContain('Schema Name: RobarMasterData');
    const rows = await gridRows(hf);
    console.log(`v0 history rows: ${JSON.stringify(rows.map((r) => [r.user, r.field, r.before, r.after]))}`);
    const find = (field: string, after?: string) => rows.filter((r) => r.field === field && (after === undefined || r.after === after));
    expect(find('Brand Name', 'History Brand 1')[0]?.before, 'creation logged as (null) -> value').toBe('(null)');
    expect(find('Brand Name', 'History Brand 2')[0]?.before, 'the edit logs old -> new').toBe('History Brand 1');
    expect(find('Primary DI Number')[0]?.before).toBe('(null)');
    expect(find('Labeler Duns Number').length, 'the dropdown default 1234567890 -> the chosen value is logged').toBe(1);
    expect(find('ApprovalDateTime').length, 'approval is logged as ApprovalDateTime').toBe(1);
    expect(find('ApprovalDateTime')[0].before).toBe('(null)');
    expect(rows.length, 'exactly the five changes made').toBe(5);
    // the footer count
    expect(text).toMatch(/View 1 - 5 of 5/);
    // newest first: the approval is the top row
    expect(rows[0].field).toBe('ApprovalDateTime');
    await backToMdmGrid(hf);
  });

  await test.step('v1 history is per version: only its own Brand Name change', async () => {
    const hf = await openHistory(1);
    const rows = await gridRows(hf);
    expect(rows.map((r) => [r.field, r.before, r.after])).toEqual([['Brand Name', 'History Brand 2', 'History Brand 3']]);
    expect((await hf.locator('body').innerText()).replace(/\s+/g, ' ')).toContain('Version: 1');
    // the Field dropdown only offers fields that have recorded changes for THIS version
    const fieldOptions = await hf.locator('select:has(option:text-is("(Select Field)")) option').allInnerTexts();
    expect(fieldOptions.map((t) => t.trim())).toEqual(['(Select Field)', 'Brand Name']);
    await backToMdmGrid(hf);
  });

  await test.step('Field filter narrows the grid; View Detail opens a record snapshot dialog', async () => {
    const hf = await openHistory(0);
    const fieldSelect = hf.locator('select:has(option:text-is("(Select Field)"))');
    const options = (await fieldSelect.locator('option').allInnerTexts()).map((t) => t.trim());
    console.log(`v0 Field options: ${JSON.stringify(options)}`);
    expect(options).toEqual(expect.arrayContaining(['ApprovalDateTime', 'Brand Name', 'Labeler Duns Number', 'Primary DI Number']));
    await fieldSelect.selectOption({ label: 'Brand Name' }, { timeout: 5000 });
    await page.waitForTimeout(3000);
    const filtered = await gridRows(hf);
    expect(filtered.map((r) => r.field)).toEqual(['Brand Name', 'Brand Name']);
    expect((await hf.locator('body').innerText()).replace(/\s+/g, ' ')).toMatch(/View 1 - 2 of 2/);

    // the newest Brand Name change is History Brand 1 -> 2; its snapshot shows the record as of that change
    await hf.locator('tr.jqgrow').first().locator('a').first().click({ timeout: 5000 });
    const dialog = hf.locator('.ui-dialog:visible');
    await expect(dialog).toHaveCount(1, { timeout: 10_000 });
    await page.waitForTimeout(1500);
    const snapshot = (await dialog.innerText()).replace(/\s+/g, ' ');
    console.log(`snapshot dialog: ${snapshot.slice(0, 300)}`);
    expect(snapshot).toContain('Master Data history');
    expect(snapshot).toContain(`Item Number: ${item}`);
    expect(snapshot).toContain('Version: 0');
    await dialog.getByRole('button', { name: 'Close' }).first().click({ timeout: 5000 });
    await expect(hf.locator('.ui-dialog:visible')).toHaveCount(0, { timeout: 5000 });
    await backToMdmGrid(hf);
  });

  await test.step('Change User filter: selecting a user keeps that user\'s rows', async () => {
    const hf = await openHistory(0);
    const userSelect = hf.locator('select:has(option:text-is("(Select User)"))');
    const users = (await userSelect.locator('option').allInnerTexts()).map((t) => t.trim());
    console.log(`v0 Change User options: ${JSON.stringify(users)}`);
    expect(users[0]).toBe('(Select User)');
    // The grid shows the user as logged (field edits and the approval can use different letter case) but the dropdown holds
    // ONE entry for them, and selecting it keeps both spellings -- the filter is case-insensitive.
    expect(users.length, 'one dropdown entry for the one user').toBe(2);
    expect(users[1].toLowerCase()).toBe(USERNAME.toLowerCase());
    await userSelect.selectOption({ label: users[1] }, { timeout: 5000 });
    await page.waitForTimeout(3000);
    const filtered = await gridRows(hf);
    expect(filtered.length, 'all five changes were made by this user').toBe(5);
    for (const r of filtered) expect(r.user.toLowerCase()).toBe(USERNAME.toLowerCase());
    await backToMdmGrid(hf);
  });
});
