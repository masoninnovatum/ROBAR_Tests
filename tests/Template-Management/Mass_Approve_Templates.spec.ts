// Bulk action: Approve Templates (TM_ApproveTemplates-1.3), server-side action name
// "MassApproveTemplates" (see bulkActionSubmission() in Management.cshtml).
//
// Live-confirmed (2026-09-11) via direct MCP browser exploration before writing this test. Key
// finding, confirmed live via both MCP exploration AND an initial failed Playwright run: the
// "Submit Job" button's `enable: viewModel.canApprove && sigValid()` binding does NOT recompute
// purely from filling the fields, even with Playwright's own `.fill()` (which does dispatch
// input/change events) -- it stays disabled until Password is explicitly blurred. This test tabs
// out of the Password field before relying on the button's enabled state.
//
// Signature fields are the same shared `SignatureComponentTemplate` component used throughout
// ROBAR (`#sigUser`/`#sigPassword`/`#sigReason`/`#sigComments`), not scoped by a wrapping dialog id
// since this is a full page, not a modal. Confirmed submit endpoint:
// POST /InnoPages/TemplateManagement/ApproveSubmitJob (preceded by an Authenticate call). Success
// navigates (within the same iframe) to an "Approve Templates Job Detail" page showing Status
// "Completed" and Percent Complete "100 %" -- not a JSON response to assert on directly.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('mass approve templates approves the selected template', async ({ page }) => {
  // Generous budget for the Sentinel/BarTenderEdit launch-and-close round trip -- see
  // Create_and_Approve_Template.spec.ts's comment on why BarTender's own startup timing varies.
  test.setTimeout(300_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBApproveTest' + Math.floor(Math.random() * 100000);

  await test.step('create a throwaway unapproved template', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Approve Templates)');
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    await frame.setInputFiles('#newFileInput', String.raw`\\vmsrvtst703\BaseTemplates\NewTemplate.btw`);
    await page.waitForTimeout(500);

    const [createResponse, tokenResponse] = await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/CreateNewTemplate'), { timeout: 15_000 }),
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetFileToken'), { timeout: 20_000 }),
      frame.locator('button:has-text("Submit"):visible').first().click({ force: true }),
    ]);
    const createBody = await createResponse.json();
    const tokenBody = await tokenResponse.json();
    expect(createBody.Success, `CreateNewTemplate failed: ${JSON.stringify(createBody)}`).toBe(true);
    expect(tokenBody.Token, `GetFileToken returned no token: ${JSON.stringify(tokenBody)}`).toBeTruthy();

    const bartenderPid = await bartender.launchTemplateEditor(page);
    await bartender.closeTemplateEditor(page, bartenderPid);
  });

  await test.step('query for it, check it, and start the Approve Templates bulk action', async () => {
    await frame.click('.criteriaFilter-AddButton');
    await page.waitForTimeout(500);
    // Confirmed live: this page's CriteriaFilter widget instance is named "dvFilters" (unlike
    // Campaign Manager's instance) -- field names are "dvFilters[0].Column" etc.
    await frame.selectOption('select[name="dvFilters[0].Column"]', 'LabelName');
    await frame.selectOption('select[name="dvFilters[0].Operator"]', 'ExactlyMatches');
    await frame.fill('input[name="dvFilters[0].Value"]', templateName);

    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(templateName),
        { timeout: 15_000 }
      ),
      frame.click('#btnRetrieveData'),
    ]);

    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    // Checking the row's checkbox fires async selection-tracking calls (GridSessionSelectRow ->
    // GetSelectedItemIds) that the Bulk Actions menu's enabled/disabled state depends on -- wait
    // for that round trip rather than a blind timeout, or "Approve Templates" can still show
    // disabled (0 selected) if clicked too soon.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
      row.locator('input[type="checkbox"]').check(),
    ]);
    await page.waitForTimeout(500);

    await frame.getByText('Bulk Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    await frame.getByText('Approve Templates', { exact: true }).click();
    await page.waitForTimeout(500);
  });

  await test.step('submit the approval job', async () => {
    await frame.fill('#txtJobDescription', 'Playwright approve templates job');
    await frame.fill('#sigUser', 'mbuser1');
    await frame.fill('#sigPassword', 'Password1');
    // Confirmed live: the Submit Job button's `sigValid()` binding does not recompute purely from
    // filling the fields -- it stayed disabled even after every field was filled until Password
    // was explicitly blurred. Tab out of it before relying on the button's enabled state.
    await frame.locator('#sigPassword').press('Tab');
    await frame.selectOption('#sigReason', { label: 'General' });
    await page.waitForTimeout(500);

    const submitButton = frame.locator('#btnSubmit');
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/TemplateManagement/ApproveSubmitJob') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      submitButton.click(),
    ]);
    await expect(frame.getByRole('heading', { name: 'Approve Templates Job Detail' })).toBeVisible();
    // Pause here so the Job Detail page (Status/Percent Complete reaching "Completed"/"100 %")
    // is actually visible to watch, not just asserted on instantly.
    await page.waitForTimeout(3000);

    await expect(frame.locator('body')).toContainText('Completed');
    await expect(frame.locator('body')).toContainText('100 %');
  });

  await test.step('confirm the template now shows as approved', async () => {
    await frame.getByRole('link', { name: 'Template Management' }).click();
    await page.waitForTimeout(500);

    await frame.selectOption('#drpApprove', { label: 'Approved and Unapproved' });
    await Promise.all([
      page.waitForResponse(
        (r) =>
          r.url().includes('/TemplateManagement/GridSessionStart') &&
          r.request().method() === 'POST' &&
          (r.request().postData() || '').includes(templateName),
        { timeout: 15_000 }
      ),
      frame.click('#btnRetrieveData'),
    ]);

    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await expect(row).toContainText('mbuser1', { ignoreCase: true });
  });
});
