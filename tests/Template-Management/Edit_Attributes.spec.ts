// Row-level action: Edit Attributes (TM_Edit_Attributes-1.14).
//
// Live-confirmed (2026-09-11) via direct MCP browser exploration before writing this test (login,
// navigate, open the dialog, try both scenarios) rather than guessing selectors -- see
// robar-module-reference.md's "Template Management" section for how that exploration approach
// works and why it's worth doing before any new Template Management test.
//
// Dialog fields confirmed live: Template Name/Version (read-only text), Description (editable
// textbox, prefilled), Effective Begin/Effective End (readonly text driven by a jQuery UI
// datepicker widget -- NOT editable via a plain .fill(), so this test only exercises Description).
// Submitting with a blank Description shows "Description is required." as a text node injected
// next to the field (not a separate element with its own stable selector) and leaves the dialog
// open. A valid Submit closes the dialog and the grid re-renders with the new description in
// place -- no separate confirmation step needed.

import { test, expect } from '@playwright/test';
import { login, openMenuItem, findFrame } from '../support/robar';
import * as bartender from '../support/bartender';

// See View_Label_Characteristics.spec.ts's comment: headless:true now uses a dedicated headless-
// shell Chromium build with no real OS window, which FlaUI can never find.
test.use({ headless: false });

test('edit attributes updates a template\'s description, and rejects a blank one', async ({ page }) => {
  // Generous budget for the Sentinel/BarTenderEdit launch-and-close round trip -- see
  // Create_and_Approve_Template.spec.ts's comment on why BarTender's own startup timing varies.
  test.setTimeout(300_000);

  await login(page);
  await openMenuItem(page, 'Template Management');
  const frame = await findFrame(page, 'TemplateManagement');

  const templateName = 'MBEditAttrsTest' + Math.floor(Math.random() * 100000);
  const originalDescription = 'Created via automated Playwright test (Edit Attributes)';
  const updatedDescription = 'Updated via automated Playwright test (Edit Attributes)';

  await test.step('create a throwaway template to edit attributes on', async () => {
    await frame.click('#drpMainActions');
    await page.waitForTimeout(500);
    await frame.click('#actCreateTemplate', { force: true });
    await page.waitForTimeout(1000);

    await frame.fill('#txtTemplateName', templateName);
    await frame.fill('#txtDescription', originalDescription);
    await frame.selectOption('#ddlLabelType', { value: 'Carton Label' });
    // Blank starter file -- Edit Attributes never touches BarTender content, only the surrounding
    // web dialog, so what's in the file doesn't matter here.
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

  await test.step('query for the new template and open Edit Attributes', async () => {
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
    await row.getByText('Actions', { exact: true }).click();
    // Standing convention for Template Management row/bulk actions: give the dropMenu popup a
    // moment to finish rendering before the next click, rather than racing it.
    await page.waitForTimeout(500);
    // Scoped to the row, not `frame` -- confirmed live that #editTemplateAttributesDialog's own
    // jQuery UI title bar ("Edit Attributes") already exists in the DOM (hidden) from page load,
    // since it's a statically-declared knockout-bound dialog rather than one built dynamically
    // per click like View Label Characteristics' -- an unscoped frame-wide text match hits both.
    await row.getByText('Edit Attributes', { exact: true }).click();
    await page.waitForTimeout(500);
  });

  // #editTemplateAttributesDialog is the knockout-bound content div itself (confirmed via source:
  // Management.cshtml's `dialog: editTemplateAttributesDialogOptions` binding wraps it in jQuery
  // UI's own `.ui-dialog` chrome). Its Submit/Cancel buttons are jQuery UI dialog `buttons:`
  // entries, though -- rendered into a `.ui-dialog-buttonpane` that's a SIBLING of this content
  // div (both children of the outer `.ui-dialog` wrapper), not a descendant of it -- so they're
  // located unscoped via `frame`, not `dialog.locator(...)`.
  const dialog = frame.locator('#editTemplateAttributesDialog');
  const descriptionInput = dialog.locator('#txtEditDescription');
  const submitButton = frame.locator('#btnSaveTemplateAttributes');

  await test.step('rejects a blank Description', async () => {
    await expect(dialog).toBeVisible();
    await expect(descriptionInput).toHaveValue(originalDescription);
    await page.waitForTimeout(500);

    await descriptionInput.fill('');
    await page.waitForTimeout(500);
    await submitButton.click();
    await page.waitForTimeout(500);

    await expect(dialog).toContainText('Description is required.');
    await expect(dialog).toBeVisible(); // still open -- submit was blocked client-side
  });

  await test.step('submits a valid Description update', async () => {
    await descriptionInput.fill(updatedDescription);
    await page.waitForTimeout(500);

    await Promise.all([
      page.waitForResponse(
        (r) => r.url().includes('/TemplateManagement/UpdateTemplateAttributes') && r.request().method() === 'POST',
        { timeout: 15_000 }
      ),
      submitButton.click(),
    ]);
    await page.waitForTimeout(500);

    await expect(dialog).toBeHidden();

    const row = frame.locator('#grdJqGrid tr').filter({ hasText: templateName });
    await expect(row).toContainText(updatedDescription);
  });
});
