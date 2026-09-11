// Bulk action: Retire Templates (TM_RetireTemplates-1.2), server-side action name
// "MassRetireTemplates" (see bulkActionSubmission() in Management.cshtml) -- same page and action
// also handles Unretire via a radio toggle, exercised here as a second pass against the template
// this test just retired (solves the "need an already-retired template to test Unretire" problem
// without a separate setup path).
//
// Live-confirmed (2026-09-11) via direct MCP browser exploration before writing this test:
// - "Retire" radio (#retireItems) is preselected and "Unretire" (#unretireItems) is disabled when
//   every selected template is currently active; the reverse (Unretire preselected, Retire
//   disabled) once the template is retired -- matches Campaign Manager's Retire_Items_Bulk.spec.ts
//   pattern exactly (same shared bulk-retire UI convention).
// - Same signature-component blur gotcha as Mass_Approve_Templates.spec.ts: Submit Job stays
//   disabled until Password is explicitly blurred.
// - Confirmed submit endpoint: POST /InnoPages/TemplateManagement/RetireSubmitJob for both
//   directions (preceded by an Authenticate call). Success navigates to a "Retire Templates Job
//   Detail" page (Status "Completed", Percent Complete "100 %") -- same shape both ways.
// - Confirmed effect (Retire): Effective End changes from the default far-future "12/31/2099" to
//   the current day's date/time.
// - Unretire additionally requires an "Effective End Date" field, driven by a jQuery UI datepicker
//   (same readonly-input family as Edit_Attributes.spec.ts's Effective Begin/End, which that test
//   couldn't drive via .fill()). Confirmed live: clicking the field or its calendar icon opens a
//   `.ui-datepicker` popup; its "Today" button only navigates the calendar to the current month
//   without selecting a date -- the actual selection is clicking the day-of-month link itself,
//   which both fills the input and closes the popup. This test picks today's date that way.
// - Confirmed live: after Submit navigates to the Job Detail page, its "Template Management"
//   breadcrumb link returns to the grid with the same template-name filter still applied (the
//   account's persisted last search) -- no need to re-add the filter row for the second pass.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('mass retire and unretire templates toggles the selected template', async ({ page }) => {
  // Generous budget: BarTender launch-and-close, then TWO job submissions (retire + unretire).
  test.setTimeout(450_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBRetireTest' + Math.floor(Math.random() * 100000);

  // Checks the template's row and opens the given Bulk Actions menu item. Retrieve Data must have
  // already run and the row must already be on screen.
  async function selectRowAndStartBulkAction(actionText: string) {
    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await row.waitFor({ state: 'visible', timeout: 10_000 });
    // Checking the row's checkbox fires async selection-tracking calls that the Bulk Actions
    // menu's enabled/disabled state depends on -- wait for that round trip, not a blind timeout.
    await Promise.all([
      page.waitForResponse((r) => r.url().includes('/TemplateManagement/GetSelectedItemIds'), { timeout: 10_000 }),
      row.locator('input[type="checkbox"]').check(),
    ]);
    await page.waitForTimeout(500);

    await frame.getByText('Bulk Actions', { exact: true }).click();
    await page.waitForTimeout(500);
    await frame.getByText(actionText, { exact: true }).click();
    await page.waitForTimeout(500);
  }

  await test.step('create a throwaway template to retire', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', 'Created via automated Playwright test (Retire/Unretire Templates)');
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

  await test.step('query for the new template', async () => {
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
  });

  await test.step('retire it', async () => {
    await selectRowAndStartBulkAction('Retire Templates');

    await expect(frame.locator('#retireItems')).toBeChecked();
    await expect(frame.locator('#unretireItems')).toBeDisabled();

    await frame.fill('#txtJobDescription', 'Playwright retire templates job');
    await frame.fill('#sigUser', 'mbuser1');
    await frame.fill('#sigPassword', 'Password1');
    // Confirmed live: same Submit Job blur gotcha as Mass_Approve_Templates.spec.ts -- stays
    // disabled until Password is explicitly blurred.
    await frame.locator('#sigPassword').press('Tab');
    await frame.selectOption('#sigReason', { label: 'General' });
    await page.waitForTimeout(500);

    const submitButton = frame.locator('#btnSubmit');
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/TemplateManagement/RetireSubmitJob') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      submitButton.click(),
    ]);
    await expect(frame.getByRole('heading', { name: 'Retire Templates Job Detail' })).toBeVisible();
    // Pause here so the Job Detail page (Status/Percent Complete reaching "Completed"/"100 %")
    // is actually visible to watch, not just asserted on instantly.
    await page.waitForTimeout(3000);
    await expect(frame.locator('body')).toContainText('Completed');
    await expect(frame.locator('body')).toContainText('100 %');
  });

  await test.step('confirm it is now retired, then unretire it', async () => {
    await frame.getByRole('link', { name: 'Template Management' }).click();
    await page.waitForTimeout(500);

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
    // The default far-future Effective End ("12/31/2099") should be gone, replaced by today's date.
    await expect(row).not.toContainText('12/31/2099');

    await selectRowAndStartBulkAction('Retire Templates');

    await expect(frame.locator('#unretireItems')).toBeChecked();
    await expect(frame.locator('#retireItems')).toBeDisabled();

    // Pick today's date via the datepicker -- confirmed live this is the only way to set this
    // field; it's readonly, and the popup's "Today" button only navigates to the current month
    // without selecting. Clicking the day-of-month link both fills the input and closes the popup.
    await frame.click('#effectiveEndDiv img');
    await page.waitForTimeout(500);
    const today = String(new Date().getDate());
    await frame.locator('.ui-datepicker-calendar').getByRole('link', { name: today, exact: true }).click();
    await page.waitForTimeout(500);

    await frame.fill('#txtJobDescription', 'Playwright unretire templates job');
    await frame.fill('#sigUser', 'mbuser1');
    await frame.fill('#sigPassword', 'Password1');
    await frame.locator('#sigPassword').press('Tab');
    await frame.selectOption('#sigReason', { label: 'General' });
    await page.waitForTimeout(500);

    const submitButton = frame.locator('#btnSubmit');
    await expect(submitButton).toBeEnabled({ timeout: 10_000 });

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/TemplateManagement/RetireSubmitJob') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      submitButton.click(),
    ]);
    await expect(frame.getByRole('heading', { name: 'Retire Templates Job Detail' })).toBeVisible();
    await page.waitForTimeout(3000);
    await expect(frame.locator('body')).toContainText('Completed');
    await expect(frame.locator('body')).toContainText('100 %');
  });
});
