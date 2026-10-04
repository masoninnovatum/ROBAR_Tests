// Template Management > Bulk Actions > Approve Templates: the NEGATIVE paths, headless, consuming nothing:
//   * no records ticked -> "Please select one or more records."
//   * the job page: required fields, Submit disabled until complete, wrong password -> "Invalid Username/Password." and no job
//   * an ALREADY-APPROVED selection: the page says "All templates are already approved." and the whole form (Job Description,
//     signature fields, Submit) is disabled -- no job can be submitted (same pattern as Assign GTIN for approved MD records)
// Unapproved fixtures (MBGDMD*, created by Get_Data_Master_Data.spec.ts) are only ticked, never approved, so Search_and_Filter's
// "unapproved" expectations stay true. The approve job page is rendered INSIDE the Template Management frame (same URL base).

import { test, expect } from '@playwright/test';
import type { Frame, Page } from '@playwright/test';
import { login, openMenuItem, findFrame, USERNAME, PASSWORD } from '../support/robar';

test('Approve Templates: nothing selected, wrong password, incomplete form and an already-approved template', async ({ page }) => {
  test.setTimeout(300_000);
  await login(page);
  await openMenuItem(page, 'Template Management');
  let f: Frame = await findFrame(page, 'TemplateManagement');
  await page.waitForTimeout(3000);

  const search = async (name: string) => {
    await f.click('#btnReset', { timeout: 5000 });
    await page.waitForTimeout(1500);
    f = await findFrame(page, 'TemplateManagement');
    if (await f.locator('#chkFilterByDataSource').isChecked()) {
      await f.locator('#chkFilterByDataSource').uncheck();
    }
    await f.locator('.criteriaFilter-AddButton span:not(.ui-icon)').click({ timeout: 5000 });
    await f.locator('select[name="dvFilters[0].Column"]').selectOption('LabelName', { timeout: 5000 });
    await f.locator('select[name="dvFilters[0].Operator"]').selectOption('Contains', { timeout: 5000 });
    await f.locator('input[name="dvFilters[0].Value"]').fill(name, { timeout: 5000 });
    await Promise.all([page.waitForResponse((r) => r.url().includes('/TemplateManagement/GridSessionStart'), { timeout: 20_000 }), f.click('#btnRetrieveData')]);
    await page.waitForTimeout(2500);
  };
  const tick = async (index: number) => {
    // Ticking fires GridSessionSelectRow -> GetSelectedItemIds; the Bulk Actions menu only sees the selection after that round trip.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
      f.locator('#grdJqGrid tr.jqgrow').nth(index).locator('input[type=checkbox]').check({ timeout: 5000 }),
    ]);
    await page.waitForTimeout(500);
  };
  const openApprove = async () => {
    await f.click('#drpActions', { timeout: 5000 });
    await page.waitForTimeout(500);
    await f.locator('#actApprove').click({ force: true, timeout: 5000 });
    await page.waitForTimeout(3000);
    f = await findFrame(page, 'TemplateManagement');
  };

  await test.step('nothing ticked: Approve Templates answers "Please select one or more records."', async () => {
    await search('MBGDMD');
    // Bulk Actions only appears once a row is ticked, so tick then untick to get the menu with an empty selection
    await tick(0);
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }).catch(() => null),
      f.locator('#grdJqGrid tr.jqgrow').first().locator('input[type=checkbox]').uncheck({ timeout: 5000 }),
    ]);
    await page.waitForTimeout(800);
    if (await f.locator('#drpActions').isVisible()) {
      await f.click('#drpActions');
      await page.waitForTimeout(500);
      await f.locator('#actApprove').click({ force: true });
      const dialog = f.locator('.ui-dialog:visible').filter({ hasText: 'Please select one or more records.' });
      await expect(dialog).toHaveCount(1, { timeout: 8000 });
      await dialog.getByRole('button', { name: 'OK' }).click();
    } else {
      console.log('Bulk Actions is hidden again once nothing is ticked');
    }
  });

  await test.step('job page: fields, reasons, Submit stays disabled until everything is filled, wrong password is refused', async () => {
    await search('MBGDMD');
    await tick(0);
    await openApprove();
    await expect(f.getByRole('heading', { name: 'Approve Templates' })).toBeVisible({ timeout: 10_000 });
    await expect(f.locator('body')).toContainText('Selected: 1');
    expect((await f.locator('#sigReason option').allInnerTexts()).map((t) => t.trim())).toEqual(['Select Reason', 'General', 'New Template', 'Reviewed and Approved']);
    const submit = f.locator('#btnSubmit');
    await expect(submit, 'nothing filled').toBeDisabled();
    await f.fill('#txtJobDescription', 'PW negative approve');
    await f.fill('#sigUser', USERNAME);
    await f.fill('#sigPassword', 'definitely-wrong-password');
    await expect(submit, 'no reason chosen yet').toBeDisabled();
    await f.selectOption('#sigReason', { index: 1 });
    await f.locator('#sigPassword').press('Tab');
    await expect(submit).toBeEnabled({ timeout: 5000 });
    await submit.click();
    await page.waitForTimeout(2500);
    await expect(f.locator('body'), 'refused in place').toContainText('Invalid Username/Password.');
    await expect(f.getByRole('heading', { name: 'Approve Templates' }), 'still on the submission page, no job created').toBeVisible();
    expect(await f.getByRole('heading', { name: /Job Detail/ }).count()).toBe(0);
  });

  await test.step('an ALREADY-APPROVED selection disables the whole job form', async () => {
    f = await findFrame(page, 'TemplateManagement');
    await page.locator('li.ui-tabs-tab:has-text("Template Management") .ui-icon-close').click({ timeout: 3000 }).catch(() => {});
    await page.locator('li.ui-tabs-tab:has-text("Main Menu")').click({ timeout: 3000 }).catch(() => {});
    await openMenuItem(page, 'Template Management');
    f = await findFrame(page, 'TemplateManagement');
    await page.waitForTimeout(3000);
    await search('MBSide');
    const rowsText = (await f.locator('#grdJqGrid tr.jqgrow').allInnerTexts()).map((t) => t.replace(/\s+/g, ' '));
    console.log(`MBSide rows: ${JSON.stringify(rowsText.map((t) => t.slice(0, 120)))}`);
    expect(rowsText.length).toBeGreaterThan(0);
    await tick(0);
    await openApprove();
    const text = (await f.locator('body').innerText()).replace(/\s+/g, ' ');
    console.log(`APPROVE PAGE (already approved): ${text.slice(0, 600)}`);
    const state = await f.locator('#txtJobDescription, #sigUser, #sigPassword, #sigReason, #sigComments, #btnSubmit').evaluateAll((els) => els.map((e) => `${e.id}:${(e as HTMLInputElement).disabled ? 'disabled' : 'enabled'}`));
    console.log(`fields: ${JSON.stringify(state)}`);
    expect(text).toContain('All templates are already approved.');
    expect(state.every((s) => s.endsWith('disabled')), 'the whole form is disabled for an approved selection').toBe(true);
  });
});
