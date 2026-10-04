// MDM record lifecycle on the Master Data Edit page: validation, Approve (e-signature, record locks), Save As New
// Version, Retire / Unretire and Save As New Record. All web-only; one fresh RobarMasterData record per run.
//
// Live-confirmed selectors / behaviour are in tests/support/master-data.ts (Edit page Actions menu ids, signature
// dialogs) and robar-module-reference.md (Master Data Management). The RobarMasterData "Labeler Duns Number" default
// is a known product bug the helper works around (see Create_New_Record.spec.ts).

import { test, expect } from '@playwright/test';
import { findFrame, USERNAME } from '../support/robar';
import * as mdm from '../support/master-data';

test('MDM record lifecycle: validation, approve + lock, new version, retire / unretire, save as new record', async ({ page }) => {
  test.setTimeout(420_000);
  const frame0 = await mdm.openMasterData(page);
  let frame = frame0;
  const itemNumber = await mdm.createValidRecord(page, frame);

  await test.step('a fresh record is Version 0, unapproved, Effective End 12/31/2099', async () => {
    await expect(frame.getByText(`Item Number: ${itemNumber}`)).toBeVisible();
    await expect(frame.getByText('Approved By: Unapproved')).toBeVisible();
    const header = (await frame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`edit page header: ${header.slice(0, 500)}`);
    expect(header).toMatch(/Version:?\s*0/);
    // The Effective Begin / End dates are datepicker INPUT values, not page text.
    const inputValues = await frame.locator('input').evaluateAll((els) => els.map((e) => (e as HTMLInputElement).value));
    expect(inputValues.some((v) => /12\/31\/2099/.test(v)), `Effective End 12/31/2099 among inputs: ${inputValues.filter(Boolean).join(' | ')}`).toBe(true);
  });

  await test.step('validation: clearing a required field blocks Save with the module-wide popup', async () => {
    await mdm.fillFieldByCaption(frame, 'Brand Name', '');
    await expect(frame.getByRole('button', { name: 'Save' })).toBeEnabled({ timeout: 5000 });
    const body = (await frame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`required-field state: ${body.includes('This field is required.')}`);
    expect(body).toContain('This field is required.');
    await frame.click('button:has-text("Save")', { timeout: 5000 });
    await page.waitForTimeout(1000);
    const popup = (await frame.locator('.ui-dialog:visible').allInnerTexts()).join(' | ').replace(/\s+/g, ' ');
    console.log(`save-blocked popup: ${popup.slice(0, 300)}`);
    expect(popup).toContain('Some fields contain invalid values');
    await frame.locator('.ui-dialog:visible button').filter({ hasText: /Continue|OK/i }).first().click({ timeout: 5000 });
    // Restore a valid value and save.
    await mdm.fillFieldByCaption(frame, 'Brand Name', 'Playwright Brand Restored');
    await mdm.saveRecord(page, frame);
    await expect(frame.getByRole('button', { name: 'Save' })).toBeDisabled({ timeout: 10_000 });
  });

  await test.step('Approve (e-signature): Approved By is filled in and the record locks', async () => {
    expect(await mdm.editActionDisabled(frame, 'menuSaveAsNewVersion'), 'Save as New Version needs an approved record').toBe(true);
    await mdm.clickEditAction(page, frame, 'menuApprove');
    await mdm.signAndSubmit(frame, '#approveDialog', 'btnApproveSubmit', 'General Approval');
    await expect(frame.getByText('Approved By: Unapproved')).toBeHidden({ timeout: 15_000 });
    const approved = (await frame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`after approve: ${approved.slice(0, 400)}`);
    await expect(frame.getByText(new RegExp(`Approved By:\\s*${USERNAME}`, 'i'))).toBeVisible({ timeout: 5000 });
    // Locked: Brand Name is read-only, Approve is disabled, Save as New Version is now available.
    const brand = frame.getByRole('row', { name: 'Brand Name' }).locator('input[type=text]').first();
    expect(await brand.isEditable({ timeout: 5000 }), 'approved record is read-only').toBe(false);
    expect(await mdm.editActionDisabled(frame, 'menuApprove')).toBe(true);
    expect(await mdm.editActionDisabled(frame, 'menuSaveAsNewVersion')).toBe(false);
  });

  await test.step('Save as New Version: confirm dialog, then an unapproved Version 1 opens', async () => {
    await mdm.clickEditAction(page, frame, 'menuSaveAsNewVersion');
    await page.waitForTimeout(1000);
    const text = await mdm.confirmDialog(frame);
    console.log(`new version confirm: ${text}`);
    expect(text).toContain('create a new version');
    await page.waitForTimeout(3000);
    frame = await findFrame(page, 'MasterData/Edit');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(frame.getByText(`Item Number: ${itemNumber}`)).toBeVisible({ timeout: 10_000 });
    await expect(frame.getByText('Approved By: Unapproved')).toBeVisible({ timeout: 10_000 });
    const header = (await frame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`version 1 header: ${header.slice(0, 300)}`);
    expect(header).toMatch(/Version:?\s*1/);
  });

  await test.step('Retire the record (e-signature), then Unretire it', async () => {
    await mdm.clickEditAction(page, frame, 'menuRetire');
    await mdm.signAndSubmit(frame, '#retireDialog', 'btnRetireSubmit', (await frame.locator('#retireDialog #sigReason option').allInnerTexts())[1].trim());
    await page.waitForTimeout(4000);
    frame = await findFrame(page, 'MasterData/Edit');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await frame.locator('#drpToSelect').click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await expect(frame.locator('#menuUnretire'), 'a retired record offers Unretire instead of Retire').toHaveCount(1);
    await expect(frame.locator('#menuRetire')).toHaveCount(0);
    await frame.locator('#menuUnretire').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(800);
    await mdm.signAndSubmit(frame, '#unretireDialog', 'btnRetireSubmit', (await frame.locator('#unretireDialog #sigReason option').allInnerTexts())[1].trim());
    await page.waitForTimeout(4000);
    frame = await findFrame(page, 'MasterData/Edit');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await frame.locator('#drpToSelect').click({ timeout: 5000 });
    await page.waitForTimeout(600);
    await expect(frame.locator('#menuRetire')).toHaveCount(1);
    // Close the menu again so the next step's trigger click opens it rather than toggling it shut.
    await frame.locator('#drpToSelect').click({ timeout: 5000 });
    await page.waitForTimeout(400);
  });

  await test.step('Save As New Record: copies the record under a new item number', async () => {
    const copyNumber = itemNumber + 'C';
    await mdm.clickEditAction(page, frame, 'menuSaveAsNewRecord');
    await page.waitForTimeout(800);
    expect(await frame.locator('#txtNewItemNumber').inputValue({ timeout: 5000 }), 'dialog is pre-filled with the current item number').toBe(itemNumber);
    await frame.fill('#txtNewItemNumber', copyNumber, { timeout: 5000 });
    await frame.locator('#btnSubmitNewitem').click({ timeout: 5000 });
    await page.waitForTimeout(4000);
    frame = await findFrame(page, 'MasterData/Edit');
    await frame.waitForLoadState('networkidle', { timeout: 10_000 }).catch(() => {});
    await expect(frame.getByText(`Item Number: ${copyNumber}`)).toBeVisible({ timeout: 10_000 });
    await expect(frame.getByText('Approved By: Unapproved')).toBeVisible({ timeout: 10_000 });
    const header = (await frame.locator('body').innerText({ timeout: 5000 })).replace(/\s+/g, ' ');
    console.log(`copy header: ${header.slice(0, 300)}`);
  });
});
